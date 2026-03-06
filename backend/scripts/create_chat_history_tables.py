"""
Create Chat History Tables for AgriSaarthi
===========================================
Stores multilingual chat conversations with audio files and efficient indexing.

Tables:
- chat_conversations: Conversation metadata (user, language, category)
- chat_messages: Individual messages with audio storage

Cost Optimization:
- Indexes for fast retrieval (avoid full table scans)
- Audio stored as base64 in DB (typical 20-50KB, cheaper than S3 for small files)
- TTL-based cleanup for old conversations (reduce storage costs)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import structlog
from datetime import datetime

logger = structlog.get_logger()

# ───────────────────────────────────────────────────────────────────────────────
# DATABASE SCHEMA
# ───────────────────────────────────────────────────────────────────────────────

CHAT_CONVERSATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    title TEXT,
    language VARCHAR(10) DEFAULT 'en',
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_uuid ON public.chat_conversations(conversation_uuid);
CREATE INDEX IF NOT EXISTS idx_conversations_category ON public.chat_conversations(category);

COMMENT ON TABLE public.chat_conversations IS 'Chat conversation sessions with metadata';
COMMENT ON COLUMN public.chat_conversations.conversation_uuid IS 'UUID for client-side reference';
COMMENT ON COLUMN public.chat_conversations.category IS 'general|crop_doctor|market|weather|schemes';
COMMENT ON COLUMN public.chat_conversations.metadata IS 'Additional context: farmer profile, location, etc.';
"""

CHAT_MESSAGES_TABLE = """
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Audio storage (Sarvam TTS)
    audio_base64 TEXT,
    audio_format VARCHAR(10) DEFAULT 'wav',
    audio_size_kb INTEGER,
    
    -- AI metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,
    confidence_score DECIMAL(3,2),
    
    -- Tool/function call tracking
    tool_calls JSONB,
    guardrail_result VARCHAR(20),
    
    -- Performance tracking
    response_time_ms INTEGER,
    
    -- Semantic caching
    message_hash VARCHAR(64),
    cached_response BOOLEAN DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.chat_messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_hash ON public.chat_messages(message_hash);

COMMENT ON TABLE public.chat_messages IS 'Individual chat messages with audio and metadata';
COMMENT ON COLUMN public.chat_messages.audio_base64 IS 'Base64-encoded WAV audio from Sarvam TTS (20-50KB typical)';
COMMENT ON COLUMN public.chat_messages.message_hash IS 'SHA256 hash for semantic caching and deduplication';
COMMENT ON COLUMN public.chat_messages.tool_calls IS 'JSON log of agent tool usage (SEARCH, WEATHER, MARKET, KNOWLEDGE)';
COMMENT ON COLUMN public.chat_messages.cached_response IS 'TRUE if response was served from ElastiCache';
"""

# Trigger to update conversation.updated_at and message_count
UPDATE_CONVERSATION_TRIGGER = """
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = NOW(),
        message_count = (
            SELECT COUNT(*) 
            FROM public.chat_messages 
            WHERE conversation_id = NEW.conversation_id
        )
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation ON public.chat_messages;
CREATE TRIGGER trigger_update_conversation
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();
"""

# View for chat history with user info
CHAT_HISTORY_VIEW = """
CREATE OR REPLACE VIEW chat_history_view AS
SELECT 
    c.id AS conversation_id,
    c.conversation_uuid,
    c.title,
    c.language,
    c.category,
    c.message_count,
    c.created_at AS conversation_started,
    c.updated_at AS last_message_at,
    u.email AS user_email,
    u.full_name AS user_name,
    (
        SELECT content 
        FROM public.chat_messages 
        WHERE conversation_id = c.id AND role = 'user'
        ORDER BY created_at ASC 
        LIMIT 1
    ) AS first_message,
    (
        SELECT content 
        FROM public.chat_messages 
        WHERE conversation_id = c.id
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS last_message
FROM public.chat_conversations c
LEFT JOIN public.users u ON c.user_id = u.id
WHERE c.is_archived = FALSE
ORDER BY c.updated_at DESC;

COMMENT ON VIEW chat_history_view IS 'Quick overview of all chat conversations';
"""

# ───────────────────────────────────────────────────────────────────────────────
# MIGRATION SCRIPT
# ───────────────────────────────────────────────────────────────────────────────

def create_chat_tables(db_url: str):
    """Create chat history tables and indexes."""
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        cur = conn.cursor()
        
        logger.info("Creating chat_conversations table...")
        cur.execute(CHAT_CONVERSATIONS_TABLE)
        
        logger.info("Creating chat_messages table...")
        cur.execute(CHAT_MESSAGES_TABLE)
        
        logger.info("Creating update trigger...")
        cur.execute(UPDATE_CONVERSATION_TRIGGER)
        
        logger.info("Creating chat_history_view...")
        cur.execute(CHAT_HISTORY_VIEW)
        
        conn.commit()
        logger.info("✅ Chat history tables created successfully!")
        
        # Verify tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('chat_conversations', 'chat_messages')
        """)
        tables = [row[0] for row in cur.fetchall()]
        logger.info("Verified tables:", tables=tables)
        
        # Show indexes
        cur.execute("""
            SELECT tablename, indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND tablename LIKE 'chat_%'
            ORDER BY tablename, indexname
        """)
        indexes = cur.fetchall()
        logger.info("Created indexes:", count=len(indexes))
        for table, index in indexes:
            print(f"  - {table}.{index}")
        
        cur.close()
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Failed to create chat tables:", error=str(e))
        raise
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Use DATABASE_POOL_URL for connection pooling (RDS/Supabase)
    db_url = os.getenv("DATABASE_POOL_URL") or os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ Error: DATABASE_URL or DATABASE_POOL_URL not set in .env")
        exit(1)
    
    print(f"🚀 Creating chat history tables...")
    print(f"📊 Database: {db_url.split('@')[-1].split('/')[0]}")  # Hide password
    print()
    
    create_chat_tables(db_url)
    
    print()
    print("=" * 70)
    print("✅ MIGRATION COMPLETE!")
    print("=" * 70)
    print()
    print("Next steps:")
    print("1. Restart your FastAPI backend")
    print("2. Chat history will be automatically saved to database")
    print("3. Use GET /api/chat/history to retrieve past conversations")
    print()
