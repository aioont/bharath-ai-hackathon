"""
Run once to create the farmer_reminders table.
Usage: python scripts/create_reminders_table.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from app.core.config import settings
import psycopg2

DDL = """
CREATE TABLE IF NOT EXISTS farmer_reminders (
    id              BIGSERIAL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    user_email      TEXT        NOT NULL,
    title           TEXT        NOT NULL,
    body            TEXT        NOT NULL,
    reminder_type   TEXT        NOT NULL DEFAULT 'general',
    -- reminder_type: 'fertilizer' | 'irrigation' | 'pesticide' | 'harvest'
    --               | 'market_alert' | 'sowing' | 'general'
    commodity       TEXT,           -- for market_alert type
    target_price    NUMERIC(12,2),  -- for market_alert type
    price_direction TEXT,           -- 'above' | 'below'
    scheduled_at    TIMESTAMPTZ NOT NULL,
    sent_at         TIMESTAMPTZ,
    status          TEXT        NOT NULL DEFAULT 'pending',
    -- status: 'pending' | 'sent' | 'failed' | 'cancelled'
    raw_chat_text   TEXT,           -- original farmer message for audit
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user      ON farmer_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON farmer_reminders(scheduled_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_status    ON farmer_reminders(status);
"""

def main():
    # Prefer POOL_URL (works with RDS Proxy / pgBouncer); fall back to direct URL
    db_url = (
        os.getenv("DATABASE_POOL_URL")
        or os.getenv("DATABASE_URL")
        or settings.DATABASE_POOL_URL
        or settings.DATABASE_URL
    )
    print(f"Connecting to: {db_url.split('@')[-1].split('/')[0]}")
    conn = psycopg2.connect(db_url, connect_timeout=10)
    with conn:
        with conn.cursor() as cur:
            cur.execute(DDL)
    conn.close()
    print("✅  farmer_reminders table created (or already exists).")

if __name__ == "__main__":
    main()
