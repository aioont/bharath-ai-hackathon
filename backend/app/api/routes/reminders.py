"""
Reminders REST API
==================
POST   /api/reminders           — create a reminder manually
GET    /api/reminders           — list user's reminders
DELETE /api/reminders/{id}      — cancel a reminder
POST   /api/reminders/dispatch  — admin: fire due reminders now (testing)
"""
from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.routes.auth import require_current_user, _get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reminders", tags=["Reminders"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ReminderCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=2000)
    scheduled_at: datetime
    reminder_type: str = "general"
    commodity: Optional[str] = None
    target_price: Optional[float] = None
    price_direction: Optional[str] = None   # 'above' | 'below'


class ReminderOut(BaseModel):
    id: int
    user_id: str
    title: str
    body: str
    reminder_type: str
    commodity: Optional[str]
    target_price: Optional[float]
    price_direction: Optional[str]
    scheduled_at: datetime
    sent_at: Optional[datetime]
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Helper: get user email from DB
# ---------------------------------------------------------------------------

def _get_user_email(user_id: str) -> str:
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM users WHERE id=%s LIMIT 1", (user_id,))
            row = cur.fetchone()
        conn.close()
        return row[0] if row else ""
    except Exception as exc:
        logger.warning("get_user_email_failed: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# POST /api/reminders  — manual creation
# ---------------------------------------------------------------------------

@router.post("", response_model=ReminderOut, status_code=201)
async def create_reminder_endpoint(
    body: ReminderCreateRequest,
    user: dict = Depends(require_current_user),
):
    from app.services.reminder_service import create_reminder
    user_id = user["id"]
    user_email = _get_user_email(user_id)
    if not user_email:
        raise HTTPException(
            status_code=422,
            detail="No email on file. Please update your profile to receive reminders.",
        )
    row = create_reminder(
        user_id=user_id,
        user_email=user_email,
        title=body.title,
        body=body.body,
        scheduled_at=body.scheduled_at,
        reminder_type=body.reminder_type,
        commodity=body.commodity,
        target_price=body.target_price,
        price_direction=body.price_direction,
    )
    return row


# ---------------------------------------------------------------------------
# GET /api/reminders
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ReminderOut])
async def list_reminders_endpoint(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_current_user),
):
    from app.services.reminder_service import list_reminders
    return list_reminders(user["id"], limit=limit)


# ---------------------------------------------------------------------------
# DELETE /api/reminders/{id}
# ---------------------------------------------------------------------------

@router.delete("/{reminder_id}", status_code=204)
async def cancel_reminder_endpoint(
    reminder_id: int,
    user: dict = Depends(require_current_user),
):
    from app.services.reminder_service import cancel_reminder
    cancelled = cancel_reminder(reminder_id, user["id"])
    if not cancelled:
        raise HTTPException(status_code=404, detail="Reminder not found or already sent/cancelled.")


# ---------------------------------------------------------------------------
# POST /api/reminders/dispatch  (admin / testing)
# ---------------------------------------------------------------------------

@router.post("/dispatch")
async def dispatch_reminders(user: dict = Depends(require_current_user)):
    """Manually trigger the reminder dispatch job (useful for testing)."""
    from app.services.reminder_service import dispatch_due_reminders
    import asyncio
    sent = await asyncio.to_thread(dispatch_due_reminders)
    return {"status": "ok", "reminders_sent": sent}
