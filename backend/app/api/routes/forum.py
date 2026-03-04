from __future__ import annotations
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.models.schemas import ForumPost, ForumPostDetail, VoteResponse
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forum", tags=["Community Forum"])

# ---------------------------------------------------------------------------
# Database helpers — psycopg2 with PostgreSQL (Supabase or AWS RDS)
# ---------------------------------------------------------------------------

def _get_conn():
    """Open a connection to PostgreSQL using the pool URL.
    
    Compatible with:
    - Supabase PostgreSQL (current)
    - AWS RDS PostgreSQL (migration-ready, see docs/AWS_RDS_MIGRATION.md)
    - Any PostgreSQL 12+ database
    
    Uses DATABASE_POOL_URL from settings for connection pooling.
    """
    import psycopg2
    import psycopg2.extras
    psycopg2.extras.register_uuid()
    dsn = settings.DATABASE_POOL_URL
    if "sslmode" not in dsn:
        dsn = dsn + ("&" if "?" in dsn else "?") + "sslmode=require"
    conn = psycopg2.connect(dsn, connect_timeout=10)
    conn.autocommit = False
    return conn


def _ensure_table():
    """Ensure forum_posts exists and has user_id / user_email columns."""
    ddl = """
    CREATE TABLE IF NOT EXISTS public.forum_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Anonymous Farmer',
        category TEXT NOT NULL DEFAULT 'general',
        language TEXT NOT NULL DEFAULT 'en',
        upvotes INT NOT NULL DEFAULT 0,
        downvotes INT NOT NULL DEFAULT 0,
        answers_count INT NOT NULL DEFAULT 0,
        is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
        tags TEXT[] NOT NULL DEFAULT '{}',
        user_id UUID,
        user_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='forum_posts' AND column_name='user_id') THEN
            ALTER TABLE public.forum_posts ADD COLUMN user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='forum_posts' AND column_name='user_email') THEN
            ALTER TABLE public.forum_posts ADD COLUMN user_email TEXT;
        END IF;
    END $$;
    """
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(ddl)
            conn.commit()
        finally:
            conn.close()
        logger.info("forum_posts table ready")
    except Exception as e:
        logger.warning(f"DB setup note: {e}")
        raise


try:
    _ensure_table()
    _DB_AVAILABLE = True
except Exception:
    _DB_AVAILABLE = False
    logger.warning("Forum DB unavailable — using in-memory fallback")


# ---------------------------------------------------------------------------
# In-memory fallback (used when DB is unavailable)
# ---------------------------------------------------------------------------
_posts: list[dict] = [
    {"id": "1", "title": "Best practices for wheat cultivation in Punjab", "content": "I've been farming wheat for 20 years. Here are my top tips for maximising yield...", "author": "Harjeet Singh", "category": "crop-management", "language": "en", "upvotes": 42, "downvotes": 2, "answers_count": 8, "is_resolved": True, "tags": ["wheat", "Punjab", "yield"], "created_at": "2024-01-15T10:00:00Z"},
    {"id": "2", "title": "Yellow leaves on tomato plants – what could it be?", "content": "My tomato plants are showing yellow leaves from the bottom. Applied neem oil but no improvement.", "author": "Ramesh Patel", "category": "pest-disease", "language": "en", "upvotes": 28, "downvotes": 0, "answers_count": 5, "is_resolved": False, "tags": ["tomato", "disease", "yellow leaves"], "created_at": "2024-01-18T08:30:00Z"},
    {"id": "3", "title": "What is the MSP for paddy this season?", "content": "Government has announced new MSP rates. Can anyone share the official numbers?", "author": "Suresh Kumar", "category": "market", "language": "en", "upvotes": 35, "downvotes": 1, "answers_count": 3, "is_resolved": True, "tags": ["paddy", "MSP", "government"], "created_at": "2024-01-20T14:00:00Z"},
]


def _row_to_post(row) -> dict:
    d = dict(row)
    d["id"] = str(d["id"]) if d.get("id") else None
    raw_ts = d.get("created_at")
    if hasattr(raw_ts, "isoformat"):
        d["created_at"] = raw_ts.isoformat()
    elif raw_ts:
        d["created_at"] = str(raw_ts)
    d["tags"] = list(d.get("tags") or [])
    d["user_id"] = str(d["user_id"]) if d.get("user_id") else None
    return d


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class CreatePostRequest(BaseModel):
    title: str
    content: str
    author: str = "Anonymous Farmer"
    category: str = "general"
    language: str = "en"
    tags: list[str] = []
    user_id: Optional[str] = None
    user_email: Optional[str] = None


class VoteRequest(BaseModel):
    vote_type: str  # "upvote" | "downvote"
    user_id: Optional[str] = None


class CreateAnswerRequest(BaseModel):
    content: str
    author: str = "Anonymous Farmer"
    user_id: Optional[str] = None
    user_email: Optional[str] = None


def _ensure_answers_table():
    ddl = """
    CREATE TABLE IF NOT EXISTS public.forum_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Anonymous Farmer',
        user_id UUID,
        user_email TEXT,
        upvotes INT NOT NULL DEFAULT 0,
        is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(ddl)
            conn.commit()
        finally:
            conn.close()
        logger.info("forum_answers table ready")
    except Exception as e:
        logger.warning(f"forum_answers table setup note: {e}")

try:
    _ensure_answers_table()
except Exception:
    pass


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/posts", response_model=list[ForumPost])
async def list_forum_posts(
    category: str = Query(default="", description="Filter by category"),
    sort: str = Query(default="latest", description="Sort: latest | popular | unanswered"),
    language: str = Query(default="en"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: Optional[str] = Query(default=None, description="Filter by user ID"),
    user_email: Optional[str] = Query(default=None, description="Filter by user email"),
):
    """List community forum posts with filtering and sorting."""
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    conditions: list[str] = []
                    params: list = []
                    if category:
                        conditions.append("category = %s")
                        params.append(category)
                    if sort == "unanswered":
                        conditions.append("answers_count = 0")
                    if user_id:
                        conditions.append("user_id = %s::uuid")
                        params.append(user_id)
                    if user_email:
                        conditions.append("user_email = %s")
                        params.append(user_email)

                    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
                    order = {
                        "popular": "ORDER BY upvotes DESC",
                        "unanswered": "ORDER BY created_at DESC",
                    }.get(sort, "ORDER BY created_at DESC")

                    cur.execute(
                        f"SELECT * FROM public.forum_posts {where} {order} LIMIT %s OFFSET %s",
                        params + [limit, offset]
                    )
                    rows = cur.fetchall()
                    logger.info(f"Forum: fetched {len(rows)} posts from DB")
                    result = []
                    for r in rows:
                        try:
                            result.append(ForumPost(**_row_to_post(r)))
                        except Exception as row_err:
                            logger.warning("Skipping malformed post row id=%s: %s", r.get('id'), row_err)
                    return result
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"DB list failed — using in-memory fallback: {e}")

    # Fallback
    posts = list(_posts)
    if category:
        posts = [p for p in posts if p["category"] == category]
    if user_id:
        posts = [p for p in posts if p.get("user_id") == user_id]
    if user_email:
        posts = [p for p in posts if p.get("user_email") == user_email]
    if sort == "popular":
        posts.sort(key=lambda p: p["upvotes"], reverse=True)
    elif sort == "unanswered":
        posts = [p for p in posts if p["answers_count"] == 0]
    else:
        posts.sort(key=lambda p: p["created_at"], reverse=True)
    return [ForumPost(**p) for p in posts[offset: offset + limit]]


@router.post("/posts", response_model=ForumPost, status_code=201)
async def create_forum_post(body: CreatePostRequest):
    """Create a new forum post and persist to Supabase."""
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """INSERT INTO public.forum_posts
                           (title, content, author, category, language, tags, user_id, user_email)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                           RETURNING *""",
                        (
                            body.title, body.content, body.author,
                            body.category, body.language, body.tags,
                            body.user_id, body.user_email,
                        )
                    )
                    row = cur.fetchone()
                conn.commit()
            finally:
                conn.close()
            return ForumPost(**_row_to_post(row))
        except Exception as e:
            logger.warning(f"DB insert failed — using in-memory fallback: {e}")

    # Fallback
    post = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "content": body.content,
        "author": body.author,
        "category": body.category,
        "language": body.language,
        "upvotes": 0,
        "downvotes": 0,
        "answers_count": 0,
        "is_resolved": False,
        "tags": body.tags,
        "user_id": body.user_id,
        "user_email": body.user_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _posts.insert(0, post)
    return ForumPost(**post)


@router.get("/posts/{post_id}", response_model=ForumPostDetail)
async def get_forum_post(post_id: str):
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("SELECT * FROM public.forum_posts WHERE id = %s", (post_id,))
                    row = cur.fetchone()
            finally:
                conn.close()
            if row:
                return ForumPostDetail(**_row_to_post(row), answers=[])
        except Exception as e:
            logger.warning(f"DB get failed: {e}")

    post = next((p for p in _posts if p["id"] == post_id), None)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return ForumPostDetail(**post, answers=[])


@router.post("/posts/{post_id}/vote", response_model=VoteResponse)
async def vote_forum_post(post_id: str, body: VoteRequest):
    """Upvote or downvote a forum post."""
    if body.vote_type not in ("upvote", "downvote"):
        raise HTTPException(status_code=400, detail="vote_type must be 'upvote' or 'downvote'")

    col = "upvotes" if body.vote_type == "upvote" else "downvotes"
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        f"UPDATE public.forum_posts SET {col} = {col} + 1 WHERE id = %s RETURNING upvotes",
                        (post_id,)
                    )
                    row = cur.fetchone()
                conn.commit()
            finally:
                conn.close()
            if row:
                return VoteResponse(upvotes=row["upvotes"])
        except Exception as e:
            logger.warning(f"DB vote failed: {e}")

    post = next((p for p in _posts if p["id"] == post_id), None)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if body.vote_type == "upvote":
        post["upvotes"] += 1
    else:
        post["downvotes"] += 1
    return VoteResponse(upvotes=post["upvotes"])


# ---------------------------------------------------------------------------
# Answers endpoints
# ---------------------------------------------------------------------------

@router.get("/posts/{post_id}/answers")
async def list_answers(post_id: str):
    """Return all answers for a given forum post."""
    # Demo posts have numeric IDs ("1","2","3") — skip DB for those
    try:
        uuid.UUID(post_id)
    except ValueError:
        return []
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM public.forum_answers WHERE post_id = %s::uuid "
                        "ORDER BY is_accepted DESC, upvotes DESC, created_at ASC",
                        (post_id,)
                    )
                    rows = cur.fetchall()
            finally:
                conn.close()
            result = []
            for r in rows:
                d = dict(r)
                d["id"] = str(d["id"])
                d["post_id"] = str(d["post_id"])
                d["user_id"] = str(d["user_id"]) if d.get("user_id") else None
                if hasattr(d.get("created_at"), "isoformat"):
                    d["created_at"] = d["created_at"].isoformat()
                result.append(d)
            return result
        except Exception as e:
            logger.exception("DB list_answers failed for post_id=%s: %s", post_id, e)
    return []


@router.post("/posts/{post_id}/answers", status_code=201)
async def create_answer(post_id: str, body: CreateAnswerRequest):
    """Post an answer to a forum question."""
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Answer content cannot be empty.")
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            conn = _get_conn()
            try:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """INSERT INTO public.forum_answers (post_id, content, author, user_id, user_email)
                           VALUES (%s::uuid, %s, %s, %s::uuid, %s) RETURNING *""",
                        (
                            post_id,
                            body.content.strip(),
                            body.author,
                            body.user_id if body.user_id else None,
                            body.user_email,
                        )
                    )
                    row = dict(cur.fetchone())
                    # Increment answers_count on the post
                    cur.execute(
                        "UPDATE public.forum_posts SET answers_count = answers_count + 1 WHERE id = %s::uuid",
                        (post_id,)
                    )
                conn.commit()
            finally:
                conn.close()
            row["id"] = str(row["id"])
            row["post_id"] = str(row["post_id"])
            row["user_id"] = str(row["user_id"]) if row.get("user_id") else None
            if hasattr(row.get("created_at"), "isoformat"):
                row["created_at"] = row["created_at"].isoformat()
            logger.info("Answer saved for post %s by %s", post_id, body.author)
            return row
        except Exception as e:
            logger.exception("DB create_answer failed for post_id=%s: %s", post_id, e)
            raise HTTPException(status_code=500, detail=f"Could not save answer: {e}")
    # In-memory fallback
    answer = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "content": body.content.strip(),
        "author": body.author,
        "user_id": body.user_id,
        "user_email": body.user_email,
        "upvotes": 0,
        "is_accepted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return answer
