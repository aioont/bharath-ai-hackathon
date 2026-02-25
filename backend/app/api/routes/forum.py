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
# Database helpers — psycopg2 with Supabase
# ---------------------------------------------------------------------------

def _get_conn():
    """Open a connection to Supabase using the pool URL (IPv4-safe)."""
    import psycopg2
    import psycopg2.extras
    return psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)


def _ensure_table():
    """Create forum_posts table if it does not exist, and seed initial data."""
    ddl = """
    CREATE TABLE IF NOT EXISTS forum_posts (
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
    seed_data = [
        ("Best practices for wheat cultivation in Punjab", "I've been farming wheat for 20 years. Here are my top tips for maximising yield...", "Harjeet Singh", "crop-management", "en", 42, 2, 8, True, ["wheat", "Punjab", "yield"], "2024-01-15T10:00:00Z"),
        ("Yellow leaves on tomato plants – what could it be?", "My tomato plants are showing yellow leaves from the bottom. Applied neem oil but no improvement.", "Ramesh Patel", "pest-disease", "en", 28, 0, 5, False, ["tomato", "disease", "yellow leaves"], "2024-01-18T08:30:00Z"),
        ("What is the MSP for paddy this season?", "Government has announced new MSP rates. Can anyone share the official numbers?", "Suresh Kumar", "market", "en", 35, 1, 3, True, ["paddy", "MSP", "government"], "2024-01-20T14:00:00Z"),
    ]
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(ddl)
                cur.execute("SELECT COUNT(*) FROM forum_posts")
                count = cur.fetchone()[0]
                if count == 0:
                    for row in seed_data:
                        cur.execute(
                            """INSERT INTO forum_posts
                               (title, content, author, category, language, upvotes, downvotes,
                                answers_count, is_resolved, tags, created_at)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                            row
                        )
            conn.commit()
        logger.info("forum_posts table ready")
    except Exception as e:
        logger.warning(f"DB setup skipped (will use in-memory fallback): {e}")


# Try to set up table at import time
try:
    _ensure_table()
    _DB_AVAILABLE = True
except Exception:
    _DB_AVAILABLE = False


# ---------------------------------------------------------------------------
# In-memory fallback (used when DB is unavailable)
# ---------------------------------------------------------------------------
_posts: list[dict] = [
    {"id": "1", "title": "Best practices for wheat cultivation in Punjab", "content": "I've been farming wheat for 20 years. Here are my top tips for maximising yield...", "author": "Harjeet Singh", "category": "crop-management", "language": "en", "upvotes": 42, "downvotes": 2, "answers_count": 8, "is_resolved": True, "tags": ["wheat", "Punjab", "yield"], "created_at": "2024-01-15T10:00:00Z"},
    {"id": "2", "title": "Yellow leaves on tomato plants – what could it be?", "content": "My tomato plants are showing yellow leaves from the bottom. Applied neem oil but no improvement.", "author": "Ramesh Patel", "category": "pest-disease", "language": "en", "upvotes": 28, "downvotes": 0, "answers_count": 5, "is_resolved": False, "tags": ["tomato", "disease", "yellow leaves"], "created_at": "2024-01-18T08:30:00Z"},
    {"id": "3", "title": "What is the MSP for paddy this season?", "content": "Government has announced new MSP rates. Can anyone share the official numbers?", "author": "Suresh Kumar", "category": "market", "language": "en", "upvotes": 35, "downvotes": 1, "answers_count": 3, "is_resolved": True, "tags": ["paddy", "MSP", "government"], "created_at": "2024-01-20T14:00:00Z"},
]


def _row_to_post(row) -> dict:
    """Convert a psycopg2 DictRow to a plain dict compatible with ForumPost schema."""
    import psycopg2.extras  # noqa
    d = dict(row)
    d["id"] = str(d["id"])
    d["created_at"] = d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else str(d["created_at"])
    d["tags"] = list(d.get("tags") or [])
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


class VoteRequest(BaseModel):
    vote_type: str  # "upvote" | "downvote"
    user_id: Optional[str] = None


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
):
    """List community forum posts with filtering and sorting."""
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            with _get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    conditions = []
                    params: list = []
                    if category:
                        conditions.append("category = %s")
                        params.append(category)
                    if sort == "unanswered":
                        conditions.append("answers_count = 0")

                    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
                    order = {
                        "popular": "ORDER BY upvotes DESC",
                        "unanswered": "ORDER BY created_at DESC",
                    }.get(sort, "ORDER BY created_at DESC")

                    cur.execute(
                        f"SELECT * FROM forum_posts {where} {order} LIMIT %s OFFSET %s",
                        params + [limit, offset]
                    )
                    rows = cur.fetchall()
                    return [ForumPost(**_row_to_post(r)) for r in rows]
        except Exception as e:
            logger.warning(f"DB list failed, falling back to memory: {e}")

    # Fallback
    posts = list(_posts)
    if category:
        posts = [p for p in posts if p["category"] == category]
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
            with _get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        """INSERT INTO forum_posts
                           (title, content, author, category, language, tags)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           RETURNING *""",
                        (body.title, body.content, body.author, body.category, body.language, body.tags)
                    )
                    row = cur.fetchone()
                conn.commit()
            return ForumPost(**_row_to_post(row))
        except Exception as e:
            logger.warning(f"DB insert failed, falling back to memory: {e}")

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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _posts.insert(0, post)
    return ForumPost(**post)


@router.get("/posts/{post_id}", response_model=ForumPostDetail)
async def get_forum_post(post_id: str):
    """Get a single forum post with answers."""
    if _DB_AVAILABLE:
        try:
            import psycopg2.extras
            with _get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute("SELECT * FROM forum_posts WHERE id = %s", (post_id,))
                    row = cur.fetchone()
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

    if _DB_AVAILABLE:
        try:
            col = "upvotes" if body.vote_type == "upvote" else "downvotes"
            import psycopg2.extras
            with _get_conn() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(
                        f"UPDATE forum_posts SET {col} = {col} + 1 WHERE id = %s RETURNING upvotes, downvotes",
                        (post_id,)
                    )
                    row = cur.fetchone()
                conn.commit()
            if row:
                return VoteResponse(post_id=post_id, upvotes=row["upvotes"], downvotes=row["downvotes"])
        except Exception as e:
            logger.warning(f"DB vote failed: {e}")

    post = next((p for p in _posts if p["id"] == post_id), None)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if body.vote_type == "upvote":
        post["upvotes"] += 1
    else:
        post["downvotes"] += 1
    return VoteResponse(post_id=post_id, upvotes=post["upvotes"], downvotes=post["downvotes"])

