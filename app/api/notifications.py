from __future__ import annotations

from uuid import UUID
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    run_id: str
    target_role: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    role: str = Query(..., description="Role to fetch notifications for"),
    unread: bool = Query(False, description="Only unread"),
    db: AsyncSession = Depends(get_db),
):
    notifs = await notification_service.get_notifications(db, role, unread_only=unread)
    return [
        NotificationResponse(
            id=str(n.id),
            run_id=str(n.run_id),
            target_role=n.target_role,
            title=n.title,
            message=n.message,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifs
    ]


@router.post("/{notification_id}/read")
async def read_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    ok = await notification_service.mark_read(db, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}


@router.post("/read-all")
async def read_all_notifications(
    role: str = Query(..., description="Role to mark all read for"),
    db: AsyncSession = Depends(get_db),
):
    count = await notification_service.mark_all_read(db, role)
    return {"status": "ok", "marked_read": count}
