from __future__ import annotations

from datetime import datetime
from uuid import UUID
from typing import Any, Dict
from pydantic import BaseModel


class ArtifactResponse(BaseModel):
    id: UUID
    run_id: UUID
    version: int
    stage: str
    json_payload: Dict[str, Any]
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}
