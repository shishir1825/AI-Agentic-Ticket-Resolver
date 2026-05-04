from __future__ import annotations

"""Endpoint to fetch JIRA ticket history directly from Atlassian REST API."""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(prefix="/api/jira", tags=["jira"])
logger = logging.getLogger(__name__)


@router.get("/history")
async def get_jira_history(max_results: int = 200):
    """Fetch all tickets from the configured JIRA project via Atlassian REST API (with pagination)."""
    settings = get_settings()
    site_url = settings.atlassian_site_url.rstrip("/")
    email = settings.atlassian_email
    token = settings.atlassian_api_token
    project_key = settings.jira_project_key

    if not email or not token or not site_url or not project_key:
        return {"error": "Atlassian credentials not configured — set ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, ATLASSIAN_SITE_URL in backend/.env", "issues": []}

    jql = f"project = {project_key} ORDER BY created DESC"
    url = f"{site_url}/rest/api/2/search"
    all_issues = []
    start_at = 0
    page_size = 100

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            while len(all_issues) < max_results:
                resp = await client.get(
                    url,
                    params={
                        "jql": jql,
                        "startAt": start_at,
                        "maxResults": min(page_size, max_results - len(all_issues)),
                        "fields": "summary,status,issuetype,priority,created,updated,assignee,labels,description",
                    },
                    auth=(email, token),
                    headers={"Accept": "application/json"},
                )

                if resp.status_code != 200:
                    logger.error("JIRA history fetch failed %s: %s", resp.status_code, resp.text[:300])
                    return {"error": f"JIRA API returned {resp.status_code}", "issues": all_issues}

                data = resp.json()
                page_issues = data.get("issues", [])

                for issue in page_issues:
                    fields = issue.get("fields", {})
                    all_issues.append({
                        "key":        issue["key"],
                        "url":        f"{site_url}/browse/{issue['key']}",
                        "summary":    fields.get("summary", ""),
                        "status":     fields.get("status", {}).get("name", ""),
                        "issue_type": fields.get("issuetype", {}).get("name", ""),
                        "priority":   fields.get("priority", {}).get("name", ""),
                        "created":    (fields.get("created") or "")[:10],
                        "updated":    (fields.get("updated") or "")[:10],
                        "assignee":   (fields.get("assignee") or {}).get("displayName", "Unassigned"),
                        "labels":     fields.get("labels", []),
                    })

                total = data.get("total", 0)
                start_at += len(page_issues)
                if start_at >= total or not page_issues:
                    break

        return {"issues": all_issues, "total": len(all_issues)}

    except httpx.TimeoutException:
        logger.error("JIRA history request timed out")
        return {"error": "JIRA API request timed out — please try again", "issues": all_issues}
    except Exception as e:
        logger.error("JIRA history error: %s", e)
        return {"error": str(e), "issues": all_issues}
