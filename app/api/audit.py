from __future__ import annotations

"""Audit trail endpoints — full lineage for a run."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.run import Run
from app.models.approval import Approval
from app.models.jira_link import JiraLink

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/{run_id}")
async def get_audit_trail(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run)
        .where(Run.id == run_id)
        .options(
            selectinload(Run.artifacts),
            selectinload(Run.approvals),
            selectinload(Run.jira_link),
            selectinload(Run.document),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    artifacts = sorted(
        [
            {
                "id": str(a.id),
                "version": a.version,
                "stage": a.stage,
                "created_by": a.created_by,
                "created_at": a.created_at.isoformat(),
                "payload_keys": list(a.json_payload.keys()) if a.json_payload else [],
            }
            for a in run.artifacts
        ],
        key=lambda x: x["version"],
    )

    approvals = [
        {
            "id": str(a.id),
            "stage": a.stage,
            "approved_by": a.approved_by,
            "approved_at": a.approved_at.isoformat(),
            "comments": a.comments,
        }
        for a in run.approvals
    ]

    jira = None
    if run.jira_link:
        jira = {
            "jira_key": run.jira_link.jira_key,
            "jira_url": run.jira_link.jira_url,
            "created_at": run.jira_link.created_at.isoformat(),
        }

    return {
        "run_id": str(run.id),
        "document": {
            "id": str(run.document.id),
            "filename": run.document.filename,
            "uploaded_by": run.document.uploader_user_id,
            "uploaded_at": run.document.created_at.isoformat(),
        },
        "status": run.status,
        "current_step": run.current_step,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
        "artifacts": artifacts,
        "approvals": approvals,
        "jira": jira,
    }
