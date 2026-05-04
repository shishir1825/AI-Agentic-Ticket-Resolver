from __future__ import annotations

"""Local filesystem code search — scans repos under LOCAL_CODE_ROOT for relevant code."""

import os
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# File extensions to search
CODE_EXTS = {
    ".java", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".rb", ".go", ".scala", ".groovy", ".kt",
}

# Dirs to always skip
SKIP_DIRS = {
    "node_modules", ".git", "venv", "__pycache__", "target",
    "build", "dist", ".gradle", ".idea", "logs", "uploads",
    # Skip translation/locale files — they match keywords but aren't logic
    "locales", "locale", "i18n", "l10n", "translations", "translation",
    "lang", "languages", "resources", "assets", "static",
    "test", "tests", "__tests__", "spec", "specs", "fixtures",
    "vendor", "third_party", "thirdparty",
}

# Path segments that indicate a locale/string file — skip even if dir not caught
SKIP_PATH_SEGMENTS = {
    "/locales/", "/locale/", "/i18n/", "/l10n/", "/translations/",
    "/lang/", "/resources/strings", "/assets/",
}

# File name patterns to skip (locale, generated, vendor files)
SKIP_FILENAME_PATTERNS = {
    ".min.js", ".min.css", ".d.ts", ".map",
    "messages_", "strings_", "labels_",
}

# Max file size to read (bytes)
MAX_FILE_BYTES = 100_000


def _find_repos(root: str) -> List[str]:
    """Return immediate subdirectories of root that look like code repos."""
    if not os.path.isdir(root):
        return []
    repos = []
    for name in os.listdir(root):
        path = os.path.join(root, name)
        if os.path.isdir(path) and not name.startswith("."):
            # Heuristic: has source code files or common project files
            contents = set(os.listdir(path))
            if contents & {
                "pom.xml", "build.gradle", "package.json", "setup.py",
                "requirements.txt", "go.mod", "Makefile", "src", "app",
            }:
                repos.append(path)
    return repos


def _score_file(file_path: str, keywords: List[str]) -> int:
    """Return relevance score for a file path based on keyword matches."""
    path_lower = file_path.lower()
    score = 0
    for kw in keywords:
        if kw.lower() in path_lower:
            score += 2
    return score


def search_local_code(
    keywords: List[str],
    code_root: str,
    max_files: int = 6,
) -> List[Dict[str, Any]]:
    """
    Search local repos under code_root for files containing any keyword.
    Returns list of {path, snippet, repo} dicts.
    """
    repos = _find_repos(code_root)
    if not repos:
        # Maybe code_root itself is a repo
        repos = [code_root]

    logger.info("Searching %d local repos for: %s", len(repos), keywords)

    matches: List[Dict[str, Any]] = []
    seen_paths: set = set()

    pattern = re.compile(
        "|".join(re.escape(k) for k in keywords if k),
        re.IGNORECASE,
    )

    for repo_path in repos:
        repo_name = os.path.basename(repo_path)
        for dirpath, dirnames, filenames in os.walk(repo_path):
            # Prune skip dirs in-place
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in CODE_EXTS:
                    continue

                # Skip locale/generated/vendor files by name pattern
                fname_lower = fname.lower()
                if any(pat in fname_lower for pat in SKIP_FILENAME_PATTERNS):
                    continue

                fpath = os.path.join(dirpath, fname)
                rel_path = os.path.relpath(fpath, code_root)

                # Skip locale paths by segment
                rel_lower = rel_path.replace("\\", "/").lower()
                if any(seg.strip("/") in rel_lower.split("/") for seg in SKIP_PATH_SEGMENTS):
                    continue

                if rel_path in seen_paths:
                    continue

                try:
                    size = os.path.getsize(fpath)
                    if size > MAX_FILE_BYTES:
                        continue

                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    if pattern.search(content):
                        # Extract a relevant snippet (up to 60 lines around first match)
                        lines = content.splitlines()
                        match = pattern.search(content)
                        if match:
                            # Find line number of match
                            start_char = match.start()
                            line_no = content[:start_char].count("\n")
                            start = max(0, line_no - 5)
                            end = min(len(lines), line_no + 55)
                            snippet = "\n".join(lines[start:end])
                        else:
                            snippet = "\n".join(lines[:60])

                        matches.append({
                            "path": rel_path,
                            "repo": repo_name,
                            "full_path": fpath,
                            "snippet": snippet,
                            "score": _score_file(rel_path, keywords),
                        })
                        seen_paths.add(rel_path)

                        if len(matches) >= max_files * 3:
                            break
                except Exception:
                    continue

            if len(matches) >= max_files * 3:
                break

        if len(matches) >= max_files * 3:
            break

    # Sort by score (path keyword matches) and take top N
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:max_files]
