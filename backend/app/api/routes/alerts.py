"""
Alert Preferences & Trigger REST API
=====================================
GET  /api/alerts/preferences        — fetch your alert settings
PATCH /api/alerts/preferences       — update your alert settings
POST  /api/alerts/test              — send a test email (verifies pipeline)
POST  /api/alerts/trigger/weather   — admin: run weather scan now
POST  /api/alerts/trigger/price     — admin: run price scan now
GET   /api/alerts/logs              — recent alert history for current user
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import require_current_user, _get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AlertPrefsOut(BaseModel):
    user_id: str
    weather_enabled: bool
    price_enabled: bool
    heavy_rain: bool
    heat_wave: bool
    frost_risk: bool
    strong_wind: bool
    price_spike_pct: float
    price_slump_pct: float


class AlertPrefsUpdate(BaseModel):
    weather_enabled: Optional[bool] = None
    price_enabled: Optional[bool] = None
    heavy_rain: Optional[bool] = None
    heat_wave: Optional[bool] = None
    frost_risk: Optional[bool] = None
    strong_wind: Optional[bool] = None
    price_spike_pct: Optional[float] = None   # e.g. 15  → alert when 15% above MSP
    price_slump_pct: Optional[float] = None   # e.g. 12


class TriggerResult(BaseModel):
    status: str
    users_alerted: int


# ---------------------------------------------------------------------------
# GET preferences
# ---------------------------------------------------------------------------

@router.get("/preferences", response_model=AlertPrefsOut)
async def get_alert_preferences(user_id: str = Depends(require_current_user)):
    from app.services.alert_service import get_or_create_prefs
    import asyncio
    prefs = await asyncio.to_thread(get_or_create_prefs, user_id)
    return AlertPrefsOut(
        user_id=str(prefs["user_id"]),
        weather_enabled=prefs["weather_enabled"],
        price_enabled=prefs["price_enabled"],
        heavy_rain=prefs["heavy_rain"],
        heat_wave=prefs["heat_wave"],
        frost_risk=prefs["frost_risk"],
        strong_wind=prefs["strong_wind"],
        price_spike_pct=float(prefs["price_spike_pct"]),
        price_slump_pct=float(prefs["price_slump_pct"]),
    )


# ---------------------------------------------------------------------------
# PATCH preferences
# ---------------------------------------------------------------------------

@router.patch("/preferences", response_model=AlertPrefsOut)
async def update_alert_preferences(
    body: AlertPrefsUpdate,
    user_id: str = Depends(require_current_user),
):
    from app.services.alert_service import update_prefs
    import asyncio
    updates = body.model_dump(exclude_none=True)
    prefs = await asyncio.to_thread(update_prefs, user_id, updates)
    return AlertPrefsOut(
        user_id=str(prefs["user_id"]),
        weather_enabled=prefs["weather_enabled"],
        price_enabled=prefs["price_enabled"],
        heavy_rain=prefs["heavy_rain"],
        heat_wave=prefs["heat_wave"],
        frost_risk=prefs["frost_risk"],
        strong_wind=prefs["strong_wind"],
        price_spike_pct=float(prefs["price_spike_pct"]),
        price_slump_pct=float(prefs["price_slump_pct"]),
    )


# ---------------------------------------------------------------------------
# POST /test — sends a test alert to the current user
# ---------------------------------------------------------------------------

@router.post("/test")
async def send_test_alert(user_id: str = Depends(require_current_user)):
    """Send a sample weather + price alert email to yourself."""
    # Fetch the user's email and name
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email, full_name FROM public.users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    email, full_name = row
    from app.services.alert_service import send_test_alert as _send_test
    await _send_test(user_id, email, full_name or "")
    return {"status": "ok", "message": f"Test alerts sent to {email}"}


# ---------------------------------------------------------------------------
# POST /trigger/weather — manually kick off weather scan (admin/demo)
# ---------------------------------------------------------------------------

@router.post("/trigger/weather", response_model=TriggerResult)
async def trigger_weather_scan(_user_id: str = Depends(require_current_user)):
    """
    Manually run the weather alert scan for all users.
    Useful for demos or testing without waiting for the scheduler.
    """
    from app.services.alert_service import run_weather_alert_scan
    alerted = await run_weather_alert_scan()
    return TriggerResult(status="completed", users_alerted=alerted)


# ---------------------------------------------------------------------------
# POST /trigger/price — manually kick off price scan (admin/demo)
# ---------------------------------------------------------------------------

@router.post("/trigger/price", response_model=TriggerResult)
async def trigger_price_scan(_user_id: str = Depends(require_current_user)):
    """
    Manually run the market price alert scan for all users.
    """
    from app.services.alert_service import run_price_alert_scan
    alerted = await run_price_alert_scan()
    return TriggerResult(status="completed", users_alerted=alerted)


# ---------------------------------------------------------------------------
# GET /logs — last 20 alert log entries for the current user
# ---------------------------------------------------------------------------

@router.get("/logs")
async def get_alert_logs(
    limit: int = 20,
    user_id: str = Depends(require_current_user),
):
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT alert_type, alert_key, sent_at
                   FROM public.alert_logs
                   WHERE user_id = %s
                   ORDER BY sent_at DESC
                   LIMIT %s""",
                (user_id, min(limit, 100)),
            )
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    return {
        "logs": [
            {
                "alert_type": r["alert_type"],
                "alert_key": r["alert_key"],
                "sent_at": r["sent_at"].isoformat() if r["sent_at"] else None,
            }
            for r in rows
        ]
    }
