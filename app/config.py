from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://hackathon:hackathon@localhost:5432/cri_workflow"
    database_url_sync: str = "postgresql://hackathon:hackathon@localhost:5432/cri_workflow"

    upload_dir: str = "./uploads"

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "openai"

    atlassian_cloud_id: str = ""
    atlassian_site_url: str = ""
    atlassian_email: str = ""
    atlassian_api_token: str = ""
    jira_project_key: str = ""

    # GitHub integration (code analysis + PR)
    github_token: str = ""
    github_owner: str = ""
    github_repo: str = ""
    # Comma-separated extra repos to search: "owner/repo1,owner/repo2"
    github_extra_repos: str = ""
    # Local code base root for filesystem scanning (fallback when no GitHub)
    local_code_root: str = "/Users/prashantshukla/work"

    model_config = {"env_file": ".env", "extra": "ignore"}


def get_settings() -> Settings:
    """Always returns a fresh Settings instance so .env changes are picked up."""
    return Settings()
