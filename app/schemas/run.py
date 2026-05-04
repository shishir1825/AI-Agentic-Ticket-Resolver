from __future__ import annotations

from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

from app.schemas.artifact import ArtifactResponse


class JiraLinkResponse(BaseModel):
    jira_key: str
    jira_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RunResponse(BaseModel):
    id: UUID
    document_id: UUID
    status: str
    current_step: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RunDetailResponse(RunResponse):
    artifacts: List[ArtifactResponse] = []
    document_filename: Optional[str] = None
    jira: Optional[JiraLinkResponse] = None


class PaginatedRunsResponse(BaseModel):
    items: List[RunDetailResponse]
    total: int
    page: int
    per_page: int
    pages: int
