"""One-time migration: add phone column to users table."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
from app.core.config import settings
import psycopg2

conn = psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)
cur = conn.cursor()
cur.execute("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;")
conn.commit()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;")
cols = [r[0] for r in cur.fetchall()]
print("Columns:", cols)
cur.close()
conn.close()
print("Migration done.")
