"""
Chat History Service with AWS ElastiCache Integration
======================================================
Handles persistent storage and retrieval of multilingual chat conversations.

Cost Optimization Strategy:
1. ElastiCache semantic caching - 60-80% reduction in AI API costs
2. Database connection pooling - Reduce RDS connection overhead
3. Batch operations - Minimize database round trips
4. Audio base64 storage - Cheaper than S3 for small files (<100KB)
5. Index optimization - Fast queries without full table scans

Performance Targets:
- Save message: <50ms
- Load conversation: <100ms (20 messages)
- Cache hit rate: >70% for common queries
"""

import hashlib
import json
import structlog
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from app.core.config import settings
from app.core.cache import cache_get, cache_set, generate_cache_key, semantic_hash, TTL_CONFIG
from app.models.schemas import ChatMessageModel, FarmerProfile

logger = structlog.get_logger()

# ───────────────────────────────────────────────────────────────────────────────
# DATABASE CONNECTION POOL (AWS RDS optimization)
# ───────────────────────────────────────────────────────────────────────────────

_db_pool: Optional[ThreadedConnectionPool] = None


def get_db_pool() -> Optional[ThreadedConnectionPool]:
    """Get database connection pool (lazy initialization)."""
    global _db_pool
    
    if _db_pool is not None:
        return _db_pool
    
    try:
        db_url = settings.DATABASE_POOL_URL or settings.DATABASE_URL
        if not db_url:
            logger.warning("no_database_url")
            return None
        
        # Create connection pool (min 2, max 10 connections)
        _db_pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=db_url
        )
        
        logger.info("db_pool_initialized", min=2, max=10)
        return _db_pool
        
    except Exception as e:
        logger.error("db_pool_init_failed", error=str(e))
        return None


def get_db_conn():
    """Get connection from pool."""
    pool = get_db_pool()
    if not pool:
        return None
    return pool.getconn()


def release_db_conn(conn):
    """Return connection to pool."""
    pool = get_db_pool()
    if pool and conn:
        pool.putconn(conn)


# ───────────────────────────────────────────────────────────────────────────────
# CHAT CONVERSATION MANAGEMENT
# ───────────────────────────────────────────────────────────────────────────────

async def create_conversation(
    user_id: str,  # UUID as string
    title: Optional[str] = None,
    language: str = "en",
    category: str = "general",
    metadata: Optional[Dict] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a new chat conversation.
    
    Returns:
        {
            "id": 123,
            "conversation_uuid": "uuid",
            "title": "Rice Cultivation Help",
            "language": "hi",
            "category": "general"
        }
    """
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            logger.warning("create_conversation_no_db")
            return None
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            INSERT INTO public.chat_conversations 
            (user_id, title, language, category, metadata)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, conversation_uuid::text as conversation_uuid, title, language, category, created_at
        """, (user_id, title, language, category, json.dumps(metadata or {})))
        
        result = cur.fetchone()
        conn.commit()
        cur.close()
        
        logger.info("conversation_created", 
                   conversation_id=result["id"], 
                   user_id=user_id, 
                   category=category)
        
        return dict(result)
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("create_conversation_failed", error=str(e), user_id=user_id)
        return None
    finally:
        if conn:
            release_db_conn(conn)


async def get_or_create_conversation(
    user_id: str,  # UUID as string
    conversation_uuid: Optional[str] = None,
    language: str = "en",
    category: str = "general"
) -> Optional[Dict[str, Any]]:
    """
    Get or create single conversation for user.
    Each user has ONE continuous conversation that persists all their chat history.
    """
    
    # Check if user already has a conversation
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            logger.warning("get_or_create_no_db")
            return None
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user's existing conversation (limit 1, ordered by most recent)
        cur.execute("""
            SELECT id, conversation_uuid::text as conversation_uuid, title, language, category, created_at
            FROM public.chat_conversations
            WHERE user_id = %s AND is_archived = FALSE
            ORDER BY updated_at DESC
            LIMIT 1
        """, (user_id,))
        
        existing = cur.fetchone()
        cur.close()
        
        if existing:
            logger.info("conversation_reused", conversation_id=existing["id"], user_id=user_id)
            return dict(existing)
        
    except Exception as e:
        logger.error("get_conversation_failed", error=str(e), user_id=user_id)
    finally:
        if conn:
            release_db_conn(conn)
    
    # No existing conversation - create new one
    title = f"AgriSaarthi Chat - {datetime.now().strftime('%b %d, %Y')}"
    return await create_conversation(
        user_id=user_id,
        title=title,
        language=language,
        category=category
    )


async def get_conversation_by_uuid(conversation_uuid: str) -> Optional[Dict]:
    """Get conversation by UUID."""
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            return None
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, conversation_uuid, user_id::text as user_id, title, language, category, 
                   created_at, updated_at, message_count, metadata
            FROM public.chat_conversations
            WHERE conversation_uuid = %s
        """, (conversation_uuid,))
        
        result = cur.fetchone()
        cur.close()
        
        return dict(result) if result else None
        
    except Exception as e:
        logger.error("get_conversation_failed", error=str(e), uuid=conversation_uuid)
        return None
    finally:
        if conn:
            release_db_conn(conn)


# ───────────────────────────────────────────────────────────────────────────────
# MESSAGE STORAGE WITH CACHING
# ───────────────────────────────────────────────────────────────────────────────

def _calculate_message_hash(content: str, language: str) -> str:
    """Calculate semantic hash for message deduplication and caching."""
    return semantic_hash(f"{language}:{content}")


async def save_message(
    conversation_id: int,
    role: str,
    content: str,
    language: str = "en",
    audio_base64: Optional[str] = None,
    audio_format: str = "wav",
    model_used: Optional[str] = None,
    tokens_used: int = 0,
    confidence_score: Optional[float] = None,
    tool_calls: Optional[List[Dict]] = None,
    guardrail_result: Optional[str] = None,
    response_time_ms: Optional[int] = None,
    cached_response: bool = False,
    metadata: Optional[Dict] = None
) -> Optional[int]:
    """
    Save a chat message to database.
    
    Returns:
        message_id (int) or None if failed
    """
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            logger.warning("save_message_no_db")
            return None
        
        cur = conn.cursor()
        
        # Calculate audio size
        audio_size_kb = None
        if audio_base64:
            audio_size_kb = len(audio_base64) // 1024
        
        # Calculate message hash for semantic caching
        message_hash = _calculate_message_hash(content, language)
        
        cur.execute("""
            INSERT INTO public.chat_messages (
                conversation_id, role, content, language,
                audio_base64, audio_format, audio_size_kb,
                model_used, tokens_used, confidence_score,
                tool_calls, guardrail_result, response_time_ms,
                message_hash, cached_response, metadata
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            conversation_id, role, content, language,
            audio_base64, audio_format, audio_size_kb,
            model_used, tokens_used, confidence_score,
            json.dumps(tool_calls or []),
            guardrail_result,
            response_time_ms,
            message_hash,
            cached_response,
            json.dumps(metadata or {})
        ))
        
        message_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        
        logger.info("message_saved", 
                   message_id=message_id,
                   conversation_id=conversation_id, 
                   role=role, 
                   has_audio=bool(audio_base64),
                   cached=cached_response)
        
        return message_id
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("save_message_failed", error=str(e), conversation_id=conversation_id)
        return None
    finally:
        if conn:
            release_db_conn(conn)


async def get_conversation_messages(
    conversation_id: int,
    limit: int = 50,
    include_audio: bool = False
) -> List[Dict]:
    """
    Get all messages in a conversation.
    
    Args:
        conversation_id: Conversation ID
        limit: Max messages to retrieve
        include_audio: Include audio_base64 in results (set False to reduce payload)
    
    Returns:
        List of message dicts ordered by created_at ASC
    """
    # Try cache first
    cache_key = f"conversation_messages:{conversation_id}:{limit}:{include_audio}"
    cached = await cache_get(cache_key)
    if cached:
        logger.debug("conversation_cache_hit", conversation_id=conversation_id)
        return json.loads(cached)
    
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            return []
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Select columns based on include_audio flag
        audio_cols = "audio_base64, audio_format," if include_audio else "NULL as audio_base64, audio_format,"
        
        cur.execute(f"""
            SELECT 
                id, role, content, language, created_at,
                {audio_cols}
                model_used, tokens_used, confidence_score,
                tool_calls, cached_response
            FROM public.chat_messages
            WHERE conversation_id = %s
            ORDER BY created_at ASC
            LIMIT %s
        """, (conversation_id, limit))
        
        messages = [dict(row) for row in cur.fetchall()]
        cur.close()
        
        # Cache for 5 minutes (conversation might still be active)
        await cache_set(cache_key, json.dumps(messages, default=str), ttl=300)
        
        logger.info("messages_retrieved", 
                   conversation_id=conversation_id, 
                   count=len(messages),
                   include_audio=include_audio)
        
        return messages
        
    except Exception as e:
        logger.error("get_messages_failed", error=str(e), conversation_id=conversation_id)
        return []
    finally:
        if conn:
            release_db_conn(conn)


async def get_user_conversations(
    user_id: str,  # UUID as string
    limit: int = 20,
    offset: int = 0,
    category: Optional[str] = None
) -> List[Dict]:
    """Get list of user's conversations."""
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            return []
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if category:
            cur.execute("""
                SELECT id, conversation_uuid::text as conversation_uuid, title, language, category,
                       message_count, created_at, updated_at
                FROM public.chat_conversations
                WHERE user_id = %s AND category = %s AND is_archived = FALSE
                ORDER BY updated_at DESC
                LIMIT %s OFFSET %s
            """, (user_id, category, limit, offset))
        else:
            cur.execute("""
                SELECT id, conversation_uuid::text as conversation_uuid, title, language, category,
                       message_count, created_at, updated_at
                FROM public.chat_conversations
                WHERE user_id = %s AND is_archived = FALSE
                ORDER BY updated_at DESC
                LIMIT %s OFFSET %s
            """, (user_id, limit, offset))
        
        conversations = [dict(row) for row in cur.fetchall()]
        cur.close()
        
        logger.info("conversations_retrieved", user_id=user_id, count=len(conversations))
        
        return conversations
        
    except Exception as e:
        logger.error("get_conversations_failed", error=str(e), user_id=user_id)
        return []
    finally:
        if conn:
            release_db_conn(conn)


# ───────────────────────────────────────────────────────────────────────────────
# SEMANTIC CACHING FOR AI RESPONSES (COST OPTIMIZATION)
# ───────────────────────────────────────────────────────────────────────────────

async def get_cached_ai_response(
    message: str,
    language: str,
    category: str
) -> Optional[Dict]:
    """
    Check if we have a cached response for a semantically similar query.
    Major cost savings - avoid redundant AI API calls.
    
    Returns:
        {
            "response": "...",
            "audio_base64": "...",
            "confidence": 0.95
        }
    """
    try:
        # Generate semantic cache key
        msg_hash = _calculate_message_hash(message, language)
        cache_key = f"ai_response:{category}:{language}:{msg_hash}"
        
        cached = await cache_get(cache_key)
        if cached:
            logger.info("ai_response_cache_hit", 
                       category=category, 
                       language=language,
                       message_preview=message[:50])
            return json.loads(cached)
        
        return None
        
    except Exception as e:
        logger.warning("cache_check_failed", error=str(e))
        return None


async def cache_ai_response(
    message: str,
    language: str,
    category: str,
    response: str,
    audio_base64: Optional[str] = None,
    confidence: float = 0.95
):
    """
    Cache AI response for future queries.
    TTL: 6 hours for general, 24 hours for schemes/static content.
    """
    try:
        msg_hash = _calculate_message_hash(message, language)
        cache_key = f"ai_response:{category}:{language}:{msg_hash}"
        
        cache_data = {
            "response": response,
            "audio_base64": audio_base64,
            "confidence": confidence,
            "cached_at": datetime.now().isoformat()
        }
        
        # Different TTLs based on category
        ttl = TTL_CONFIG.get("insurance_schemes", 21600) if category == "schemes" else 21600
        
        await cache_set(cache_key, json.dumps(cache_data), ttl=ttl)
        
        logger.debug("ai_response_cached", category=category, ttl=ttl)
        
    except Exception as e:
        logger.warning("cache_set_failed", error=str(e))


# ───────────────────────────────────────────────────────────────────────────────
# ANALYTICS & MONITORING
# ───────────────────────────────────────────────────────────────────────────────

async def get_chat_analytics(user_id: Optional[str] = None, days: int = 7) -> Dict:
    """Get chat usage analytics for cost monitoring."""
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            return {}
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        since = datetime.now() - timedelta(days=days)
        
        if user_id:
            cur.execute("""
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(DISTINCT conversation_id) as conversations,
                    SUM(tokens_used) as total_tokens,
                    SUM(CASE WHEN cached_response THEN 1 ELSE 0 END) as cached_responses,
                    SUM(audio_size_kb) as total_audio_kb,
                    AVG(response_time_ms) as avg_response_time_ms
                FROM public.chat_messages cm
                JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
                WHERE cc.user_id = %s AND cm.created_at >= %s
            """, (user_id, since))
        else:
            cur.execute("""
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(DISTINCT conversation_id) as conversations,
                    SUM(tokens_used) as total_tokens,
                    SUM(CASE WHEN cached_response THEN 1 ELSE 0 END) as cached_responses,
                    SUM(audio_size_kb) as total_audio_kb,
                    AVG(response_time_ms) as avg_response_time_ms
                FROM public.chat_messages
                WHERE created_at >= %s
            """, (since,))
        
        result = cur.fetchone()
        cur.close()
        
        analytics = dict(result) if result else {}
        
        # Calculate cache hit rate
        if analytics.get("total_messages", 0) > 0:
            analytics["cache_hit_rate"] = round(
                (analytics.get("cached_responses", 0) / analytics["total_messages"]) * 100, 
                2
            )
        
        return analytics
        
    except Exception as e:
        logger.error("get_analytics_failed", error=str(e))
        return {}
    finally:
        if conn:
            release_db_conn(conn)


async def archive_conversation(conversation_id: int) -> bool:
    """
    Archive a conversation by setting is_archived to TRUE.
    This effectively clears it from active conversations.
    
    Returns:
        True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_db_conn()
        if not conn:
            logger.warning("archive_conversation_no_db")
            return False
        
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE public.chat_conversations
            SET is_archived = TRUE, updated_at = NOW()
            WHERE id = %s
        """, (conversation_id,))
        
        affected = cur.rowcount
        conn.commit()
        cur.close()
        
        logger.info("conversation_archived", conversation_id=conversation_id)
        
        return affected > 0
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("archive_conversation_failed", error=str(e), conversation_id=conversation_id)
        return False
    finally:
        if conn:
            release_db_conn(conn)
