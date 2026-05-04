from __future__ import annotations

"""Run state machine: manages step transitions and guards."""

import logging
from typing import Optional, Dict
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.run import Run

logger = logging.getLogger(__name__)

TRANSITIONS: Dict[str, Dict[str, str]] = {
    "processing": {"agent1_done": "awaiting_uploader", "fail": "failed"},
    "awaiting_uploader": {"uploader_approved": "running_agent2", "uploader_rejected": "failed", "fail": "failed"},
    "running_agent2": {"agent2_done": "awaiting_pm", "fail": "failed"},
    "awaiting_pm": {"pm_approved": "creating_jira", "pm_rejected": "awaiting_uploader", "fail": "failed"},
    "creating_jira": {"jira_created": "awaiting_code_fix", "fail": "failed"},
    "awaiting_code_fix": {"code_analyzed": "awaiting_eng_review", "fail": "failed"},
    "awaiting_eng_review": {"eng_approved": "awaiting_em_signoff", "eng_rejected": "awaiting_code_fix", "fail": "failed"},
    "awaiting_em_signoff": {"em_signed_off": "done", "em_rejected": "awaiting_eng_review", "fail": "failed"},
}

STEP_MAP = {
    "processing": "agent1",
    "awaiting_uploader": "uploader_review",
    "running_agent2": "agent2",
    "awaiting_pm": "pm_review",
    "creating_jira": "jira",
    "awaiting_code_fix": "code_fix",
    "awaiting_eng_review": "eng_review",
    "awaiting_em_signoff": "em_signoff",
    "done": "done",
    "failed": "failed",
}


async def get_run(db: AsyncSession, run_id: UUID) -> Optional[Run]:
    result = await db.execute(select(Run).where(Run.id == run_id))
    return result.scalar_one_or_none()


async def transition(db: AsyncSession, run: Run, event: str) -> Run:
    allowed = TRANSITIONS.get(run.status, {})
    next_status = allowed.get(event)
    if next_status is None:
        raise ValueError(f"Invalid transition: {run.status} + {event}. Allowed events: {list(allowed.keys())}")
    run.status = next_status
    run.current_step = STEP_MAP.get(next_status, next_status)
    db.add(run)
    await db.commit()
    await db.refresh(run)

    _schedule_notifications(run.id, next_status)

    return run


async def fail_run(db: AsyncSession, run: Run, error_msg: str) -> Run:
    run.status = "failed"
    run.current_step = "failed"
    run.error_message = error_msg
    db.add(run)
    await db.commit()
    await db.refresh(run)

    _schedule_notifications(run.id, "failed")

    return run


def _schedule_notifications(run_id: UUID, new_status: str) -> None:
    """Fire-and-forget notification emission in a background task."""
    import asyncio

    async def _emit():
        from app.services.notification_service import emit_notifications
        from app.database import async_session
        from sqlalchemy.orm import selectinload
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(Run).where(Run.id == run_id).options(selectinload(Run.document))
                )
                fresh = result.scalar_one_or_none()
                doc_filename = fresh.document.filename if fresh and fresh.document else None
            await emit_notifications(None, run_id, new_status, doc_filename)
        except Exception as e:
            logger.warning("Notification emission failed for run %s: %s", run_id, e)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_emit())
    except RuntimeError:
        pass
