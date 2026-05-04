from __future__ import annotations

"""Agent-3 — Code Analysis.

Uses OpenAI function-calling so the model drives codebase exploration:
  1. Model calls search_code / read_file tools iteratively (like a real dev)
  2. Once it has found the relevant code, one structured call produces the fix
  3. Branch + minimal patch + draft PR raised in the correct repo
"""

import json
import logging
import os
import re
from typing import Optional, Dict, Any, List, Tuple

from app.config import get_settings
from app.services import github_service
from app.services.github_service import GitHubCredentialsMissing
from app.services.kb_data_validator import validate_data_vs_systemic

logger = logging.getLogger(__name__)

# gpt-5.4 is OpenAI's latest model (released March 2026)
# Falls back through the chain if not available on the account
_AGENT_MODEL = "gpt-5.4"
_FALLBACK_MODEL = "gpt-4.1"

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": (
                "Search the Chargebee codebase for files containing a specific term. "
                "Use precise names — class names, method names, field names, error strings. "
                "Avoid generic words like 'invoice' or 'template' alone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Specific search term, e.g. 'applyPdfTemplate' or 'TemplateRenderer'",
                    },
                    "repo": {
                        "type": "string",
                        "enum": ["chargebee-app", "chargebee-ui", "any"],
                        "description": "chargebee-app for backend Java/Groovy; chargebee-ui for frontend Vue/TS",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the full content of a file to examine its logic in detail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative file path as returned by search_code",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_chargebee_kb",
            "description": (
                "Query the Chargebee Knowledge Base to check if the reported issue "
                "is likely data-specific (unique to one merchant's configuration/data) "
                "or a systemic code bug. Call this EARLY in your investigation to help "
                "determine the right approach — data audit vs code fix."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": (
                            "Specific question about the issue, e.g. "
                            "'Can invoice PDF template issues be caused by merchant-specific "
                            "template configuration rather than a code bug?'"
                        ),
                    },
                },
                "required": ["question"],
            },
        },
    },
]

_SYSTEM_EXPLORE = """\
You are a senior Chargebee engineer debugging a reported issue.
Use search_code, read_file, and query_chargebee_kb to investigate.

IMPORTANT — Call query_chargebee_kb EARLY (within first 2 tool calls) to check
whether this issue is likely data-specific (one merchant's bad config/data) or
a systemic code bug. This helps you focus your investigation correctly:
- If data-specific → look for config validation code, data migration logic
- If systemic → look for the core processing code with the defect

Rules:
- Be precise. Search for class names, method names, specific field names — not generic words.
- Read a file fully before judging it irrelevant.
- Follow references: if you see a class imported or called, search for it next.
- Stop when you have found the actual code logic that could cause the reported behaviour.
- Maximum 12 tool calls total — be efficient.
"""

_FIX_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["is_valid_issue", "confidence", "root_cause", "target_repo",
                 "affected_files", "fix_description", "code_fix", "pr_title", "pr_body",
                 "data_analysis"],
    "properties": {
        "is_valid_issue":  {"type": "boolean"},
        "confidence":      {"type": "number"},
        "root_cause":      {"type": "string"},
        "target_repo":     {"type": "string", "enum": ["chargebee-app", "chargebee-ui"]},
        "affected_files":  {"type": "array", "items": {"type": "string"}},
        "fix_description": {"type": "string"},
        "code_fix": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "properties": {
                "file_path":        {"type": "string"},
                "original_snippet": {"type": "string"},
                "fixed_snippet":    {"type": "string"},
                "explanation":      {"type": "string"},
            },
            "required": ["file_path", "original_snippet", "fixed_snippet", "explanation"],
        },
        "pr_title": {"type": "string"},
        "pr_body":  {"type": "string"},
        "data_analysis": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "properties": {
                "is_data_specific":  {"type": "boolean"},
                "affected_scope":    {"type": "string"},
                "data_factors":      {"type": "array", "items": {"type": "string"}},
                "recommendation":    {"type": "string"},
            },
            "required": ["is_data_specific", "affected_scope", "data_factors", "recommendation"],
        },
    },
}


async def run(
    verified: dict,
    agent2: dict,
    jira_key: Optional[str] = None,
) -> Dict[str, Any]:
    settings = get_settings()
    api_key  = settings.openai_api_key
    if not api_key:
        return _error("OPENAI_API_KEY not configured")

    problem       = verified.get("problem_statement", "")
    areas         = ", ".join(a.get("name", "") for a in verified.get("related_product_areas", []))
    classification = agent2.get("classification", "")
    severity      = (verified.get("impact") or {}).get("severity_hint", "")

    issue_summary = (
        f"Classification : {classification}\n"
        f"Severity       : {severity}\n"
        f"Product Areas  : {areas}\n"
        f"Problem        : {problem}\n"
    )

    code_root = settings.local_code_root or ""

    # Step 0.5 — KB data validation (data-specific vs systemic)
    kb_result = await validate_data_vs_systemic(
        problem=problem,
        product_areas=areas,
        severity=severity,
        classification=classification,
        api_key=api_key,
    )
    kb_context = ""
    if not kb_result.get("error"):
        kb_context = (
            f"\n\nKB DATA ANALYSIS:\n"
            f"- Data-specific: {kb_result.get('is_data_specific')}\n"
            f"- Confidence: {kb_result.get('confidence')}%\n"
            f"- Affected scope: {kb_result.get('affected_scope')}\n"
            f"- Data factors: {', '.join(kb_result.get('data_factors', []))}\n"
            f"- Systemic factors: {', '.join(kb_result.get('systemic_factors', []))}\n"
            f"- Recommendation: {kb_result.get('recommendation')}\n"
        )
        issue_summary += kb_context

    # Step 1 — agent explores the codebase with tools
    fetched_files, code_context = await _explore_with_tools(
        issue_summary, code_root, api_key
    )

    if not code_context.strip():
        code_context = "(No relevant local code found — analysis based on issue description only)"

    # Step 2 — one structured call to produce the fix
    analysis = await _generate_fix(issue_summary, code_context, api_key)
    if "error" in analysis:
        return _error(analysis["error"])

    # Step 3 — raise draft PR in the correct repo
    pr_url = None
    if analysis.get("is_valid_issue"):
        pr_url = await _raise_pr(analysis, fetched_files, jira_key, settings)

    data_analysis = analysis.get("data_analysis")
    if not data_analysis and not kb_result.get("error"):
        data_analysis = {
            "is_data_specific": kb_result.get("is_data_specific"),
            "affected_scope": kb_result.get("affected_scope", "unknown"),
            "data_factors": kb_result.get("data_factors", []),
            "recommendation": kb_result.get("recommendation", ""),
        }

    return {
        "is_valid_issue":  analysis.get("is_valid_issue"),
        "confidence":      analysis.get("confidence", 0),
        "root_cause":      analysis.get("root_cause", ""),
        "affected_files":  analysis.get("affected_files", []),
        "fix_description": analysis.get("fix_description", ""),
        "pr_url":          pr_url,
        "pr_title":        analysis.get("pr_title", ""),
        "code_fix":        analysis.get("code_fix"),
        "data_analysis":   data_analysis,
        "error":           None,
    }


async def _explore_with_tools(
    issue_summary: str,
    code_root: str,
    api_key: str,
) -> Tuple[Dict[str, str], str]:
    """Run the OpenAI tool-calling loop so the model explores the codebase."""
    from openai import AsyncOpenAI, NotFoundError

    client = AsyncOpenAI(api_key=api_key)

    messages = [
        {"role": "system", "content": _SYSTEM_EXPLORE},
        {"role": "user",   "content": f"Find the code responsible for this bug:\n\n{issue_summary}"},
    ]

    fetched_files: Dict[str, str] = {}
    code_context = ""

    model = _AGENT_MODEL
    for attempt in range(2):
        try:
            for _ in range(12):
                resp = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=_TOOLS,
                    tool_choice="auto",
                )
                msg = resp.choices[0].message

                if not msg.tool_calls:
                    messages.append({"role": "assistant", "content": msg.content or ""})
                    break

                messages.append(msg)

                for tc in msg.tool_calls:
                    name = tc.function.name
                    args = json.loads(tc.function.arguments)

                    if name == "search_code":
                        result = _tool_search(args["query"], args.get("repo", "any"), code_root)
                    elif name == "read_file":
                        content = _tool_read(args["path"], code_root)
                        if content:
                            fetched_files[args["path"]] = content
                            code_context += f"\n\n--- {args['path']} ---\n{content}"
                        result = content[:4000] if content else "File not found"
                    elif name == "query_chargebee_kb":
                        result = await _tool_kb_query(args.get("question", ""), issue_summary, api_key)
                    else:
                        result = "Unknown tool"

                    messages.append({
                        "role":         "tool",
                        "tool_call_id": tc.id,
                        "content":      str(result)[:4000],
                    })
            break
        except NotFoundError:
            if attempt == 0:
                logger.warning("%s not available, falling back to %s", model, _FALLBACK_MODEL)
                model = _FALLBACK_MODEL
            else:
                logger.error("Neither %s nor %s available", _AGENT_MODEL, _FALLBACK_MODEL)
                break
        except Exception as e:
            logger.error("Tool loop error: %s", e)
            break

    return fetched_files, code_context


async def _generate_fix(issue_summary: str, code_context: str, api_key: str) -> dict:
    """Single structured call to generate the root-cause + fix JSON."""
    from openai import AsyncOpenAI, NotFoundError

    client = AsyncOpenAI(api_key=api_key)

    prompt = (
        "You found the following code while investigating this bug:\n\n"
        f"ISSUE:\n{issue_summary}\n\n"
        f"CODE FOUND:\n{code_context}\n\n"
        "Now produce a JSON analysis. Rules:\n"
        "- Only modify existing code. Never create new files or components.\n"
        "- original_snippet must be EXACT lines copied from the code above.\n"
        "- fixed_snippet changes only those lines — minimum diff.\n"
        "- target_repo: 'chargebee-ui' for .ts/.vue/.js files, 'chargebee-app' for .java/.groovy.\n"
        "- If the code found is not the actual bug source, set is_valid_issue=false.\n"
        "- IMPORTANT: Fill in the data_analysis field:\n"
        "  * is_data_specific: true if this issue only affects specific merchants due to their data/config\n"
        "  * affected_scope: 'single_merchant', 'few_merchants', 'all_merchants', or 'unknown'\n"
        "  * data_factors: list specific data/config issues that could cause this for one merchant\n"
        "  * recommendation: 'data_audit' if data-specific, 'code_fix' if systemic, or both\n"
        "  Set data_analysis to null only if you truly cannot determine."
    )

    model = _AGENT_MODEL
    for attempt in range(2):
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "fix_analysis", "strict": True, "schema": _FIX_SCHEMA},
                },
                max_completion_tokens=4096,
            )
            return json.loads(resp.choices[0].message.content or "{}")
        except NotFoundError:
            if attempt == 0:
                model = _FALLBACK_MODEL
            else:
                return _error("Model not available")
        except Exception as e:
            logger.error("Fix generation failed: %s", e)
            return _error(str(e))

    return _error("Fix generation failed")


async def _raise_pr(
    analysis: dict,
    fetched_files: Dict[str, str],
    jira_key: Optional[str],
    settings,
) -> Optional[str]:
    """Create branch, push patch, open draft PR in the correct repo."""
    try:
        pr_owner, pr_repo = _resolve_repo(analysis, fetched_files, settings)
        jira_slug = jira_key if jira_key else "fix"
        branch_name = f"fix/{jira_slug}"

        if not await github_service.create_branch(branch_name, owner=pr_owner, repo=pr_repo):
            raise RuntimeError(f"Could not create branch {branch_name}")

        pushed = False
        cf = analysis.get("code_fix") or {}

        if cf.get("file_path") and cf.get("original_snippet") and cf.get("fixed_snippet"):
            clean_path    = _strip_prefix(cf["file_path"], settings)
            original      = (
                fetched_files.get(cf["file_path"])
                or fetched_files.get(clean_path)
                or await github_service.get_file_content(clean_path, owner=pr_owner, repo=pr_repo)
                or ""
            )
            orig  = cf["original_snippet"].strip()
            fixed = cf["fixed_snippet"].strip()

            if orig and orig in original:
                patched = original.replace(orig, fixed, 1)
            else:
                lc = _comment_char(clean_path)
                patched = (
                    original.rstrip()
                    + f"\n\n{lc} AGENT-3 FIX [{jira_key}]\n"
                    + f"{lc} Root cause: {analysis.get('root_cause', '')}\n"
                    + f"{lc} Original:\n"
                    + "\n".join(f"{lc}   {l}" for l in orig.splitlines())
                    + f"\n{lc} Fix:\n"
                    + "\n".join(f"{lc}   {l}" for l in fixed.splitlines())
                    + "\n"
                )

            pushed = await github_service.push_file(
                branch_name, clean_path, patched,
                f"fix: {analysis.get('pr_title', jira_key)} [{jira_key}]",
                owner=pr_owner, repo=pr_repo,
            )

        if not pushed:
            md = _proposal_md(analysis, jira_key, fetched_files)
            proposal_filename = jira_key.lower().replace("-", "_") if jira_key else "fix"
            pushed = await github_service.push_file(
                branch_name, f"fix-proposals/{proposal_filename}.md", md,
                f"docs: fix proposal for {jira_key}",
                owner=pr_owner, repo=pr_repo,
            )

        if pushed:
            return await github_service.create_pull_request(
                branch_name=branch_name,
                title=analysis.get("pr_title") or f"fix: {jira_key}",
                body=analysis.get("pr_body") or _default_body(analysis, jira_key),
                draft=True,
                owner=pr_owner, repo=pr_repo,
            )
    except Exception as e:
        logger.error("PR creation failed: %s", e)
    return None


async def _tool_kb_query(question: str, issue_summary: str, api_key: str) -> str:
    """Query KB to determine if the issue is data-specific or systemic."""
    try:
        result = await validate_data_vs_systemic(
            problem=question,
            product_areas="",
            severity="",
            classification="",
            code_context=issue_summary,
            api_key=api_key,
        )
        if result.get("error"):
            return f"KB query failed: {result['error']}"
        return json.dumps({
            "is_data_specific": result.get("is_data_specific"),
            "confidence": result.get("confidence"),
            "reasoning": result.get("reasoning"),
            "data_factors": result.get("data_factors"),
            "systemic_factors": result.get("systemic_factors"),
            "recommendation": result.get("recommendation"),
            "affected_scope": result.get("affected_scope"),
        }, indent=2)
    except Exception as e:
        logger.error("KB query tool error: %s", e)
        return f"KB query error: {e}"


def _tool_search(query: str, repo_filter: str, code_root: str) -> str:
    """Execute a local code search and return a compact result list."""
    if not code_root or not os.path.isdir(code_root):
        return "LOCAL_CODE_ROOT not configured or not found"

    results: List[str] = []
    pattern = re.compile(re.escape(query), re.IGNORECASE)

    _UI_DIRS  = {"chargebee-ui"}
    _APP_DIRS = {"chargebee-app"}

    for repo_dir in sorted(os.listdir(code_root)):
        repo_path = os.path.join(code_root, repo_dir)
        if not os.path.isdir(repo_path):
            continue
        if repo_filter == "chargebee-ui"  and repo_dir not in _UI_DIRS:
            continue
        if repo_filter == "chargebee-app" and repo_dir not in _APP_DIRS:
            continue

        for dirpath, dirnames, filenames in os.walk(repo_path):
            dirnames[:] = [
                d for d in dirnames
                if d not in {"node_modules", ".git", "build", "dist", "target",
                             "__pycache__", "venv", ".gradle", "test", "tests",
                             "locales", "i18n", "resources", "assets"}
            ]
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in {".java", ".groovy", ".kt", ".scala",
                               ".ts", ".js", ".tsx", ".jsx", ".vue",
                               ".py", ".rb", ".go"}:
                    continue
                fpath = os.path.join(dirpath, fname)
                rel   = os.path.relpath(fpath, code_root)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    if pattern.search(content):
                        lines = content.splitlines()
                        m = pattern.search(content)
                        ln = content[:m.start()].count("\n")
                        preview = "\n".join(lines[max(0, ln-2):ln+6])
                        results.append(f"{rel}\n  ...\n{preview}\n  ...")
                        if len(results) >= 8:
                            return "\n\n".join(results)
                except Exception:
                    pass

    return "\n\n".join(results) if results else f"No results for '{query}'"


def _tool_read(path: str, code_root: str) -> Optional[str]:
    """Read a file from the local codebase."""
    if not code_root:
        return None
    full = os.path.join(code_root, path)
    if not os.path.isfile(full):
        for repo in os.listdir(code_root):
            candidate = os.path.join(code_root, repo, path)
            if os.path.isfile(candidate):
                full = candidate
                break
        else:
            return None
    try:
        with open(full, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return None


def _resolve_repo(analysis: dict, fetched_files: dict, settings) -> Tuple[str, str]:
    owner = settings.github_owner or "chargebee"
    _UI  = {".ts", ".tsx", ".js", ".jsx", ".vue", ".scss", ".css"}
    _APP = {".java", ".groovy", ".scala", ".kt", ".xml", ".gradle"}

    def ext(p: str) -> str:
        return ("." + p.rsplit(".", 1)[-1].lower()) if "." in p else ""

    hint = (analysis.get("target_repo") or "").strip().lower()
    if hint in ("chargebee-app", "chargebee-ui"):
        return owner, hint

    cf = (analysis.get("code_fix") or {}).get("file_path", "")
    if cf:
        e = ext(cf)
        if e in _UI:  return owner, "chargebee-ui"
        if e in _APP: return owner, "chargebee-app"

    for path in fetched_files:
        e = ext(path)
        if e in _UI:  return owner, "chargebee-ui"
        if e in _APP: return owner, "chargebee-app"

    return owner, settings.github_repo or "chargebee-app"


def _strip_prefix(path: str, settings) -> str:
    root = getattr(settings, "local_code_root", "") or ""
    if root and os.path.isdir(root):
        for name in os.listdir(root):
            if path.startswith(name + "/"):
                return path[len(name) + 1:]
    return path


def _comment_char(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {"py": "#", "rb": "#", "sh": "#", "yaml": "#", "yml": "#",
            "html": "<!--", "xml": "<!--"}.get(ext, "//")


def _proposal_md(analysis: dict, jira_key: Optional[str], fetched_files: dict) -> str:
    jira_url = f"https://mychargebee.atlassian.net/browse/{jira_key}" if jira_key else ""
    files_found = "\n".join(f"- `{p}`" for p in list(fetched_files)[:6])
    return (
        f"# Fix Proposal — {jira_key}\n\n"
        f"> Auto-generated by Agent-3\n\n"
        f"## Linked JIRA\n[{jira_key}]({jira_url})\n\n"
        f"## Root Cause\n{analysis.get('root_cause', 'N/A')}\n\n"
        f"## Proposed Fix\n{analysis.get('fix_description', 'N/A')}\n\n"
        f"## Files Examined\n{files_found or '_none_'}\n\n"
        f"## Affected Files\n"
        + "\n".join(f"- `{f}`" for f in analysis.get("affected_files", []))
        + "\n\n_Draft PR — AI-generated, manual review required._\n"
    )


def _default_body(analysis: dict, jira_key: Optional[str]) -> str:
    cf = analysis.get("code_fix") or {}
    return (
        f"## Summary\n{analysis.get('fix_description', '')}\n\n"
        f"## Root Cause\n{analysis.get('root_cause', '')}\n\n"
        f"## Changes\n`{cf.get('file_path', 'N/A')}` — {cf.get('explanation', '')}\n\n"
        f"## Linked JIRA\nhttps://mychargebee.atlassian.net/browse/{jira_key}\n\n"
        f"## Test Plan\n- [ ] Unit test reproducing the issue\n- [ ] Manual QA on staging\n\n"
        f"---\n_Draft PR — Agent-3 · review before merging_"
    )


def _error(msg: str) -> dict:
    return {
        "is_valid_issue": None, "confidence": 0, "root_cause": msg,
        "affected_files": [], "fix_description": "", "pr_url": None,
        "code_fix": None, "error": msg,
    }
