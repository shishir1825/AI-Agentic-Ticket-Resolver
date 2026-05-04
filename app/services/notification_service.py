from __future__ import annotations

import logging
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)

TRANSITION_NOTIFICATIONS = {
    "awaiting_uploader": [
        {"role": "gtm", "title": "Document extracted", "message": "AI extraction complete — ready for your review"},
    ],
    "running_agent2": [
        {"role": "pm", "title": "GTM approved", "message": "GTM approved the extraction — classification in progress"},
    ],
    "awaiting_pm": [
        {"role": "pm", "title": "Classification complete", "message": "Agent-2 classified and prioritized — ready for your review"},
    ],
    "creating_jira": [
        {"role": "gtm", "title": "PM approved", "message": "PM approved — JIRA ticket being created"},
        {"role": "engineering", "title": "PM approved", "message": "PM approved — JIRA ticket being created"},
    ],
    "awaiting_code_fix": [
        {"role": "engineering", "title": "JIRA created", "message": "JIRA ticket created — ready for AutoResolve"},
    ],
    "awaiting_eng_review": [
        {"role": "engineering", "title": "AutoResolve complete", "message": "Code analysis done — fix ready for engineer review"},
    ],
    "awaiting_em_signoff": [
        {"role": "engineering", "title": "Engineer approved", "message": "Engineer approved the fix — awaiting EM sign-off"},
    ],
    "done": [
        {"role": "gtm", "title": "Issue resolved", "message": "EM signed off — issue is fully resolved"},
        {"role": "pm", "title": "Issue resolved", "message": "EM signed off — issue is fully resolved"},
        {"role": "engineering", "title": "Issue resolved", "message": "EM signed off — issue is fully resolved"},
    ],
    "failed": [
        {"role": "admin", "title": "Run failed", "message": "A workflow run has failed and needs attention"},
    ],
}

STEP_TO_LINK = {
    "awaiting_uploader": "/review",
    "running_agent2": "/pm-review",
    "awaiting_pm": "/pm-review",
    "creating_jira": "/jira-board",
    "awaiting_code_fix": "/code-fix",
    "awaiting_eng_review": "/engineer-review",
    "awaiting_em_signoff": "/em-signoff",
    "done": "/timeline",
    "failed": "/timeline",
}


async def emit_notifications(_db: Optional[AsyncSession], run_id: UUID, new_status: str, doc_filename: Optional[str] = None) -> None:
    """Create notifications using an independent session to avoid corrupting the caller's session."""
    templates = TRANSITION_NOTIFICATIONS.get(new_status, [])
    if not templates:
        return

    base_link = STEP_TO_LINK.get(new_status, "/timeline")
    suffix = "" if doc_filename is None else f" — {doc_filename}"

    from app.database import async_session
    try:
        async with async_session() as notif_db:
            for tmpl in templates:
                notif = Notification(
                    run_id=run_id,
                    target_role=tmpl["role"],
                    title=tmpl["title"],
                    message=tmpl["message"] + suffix,
                    link=f"{base_link}/{run_id}" if base_link not in ("/jira-board", "/timeline") else base_link,
                )
                notif_db.add(notif)
            await notif_db.commit()
    except Exception as e:
        logger.error("Failed to emit notifications for run %s: %s", run_id, e)


async def get_notifications(db: AsyncSession, role: str, unread_only: bool = False, limit: int = 50) -> List[Notification]:
    stmt = select(Notification).where(Notification.target_role == role)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def mark_read(db: AsyncSession, notification_id: UUID) -> bool:
    result = await db.execute(
        update(Notification).where(Notification.id == notification_id).values(is_read=True)
    )
    await db.commit()
    return result.rowcount > 0


async def mark_all_read(db: AsyncSession, role: str) -> int:
    result = await db.execute(
        update(Notification).where(Notification.target_role == role, Notification.is_read == False).values(is_read=True)
    )
    await db.commit()
    return result.rowcount
