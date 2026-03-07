"""
Autonomous Background Alert Agent
==================================
Runs on a schedule (via APScheduler started in main.py) to:

  1. Weather Monitor  — checks Open-Meteo for each registered user's
     location and fires an alert email on:
       • Heavy rain   (rainfall > 40 mm/day or thunderstorm / heavy-rain code)
       • Heat wave    (temp_max ≥ 42 °C)
       • Frost risk   (temp_min ≤ 4 °C)
       • Strong wind  (wind_speed > 40 km/h)

  2. Price Monitor   — compares AGMARKNET / demo prices for the user's
     registered crops against the commodity MSP baseline and fires an
     alert email on:
       • Spike   (> 15 % above baseline  → good time to sell)
       • Slump   (< 12 % below baseline  → hold / distress-sale risk)

Deduplication: a `alert_logs` table tracks every sent alert; duplicates
within the cooldown window (6 h weather, 12 h price) are suppressed.

Public API (called by the scheduler in main.py):
    await run_weather_alert_scan()
    await run_price_alert_scan()

Users can manage their preferences via /api/alerts/* endpoints.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn():
    import psycopg2
    import psycopg2.extras
    return psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)


def ensure_alert_tables():
    """Create alert_preferences and alert_logs tables if they don't yet exist."""
    ddl = """
    CREATE TABLE IF NOT EXISTS public.alert_preferences (
        user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        weather_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        price_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
        -- individual weather toggles
        heavy_rain      BOOLEAN NOT NULL DEFAULT TRUE,
        heat_wave       BOOLEAN NOT NULL DEFAULT TRUE,
        frost_risk      BOOLEAN NOT NULL DEFAULT TRUE,
        strong_wind     BOOLEAN NOT NULL DEFAULT TRUE,
        -- price spike thresholds (percentage, e.g. 15 = 15%)
        price_spike_pct NUMERIC(5,1) NOT NULL DEFAULT 15.0,
        price_slump_pct NUMERIC(5,1) NOT NULL DEFAULT 12.0,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.alert_logs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        alert_type  TEXT NOT NULL,   -- 'weather' | 'price'
        alert_key   TEXT NOT NULL,   -- e.g. 'heavy_rain:delhi' or 'price_spike:wheat'
        sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_alert_logs_user_key
        ON public.alert_logs(user_id, alert_key, sent_at);
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(ddl)
            conn.commit()
        logger.info("alert tables ready")
    except Exception as exc:
        logger.warning("alert table setup failed: %s", exc)


try:
    ensure_alert_tables()
except Exception:
    pass


# ---------------------------------------------------------------------------
# Preference helpers
# ---------------------------------------------------------------------------

def get_or_create_prefs(user_id: str) -> dict:
    """Return the user's alert preferences (creating defaults if absent)."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM public.alert_preferences WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                cols = [d[0] for d in cur.description]
                return dict(zip(cols, row))
            # Insert defaults
            cur.execute(
                """INSERT INTO public.alert_preferences (user_id)
                   VALUES (%s) ON CONFLICT DO NOTHING""",
                (user_id,),
            )
            conn.commit()
            cur.execute(
                "SELECT * FROM public.alert_preferences WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))


def update_prefs(user_id: str, updates: dict) -> dict:
    """Patch the user's alert preferences."""
    allowed = {
        "weather_enabled", "price_enabled",
        "heavy_rain", "heat_wave", "frost_risk", "strong_wind",
        "price_spike_pct", "price_slump_pct",
    }
    clean = {k: v for k, v in updates.items() if k in allowed}
    if not clean:
        return get_or_create_prefs(user_id)
    # Ensure row exists
    get_or_create_prefs(user_id)
    set_clause = ", ".join(f"{k} = %({k})s" for k in clean)
    clean["user_id"] = user_id
    clean["now"] = datetime.now(timezone.utc)
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE public.alert_preferences SET {set_clause}, updated_at = %(now)s "
                f"WHERE user_id = %(user_id)s",
                clean,
            )
            conn.commit()
    return get_or_create_prefs(user_id)


# ---------------------------------------------------------------------------
# Cooldown / deduplication
# ---------------------------------------------------------------------------

def _already_sent(user_id: str, alert_key: str, cooldown_hours: int) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=cooldown_hours)
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT 1 FROM public.alert_logs
                   WHERE user_id = %s AND alert_key = %s AND sent_at > %s
                   LIMIT 1""",
                (user_id, alert_key, cutoff),
            )
            return cur.fetchone() is not None


def _log_sent(user_id: str, alert_type: str, alert_key: str):
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO public.alert_logs (user_id, alert_type, alert_key)
                   VALUES (%s, %s, %s)""",
                (user_id, alert_type, alert_key),
            )
            conn.commit()


# ---------------------------------------------------------------------------
# Fetch all users eligible for alerts
# ---------------------------------------------------------------------------

def _get_alert_users() -> list[dict]:
    """
    Return every verified user who has a location set and has at least one
    alert type enabled (or no preferences row yet → defaults = all ON).
    """
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id, u.email, u.full_name, u.state, u.district,
                    COALESCE(ap.weather_enabled, TRUE)  AS weather_enabled,
                    COALESCE(ap.price_enabled,   TRUE)  AS price_enabled,
                    COALESCE(ap.heavy_rain,      TRUE)  AS heavy_rain,
                    COALESCE(ap.heat_wave,       TRUE)  AS heat_wave,
                    COALESCE(ap.frost_risk,      TRUE)  AS frost_risk,
                    COALESCE(ap.strong_wind,     TRUE)  AS strong_wind,
                    COALESCE(ap.price_spike_pct, 15.0)  AS price_spike_pct,
                    COALESCE(ap.price_slump_pct, 12.0)  AS price_slump_pct
                FROM public.users u
                LEFT JOIN public.alert_preferences ap ON ap.user_id = u.id
                WHERE u.is_verified = TRUE
                  AND (u.state IS NOT NULL OR u.district IS NOT NULL)
                  AND (
                      COALESCE(ap.weather_enabled, TRUE) = TRUE OR
                      COALESCE(ap.price_enabled,   TRUE) = TRUE
                  )
                """
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def _get_user_crops(user_id: str) -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT crop_name, area_acres, is_primary
                   FROM public.farmer_crops
                   WHERE user_id = %s""",
                (user_id,),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# Email sender (Resend)
# ---------------------------------------------------------------------------

async def _send_email(to_email: str, subject: str, html: str):
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping alert email to %s", to_email)
        logger.info("[DEV] Subject: %s", subject)
        return

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": "AgriSaarthi Alerts <send@makeasite.in>",
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
        )
    if resp.status_code not in (200, 201):
        logger.error("Resend error %s: %s", resp.status_code, resp.text[:200])
    else:
        logger.info("alert_email_sent to=%s subject=%s", to_email, subject)


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------

def _weather_email_html(
    name: str,
    location: str,
    alerts: list[dict],   # list of {icon, title, body, severity}
    forecast_snippet: str,
) -> str:
    alert_blocks = ""
    for a in alerts:
        color = "#dc2626" if a["severity"] == "high" else "#d97706"
        border = "#fca5a5" if a["severity"] == "high" else "#fcd34d"
        alert_blocks += f"""
        <div style="border-left:4px solid {border};background:#fff;padding:12px 16px;
                    border-radius:6px;margin:10px 0;">
          <p style="margin:0;font-weight:bold;color:{color}">{a['icon']} {a['title']}</p>
          <p style="margin:4px 0 0;color:#374151;font-size:14px">{a['body']}</p>
        </div>"""

    return f"""
<div style="font-family:sans-serif;max-width:560px;margin:auto;
            background:#f0fdf4;border-radius:12px;overflow:hidden">
  <div style="background:#166534;padding:20px 24px;">
    <h2 style="color:#fff;margin:0">🌾 AgriSaarthi — Weather Alert</h2>
    <p style="color:#bbf7d0;margin:4px 0 0;font-size:14px">Autonomous Farm Monitor</p>
  </div>
  <div style="padding:24px">
    <p>Hello <strong>{name}</strong>,</p>
    <p>Our weather agent has detected the following alerts for
       <strong>{location}</strong>:</p>
    {alert_blocks}
    <div style="background:#fff;border-radius:8px;padding:12px 16px;
                margin-top:16px;border:1px solid #d1fae5">
      <p style="margin:0;color:#6b7280;font-size:12px">📅 {forecast_snippet}</p>
    </div>
    <p style="margin-top:20px;font-size:13px;color:#6b7280">
      You are receiving this because you have weather alerts enabled in AgriSaarthi.
      <br>Manage preferences at <a href="https://agrisaarthi.app/profile"
         style="color:#166534">agrisaarthi.app/profile</a>.
    </p>
  </div>
</div>"""


def _price_email_html(
    name: str,
    alerts: list[dict],   # list of {crop, direction, price, baseline, pct, advice}
) -> str:
    alert_blocks = ""
    for a in alerts:
        if a["direction"] == "spike":
            color, icon, label = "#166534", "📈", "Price Spike"
            bg = "#f0fdf4"
        else:
            color, icon, label = "#b45309", "📉", "Price Slump"
            bg = "#fffbeb"

        alert_blocks += f"""
        <div style="background:{bg};border-radius:8px;padding:14px;margin:10px 0;
                    border:1px solid #d1fae5">
          <p style="margin:0;font-weight:bold;color:{color}">{icon} {a['crop']} — {label}</p>
          <p style="margin:6px 0 0;font-size:14px;color:#374151">
            Current price: <strong>₹{a['price']}/q</strong> &nbsp;|&nbsp;
            Baseline: ₹{a['baseline']}/q &nbsp;|&nbsp;
            Change: {a['pct']:+.1f}%
          </p>
          <p style="margin:6px 0 0;font-size:13px;color:#6b7280">{a['advice']}</p>
        </div>"""

    return f"""
<div style="font-family:sans-serif;max-width:560px;margin:auto;
            background:#fffbeb;border-radius:12px;overflow:hidden">
  <div style="background:#92400e;padding:20px 24px;">
    <h2 style="color:#fff;margin:0">🌾 AgriSaarthi — Market Alert</h2>
    <p style="color:#fde68a;margin:4px 0 0;font-size:14px">Autonomous Price Monitor</p>
  </div>
  <div style="padding:24px">
    <p>Hello <strong>{name}</strong>,</p>
    <p>Our market agent has detected significant price movements
       for your registered crops:</p>
    {alert_blocks}
    <p style="margin-top:20px;font-size:13px;color:#6b7280">
      You are receiving this because you have price alerts enabled in AgriSaarthi.
      <br>Manage preferences at <a href="https://agrisaarthi.app/profile"
         style="color:#92400e">agrisaarthi.app/profile</a>.
    </p>
  </div>
</div>"""


# ---------------------------------------------------------------------------
# Weather alert detection
# ---------------------------------------------------------------------------

# WMO codes that classify as heavy-rain or thunderstorm
_HEAVY_CODES = {55, 65, 82, 95, 96, 99}

async def _check_weather_for_user(user: dict) -> list[dict]:
    """
    Fetch 3-day forecast for the user's location and return a list of
    triggered alert dicts.  Returns [] if nothing to flag.
    """
    location = user.get("district") or user.get("state") or ""
    if not location:
        return []

    try:
        from app.services.weather_service import get_weather_forecast
        data = await get_weather_forecast(location, language="en", days=3)
    except Exception as exc:
        logger.warning("weather_fetch_failed user=%s: %s", user["id"], exc)
        return []

    triggered: list[dict] = []

    days_to_check = [data.get("current", {})] + data.get("forecast", [])[:2]
    for day in days_to_check:
        if not day:
            continue
        rain    = day.get("rainfall", 0) or 0
        wind    = day.get("wind_speed", 0) or 0
        tmax    = day.get("temperature", {}).get("max", 25) or 25
        tmin    = day.get("temperature", {}).get("min", 15) or 15
        cond    = day.get("condition", "")
        date    = day.get("date", "today")

        if user.get("heavy_rain") and (rain > 40 or cond in ("heavy-rain", "thunderstorm")):
            triggered.append({
                "key": f"heavy_rain:{location.lower()}:{date}",
                "icon": "🌧️",
                "title": f"Heavy Rain — {date}",
                "body": (
                    f"Expected rainfall: {rain:.0f} mm. "
                    "Avoid field operations. Clear drainage channels."
                ),
                "severity": "high",
            })

        if user.get("heat_wave") and tmax >= 42:
            triggered.append({
                "key": f"heat_wave:{location.lower()}:{date}",
                "icon": "🌡️",
                "title": f"Heat Wave — {date}",
                "body": (
                    f"Max temperature: {tmax}°C. "
                    "Irrigate early morning/evening. Shade sensitive crops."
                ),
                "severity": "high",
            })

        if user.get("frost_risk") and tmin <= 4:
            triggered.append({
                "key": f"frost_risk:{location.lower()}:{date}",
                "icon": "❄️",
                "title": f"Frost Risk — {date}",
                "body": (
                    f"Min temperature: {tmin}°C. "
                    "Cover frost-sensitive crops overnight. Avoid irrigation before nightfall."
                ),
                "severity": "high",
            })

        if user.get("strong_wind") and wind > 40:
            triggered.append({
                "key": f"strong_wind:{location.lower()}:{date}",
                "icon": "💨",
                "title": f"Strong Wind — {date}",
                "body": (
                    f"Wind speed: {wind:.0f} km/h. "
                    "Avoid aerial spraying. Secure standing crops and farm structures."
                ),
                "severity": "medium",
            })

    return triggered


# ---------------------------------------------------------------------------
# Price alert detection
# ---------------------------------------------------------------------------

# MSP baselines (₹/quintal) — updated for 2024-25
_MSP = {
    "wheat": 2275, "rice": 2300, "paddy": 2300, "maize": 2090,
    "cotton": 7121, "soybean": 4892, "soybeans": 4892,
    "groundnut": 6783, "mustard": 5650, "sunflower": 7280,
    "sugarcane": 340, "jowar": 3371, "bajra": 2500,
    "arhar": 7550, "tur": 7550, "moong": 8558, "urad": 7400,
    "chana": 5440, "chickpea": 5440, "lentil": 6425, "masoor": 6425,
    "onion": 800,   "tomato": 800,  "potato": 1400,
    "banana": 1000, "mango": 5000,  "millet": 2500,
    "turmeric": 9000, "chilli": 12000,
}

# Live-ish price simulation with realistic variance
# In production you'd call _fetch_from_agmarknet() or a live commodity API
def _get_simulated_price(crop_name: str) -> Optional[float]:
    import random, hashlib, time
    key = crop_name.lower().strip()
    base = _MSP.get(key)
    if base is None:
        # Try partial match
        for k, v in _MSP.items():
            if k in key or key in k:
                base = v
                break
    if base is None:
        return None
    # Seed the random by (crop_name + hour-of-day) for stable per-run values
    seed = int(hashlib.md5(f"{key}{int(time.time()//3600)}".encode()).hexdigest(), 16) % 10000
    rng = random.Random(seed)
    multiplier = rng.uniform(0.80, 1.25)   # ±20% swing from MSP
    return round(base * multiplier, 0)


async def _check_prices_for_user(user: dict, crops: list[dict]) -> list[dict]:
    triggered: list[dict] = []
    spike_pct = float(user.get("price_spike_pct") or 15.0)
    slump_pct = float(user.get("price_slump_pct") or 12.0)

    for crop in crops:
        name = crop.get("crop_name", "")
        if not name:
            continue
        price = _get_simulated_price(name)
        if price is None:
            continue
        key = name.lower().strip()
        baseline = _MSP.get(key) or next(
            (v for k, v in _MSP.items() if k in key or key in k), None
        )
        if not baseline:
            continue

        pct = (price - baseline) / baseline * 100

        if pct >= spike_pct:
            triggered.append({
                "key": f"price_spike:{key}",
                "crop": name.title(),
                "direction": "spike",
                "price": int(price),
                "baseline": baseline,
                "pct": pct,
                "advice": (
                    f"Prices are {pct:.1f}% above MSP (₹{baseline}/q). "
                    "Consider selling soon — prices may correct."
                ),
            })
        elif pct <= -slump_pct:
            triggered.append({
                "key": f"price_slump:{key}",
                "crop": name.title(),
                "direction": "slump",
                "price": int(price),
                "baseline": baseline,
                "pct": pct,
                "advice": (
                    f"Prices are {abs(pct):.1f}% below MSP (₹{baseline}/q). "
                    "Avoid distress sale — store if possible or check PM-AASHA scheme."
                ),
            })

    return triggered


# ---------------------------------------------------------------------------
# Main scan functions (called by APScheduler)
# ---------------------------------------------------------------------------

async def run_weather_alert_scan():
    """Scan weather for all users and send alert emails where needed."""
    logger.info("weather_alert_scan_start")
    users = await asyncio.to_thread(_get_alert_users)
    sent = 0

    for user in users:
        if not user.get("weather_enabled"):
            continue
        email = user.get("email")
        name  = user.get("full_name") or email.split("@")[0] if email else "Farmer"
        location = user.get("district") or user.get("state") or "India"

        try:
            all_alerts = await _check_weather_for_user(user)
        except Exception as exc:
            logger.error("weather_check_error user=%s: %s", user.get("id"), exc)
            continue

        # Filter already-sent (6-hour cooldown per alert_key)
        new_alerts = []
        for a in all_alerts:
            if not await asyncio.to_thread(_already_sent, user["id"], a["key"], 6):
                new_alerts.append(a)

        if not new_alerts:
            continue

        # Build forecast snippet
        forecast_snippet = f"3-day outlook for {location} as of {datetime.now().strftime('%d %b %Y')}"

        html = _weather_email_html(name, location, new_alerts, forecast_snippet)
        subject = f"⚠️ Weather Alert for {location} — AgriSaarthi"
        await _send_email(email, subject, html)

        # Log every sent alert key
        for a in new_alerts:
            await asyncio.to_thread(_log_sent, user["id"], "weather", a["key"])

        sent += 1

    logger.info("weather_alert_scan_done users_alerted=%d", sent)
    return sent


async def run_price_alert_scan():
    """Scan market prices for all users' crops and send alert emails."""
    logger.info("price_alert_scan_start")
    users = await asyncio.to_thread(_get_alert_users)
    sent = 0

    for user in users:
        if not user.get("price_enabled"):
            continue
        email = user.get("email")
        name  = user.get("full_name") or email.split("@")[0] if email else "Farmer"

        try:
            crops = await asyncio.to_thread(_get_user_crops, user["id"])
        except Exception as exc:
            logger.error("crops_fetch_error user=%s: %s", user.get("id"), exc)
            continue

        if not crops:
            continue

        try:
            all_alerts = await _check_prices_for_user(user, crops)
        except Exception as exc:
            logger.error("price_check_error user=%s: %s", user.get("id"), exc)
            continue

        # Filter already-sent (12-hour cooldown per crop)
        new_alerts = []
        for a in all_alerts:
            if not await asyncio.to_thread(_already_sent, user["id"], a["key"], 12):
                new_alerts.append(a)

        if not new_alerts:
            continue

        html = _price_email_html(name, new_alerts)
        subject = f"📊 Market Alert for your crops — AgriSaarthi"
        await _send_email(email, subject, html)

        for a in new_alerts:
            await asyncio.to_thread(_log_sent, user["id"], "price", a["key"])

        sent += 1

    logger.info("price_alert_scan_done users_alerted=%d", sent)
    return sent


# ---------------------------------------------------------------------------
# Test helper (called from /api/alerts/test)
# ---------------------------------------------------------------------------

async def send_test_alert(user_id: str, email: str, full_name: str):
    """Send one dummy alert of each type to verify the pipeline works."""
    name = full_name or email.split("@")[0]

    weather_html = _weather_email_html(
        name=name,
        location="Test Location",
        alerts=[
            {
                "icon": "🌧️", "severity": "high",
                "title": "Heavy Rain — TEST",
                "body": "This is a test weather alert. Everything is working correctly!",
            },
            {
                "icon": "🌡️", "severity": "high",
                "title": "Heat Wave — TEST",
                "body": "Simulated 44°C heat wave. Real alerts will fire automatically.",
            },
        ],
        forecast_snippet="Test alert sent on " + datetime.now().strftime("%d %b %Y %H:%M"),
    )
    await _send_email(email, "✅ Test Weather Alert — AgriSaarthi", weather_html)

    price_html = _price_email_html(
        name=name,
        alerts=[
            {
                "crop": "Wheat (TEST)", "direction": "spike",
                "price": 2650, "baseline": 2275, "pct": 16.5,
                "advice": "This is a test price alert. Real alerts check your registered crops.",
            }
        ],
    )
    await _send_email(email, "✅ Test Market Alert — AgriSaarthi", price_html)
    logger.info("test_alerts_sent to=%s", email)
