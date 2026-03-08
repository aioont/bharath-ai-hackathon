"""
Reminder Service — stores reminders in PostgreSQL and delivers them via Resend.
=================================================================================

Reminder lifecycle:
  1. Agent calls `schedule_reminder(...)` during chat→ row inserted (status=pending)
  2. APScheduler runs `dispatch_due_reminders()` every minute
  3. Due rows → Resend email → status updated to 'sent' / 'failed'

Reminder types supported:
  • fertilizer / irrigation / pesticide / harvest / sowing  — date-based farm tasks
  • market_alert  — fire when commodity price crosses a threshold
  • general        — any other reminder (free-form)

ReAct agent capabilities baked in:
  • THINK   — extract intent / structured data from raw chat text
  • PLAN    — decide which reminder type, validate required fields
  • ACT     — persist to DB and confirm back to farmer
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
import re

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB helpers (reuse connection pool from chat_service if available)
# ---------------------------------------------------------------------------

def _get_conn():
    try:
        from app.services.chat_service import get_db_conn
        conn = get_db_conn()
        if conn:
            return conn, True   # (conn, from_pool)
    except Exception:
        pass
    db_url = settings.DATABASE_POOL_URL or settings.DATABASE_URL
    return psycopg2.connect(db_url, connect_timeout=10), False


def _release(conn, from_pool: bool):
    try:
        if from_pool:
            from app.services.chat_service import release_db_conn
            release_db_conn(conn)
        else:
            conn.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def create_reminder(
    user_id: str,
    user_email: str,
    title: str,
    body: str,
    scheduled_at: datetime,
    reminder_type: str = "general",
    commodity: Optional[str] = None,
    target_price: Optional[float] = None,
    price_direction: Optional[str] = None,
    raw_chat_text: Optional[str] = None,
) -> dict:
    """Insert a new reminder row and return it."""
    conn, from_pool = _get_conn()
    try:
        with conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO farmer_reminders
                        (user_id, user_email, title, body, reminder_type,
                         commodity, target_price, price_direction,
                         scheduled_at, raw_chat_text)
                    VALUES
                        (%s,%s,%s,%s,%s, %s,%s,%s, %s,%s)
                    RETURNING *
                    """,
                    (user_id, user_email, title, body, reminder_type,
                     commodity, target_price, price_direction,
                     scheduled_at, raw_chat_text),
                )
                row = dict(cur.fetchone())
        logger.info("reminder_created id=%s type=%s scheduled=%s",
                    row["id"], reminder_type, scheduled_at)
        return row
    finally:
        _release(conn, from_pool)


def list_reminders(user_id: str, limit: int = 20) -> list[dict]:
    conn, from_pool = _get_conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM farmer_reminders
                WHERE user_id = %s
                ORDER BY scheduled_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        _release(conn, from_pool)


def cancel_reminder(reminder_id: int, user_id: str) -> bool:
    conn, from_pool = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE farmer_reminders
                    SET status='cancelled'
                    WHERE id=%s AND user_id=%s AND status='pending'
                    """,
                    (reminder_id, user_id),
                )
                return cur.rowcount > 0
    finally:
        _release(conn, from_pool)


# ---------------------------------------------------------------------------
# Email delivery via Resend
# ---------------------------------------------------------------------------

def _render_email_html(title: str, body: str, reminder_type: str) -> str:
    emoji_map = {
        "fertilizer": "🌱", "irrigation": "💧", "pesticide": "🐛",
        "harvest": "🌾", "sowing": "🌱", "market_alert": "📈", "general": "📅",
    }
    icon = emoji_map.get(reminder_type, "📅")
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a,#15803d);
                     padding:32px 40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">{icon}</div>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;
                       letter-spacing:-0.5px;">AgriSaarthi Reminder</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
              Your personal farming assistant
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#15803d;font-size:20px;">{title}</h2>
            <div style="background:#f0fdf4;border-left:4px solid #22c55e;
                        border-radius:8px;padding:20px 24px;margin-bottom:24px;">
              <p style="margin:0;color:#374151;font-size:16px;line-height:1.6;">
                {body}
              </p>
            </div>
            <p style="color:#6b7280;font-size:13px;margin:0;">
              This reminder was set via your AgriSaarthi AI Agent conversation.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;
                     border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              AgriSaarthi — AI-powered multilingual farming assistant for Indian farmers.<br>
              Reply to this email or open the app to manage your reminders.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _send_reminder_email(user_email: str, title: str, body: str, reminder_type: str) -> bool:
    """Send email via Resend SDK v2. Returns True on success."""
    if not settings.RESEND_API_KEY:
        logger.warning("resend_api_key_not_set — skipping email for %s", user_email)
        return False
    try:
        import resend  # type: ignore
        resend.api_key = settings.RESEND_API_KEY
        html = _render_email_html(title, body, reminder_type)
        resp = resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [user_email],
            "subject": f"🌾 Reminder: {title}",
            "html": html,
        })
        email_id = resp.get("id") if isinstance(resp, dict) else getattr(resp, "id", None)
        logger.info("resend_email_sent id=%s to=%s", email_id, user_email)
        return True
    except Exception as exc:
        logger.error("resend_email_failed to=%s error=%s", user_email, exc)
        return False


# ---------------------------------------------------------------------------
# Scheduler job — runs every minute via APScheduler
# ---------------------------------------------------------------------------

def dispatch_due_reminders() -> int:
    """
    Fetch all pending reminders whose scheduled_at <= NOW(),
    send email for each, update status.  Returns count sent.
    """
    conn, from_pool = _get_conn()
    sent = 0
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM farmer_reminders
                WHERE status = 'pending'
                  AND scheduled_at <= NOW()
                ORDER BY scheduled_at
                LIMIT 50
                """
            )
            due = [dict(r) for r in cur.fetchall()]

        for row in due:
            ok = _send_reminder_email(
                row["user_email"], row["title"], row["body"], row["reminder_type"]
            )
            new_status = "sent" if ok else "failed"
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE farmer_reminders SET status=%s, sent_at=NOW() WHERE id=%s",
                        (new_status, row["id"]),
                    )
            if ok:
                sent += 1
                logger.info("reminder_dispatched id=%s email=%s", row["id"], row["user_email"])
            else:
                logger.warning("reminder_failed id=%s email=%s", row["id"], row["user_email"])

        return sent
    except Exception as exc:
        logger.error("dispatch_due_reminders_error: %s", exc)
        return 0
    finally:
        _release(conn, from_pool)


# ---------------------------------------------------------------------------
# Market-price alert check (runs every 2 h alongside existing price scan)
# ---------------------------------------------------------------------------

async def check_market_price_alerts() -> int:
    """
    For reminders of type='market_alert' (still pending, scheduled_at in future),
    check current price vs target and fire email immediately if threshold crossed.
    """
    conn, from_pool = _get_conn()
    fired = 0
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM farmer_reminders
                WHERE status='pending' AND reminder_type='market_alert'
                  AND commodity IS NOT NULL AND target_price IS NOT NULL
                """
            )
            alerts = [dict(r) for r in cur.fetchall()]

        for alert in alerts:
            try:
                from app.services.market_service import _fetch_from_agmarknet
                from app.services.agmarknet_filters_service import load_agmarknet_filters
                filters = load_agmarknet_filters()
                commodity_id = None
                for c in filters.get("data", {}).get("cmdt_data", []):
                    if alert["commodity"].lower() in c.get("cmdt_name", "").lower():
                        commodity_id = c["cmdt_id"]
                        break
                if not commodity_id:
                    continue

                records = await _fetch_from_agmarknet(commodity_id=commodity_id, state_id=100000)
                if not records:
                    continue

                modal_prices = [float(r["modal_price"]) for r in records if r.get("modal_price")]
                if not modal_prices:
                    continue
                avg_price = sum(modal_prices) / len(modal_prices)
                target = float(alert["target_price"])
                direction = alert.get("price_direction", "above")

                triggered = (
                    (direction == "above" and avg_price >= target) or
                    (direction == "below" and avg_price <= target)
                )
                if not triggered:
                    continue

                body = (
                    f"{alert['commodity'].title()} price is now ₹{avg_price:.0f}/quintal "
                    f"(avg across markets) — your alert was set for "
                    f"₹{target:.0f} ({direction}). "
                    f"Good time to {'sell' if direction == 'above' else 'buy'}!"
                )
                ok = _send_reminder_email(
                    alert["user_email"], alert["title"], body, "market_alert"
                )
                if ok:
                    with conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE farmer_reminders SET status='sent', sent_at=NOW() WHERE id=%s",
                                (alert["id"],),
                            )
                    fired += 1
            except Exception as exc:
                logger.warning("market_alert_check_error id=%s: %s", alert["id"], exc)

        return fired
    finally:
        _release(conn, from_pool)
