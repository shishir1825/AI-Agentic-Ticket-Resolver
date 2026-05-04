from __future__ import annotations

from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.run import Run
from app.schemas.run import RunResponse, RunDetailResponse, JiraLinkResponse, PaginatedRunsResponse
from app.schemas.artifact import ArtifactResponse

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _build_run_detail(run: Run) -> RunDetailResponse:
    jira = JiraLinkResponse.model_validate(run.jira_link) if run.jira_link else None
    artifacts = sorted(run.artifacts, key=lambda a: a.created_at)
    return RunDetailResponse(
        id=run.id,
        document_id=run.document_id,
        status=run.status,
        current_step=run.current_step,
        error_message=run.error_message,
        created_at=run.created_at,
        updated_at=run.updated_at,
        artifacts=[ArtifactResponse.model_validate(a) for a in artifacts],
        document_filename=run.document.filename if run.document else None,
        jira=jira,
    )


@router.get("", response_model=PaginatedRunsResponse)
async def list_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    base = select(Run).options(
        selectinload(Run.document),
        selectinload(Run.jira_link),
        selectinload(Run.artifacts),
    )

    count_base = select(func.count(Run.id))

    if status:
        base = base.where(Run.status == status)
        count_base = count_base.where(Run.status == status)

    if search:
        from app.models.document import Document
        base = base.join(Run.document).where(Document.filename.ilike(f"%{search}%"))
        count_base = count_base.join(Run.document).where(Document.filename.ilike(f"%{search}%"))

    total_result = await db.execute(count_base)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    result = await db.execute(
        base.order_by(Run.created_at.desc()).offset(offset).limit(per_page)
    )
    runs = result.scalars().all()

    return PaginatedRunsResponse(
        items=[_build_run_detail(run) for run in runs],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if per_page else 1,
    )


@router.get("/{run_id}", response_model=RunDetailResponse)
async def get_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run)
        .where(Run.id == run_id)
        .options(
            selectinload(Run.artifacts),
            selectinload(Run.document),
            selectinload(Run.jira_link),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return _build_run_detail(run)
