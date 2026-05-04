from __future__ import annotations

from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: UUID
    run_id: UUID
    filename: str


class DocumentResponse(BaseModel):
    id: UUID
    uploader_user_id: str
    filename: str
    mime_type: str
    extracted_text: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
