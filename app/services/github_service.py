from __future__ import annotations

"""GitHub service — code search, branch creation, file push, PR creation."""

import logging
from typing import Optional, List, Dict, Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _headers() -> Dict[str, str]:
    token = get_settings().github_token
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _repo_coords(owner: Optional[str] = None, repo: Optional[str] = None):
    """Return (owner, repo), falling back to env defaults."""
    s = get_settings()
    return (owner or s.github_owner), (repo or s.github_repo)


class GitHubCredentialsMissing(Exception):
    pass


def _check_creds():
    s = get_settings()
    if not s.github_token or not s.github_owner or not s.github_repo:
        raise GitHubCredentialsMissing(
            "GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO must be set in backend/.env"
        )


async def search_code(
    query: str,
    max_results: int = 5,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Search code in the given (or default) repo using GitHub search API."""
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)
    full_query = f"{query} repo:{_owner}/{_repo}"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API}/search/code",
            params={"q": full_query, "per_page": max_results},
            headers=_headers(),
        )

    if resp.status_code != 200:
        logger.error("GitHub search failed %s: %s", resp.status_code, resp.text[:200])
        return []

    items = resp.json().get("items", [])
    results = []
    for item in items:
        results.append({
            "path": item["path"],
            "url": item["html_url"],
            "sha": item["sha"],
            "repo": item["repository"]["full_name"],
        })
    return results


async def get_file_content(
    path: str,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> Optional[str]:
    """Fetch raw content of a file from the given (or default) repo."""
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/contents/{path}",
            headers=_headers(),
        )

    if resp.status_code != 200:
        return None

    import base64
    data = resp.json()
    if data.get("encoding") == "base64":
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return data.get("content", "")


async def get_default_branch(
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> str:
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{GITHUB_API}/repos/{_owner}/{_repo}", headers=_headers())
    return resp.json().get("default_branch", "main")


async def create_branch(
    branch_name: str,
    from_branch: Optional[str] = None,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> bool:
    """Create a new branch from the default (or specified) branch."""
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)
    base = from_branch or await get_default_branch(_owner, _repo)

    # Get base branch SHA
    async with httpx.AsyncClient(timeout=15) as client:
        ref_resp = await client.get(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/git/ref/heads/{base}",
            headers=_headers(),
        )
        if ref_resp.status_code != 200:
            logger.error("Cannot get ref for %s: %s", base, ref_resp.text[:100])
            return False

        sha = ref_resp.json()["object"]["sha"]

        create_resp = await client.post(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": sha},
            headers=_headers(),
        )

    if create_resp.status_code in (200, 201):
        logger.info("Branch created: %s", branch_name)
        return True

    # Branch might already exist
    if create_resp.status_code == 422:
        logger.warning("Branch %s already exists", branch_name)
        return True

    logger.error("Branch creation failed: %s", create_resp.text[:200])
    return False


async def push_file(
    branch_name: str,
    file_path: str,
    content: str,
    commit_message: str,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> bool:
    """Create or update a file on a branch in the given (or default) repo."""
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)
    import base64

    encoded = base64.b64encode(content.encode()).decode()

    existing_sha: Optional[str] = None
    async with httpx.AsyncClient(timeout=20) as client:
        check = await client.get(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/contents/{file_path}",
            params={"ref": branch_name},
            headers=_headers(),
        )
        if check.status_code == 200:
            existing_sha = check.json().get("sha")

        body: Dict[str, Any] = {
            "message": commit_message,
            "content": encoded,
            "branch": branch_name,
        }
        if existing_sha:
            body["sha"] = existing_sha

        resp = await client.put(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/contents/{file_path}",
            json=body,
            headers=_headers(),
        )

    if resp.status_code in (200, 201):
        logger.info("File pushed: %s on %s/%s@%s", file_path, _owner, _repo, branch_name)
        return True
    logger.error("File push failed: %s", resp.text[:200])
    return False


async def create_pull_request(
    branch_name: str,
    title: str,
    body: str,
    base_branch: Optional[str] = None,
    draft: bool = True,
    owner: Optional[str] = None,
    repo: Optional[str] = None,
) -> Optional[str]:
    """Create a PR in the given (or default) repo and return the PR URL."""
    _check_creds()
    _owner, _repo = _repo_coords(owner, repo)
    base = base_branch or await get_default_branch(_owner, _repo)

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{_owner}/{_repo}/pulls",
            json={
                "title": title,
                "body": body,
                "head": branch_name,
                "base": base,
                "draft": draft,
            },
            headers=_headers(),
        )

    if resp.status_code in (200, 201):
        url = resp.json().get("html_url", "")
        logger.info("PR created in %s/%s: %s", _owner, _repo, url)
        return url

    logger.error("PR creation failed %s/%s %s: %s", _owner, _repo, resp.status_code, resp.text[:300])
    return None
