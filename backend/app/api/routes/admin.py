"""
Admin routes — cache statistics and management endpoints
"""
from fastapi import APIRouter
from app.core.cache import get_cache_stats, invalidate_pattern, is_cache_available

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/cache/stats")
async def cache_statistics():
    """
    Get cache performance statistics.
    
    Returns:
        - hit_rate: Percentage of cache hits (target: >60%)
        - memory usage: Current memory consumption
        - total commands: Total Redis operations
        - connected clients: Active connections
    """
    stats = await get_cache_stats()
    
    if not stats.get("available"):
        return {
            "available": False,
            "message": "Cache not available. Using direct API calls.",
            "tip": "Enable caching in .env: REDIS_CACHE_ENABLED=true"
        }
    
    return {
        "available": True,
        "performance": {
            "hit_rate": f"{stats.get('hit_rate', 0)}%",
            "cache_hits": stats.get("keyspace_hits", 0),
            "cache_misses": stats.get("keyspace_misses", 0),
        },
        "resources": {
            "memory_used": stats.get("used_memory_human", "0B"),
            "connected_clients": stats.get("connected_clients", 0),
            "total_commands": stats.get("total_commands_processed", 0),
        },
        "recommendations": _get_recommendations(stats)
    }


@router.post("/cache/clear")
async def clear_cache(pattern: str = "*"):
    """
    Clear cache entries matching a pattern.
    
    Examples:
        - /cache/clear?pattern=bedrock_kb:* (clear all KB caches)
        - /cache/clear?pattern=weather:* (clear weather cache)
        - /cache/clear?pattern=* (clear all - use with caution!)
    
    WARNING: This will force fresh API calls for cleared entries.
    """
    if not is_cache_available():
        return {"success": False, "message": "Cache not available"}
    
    count = await invalidate_pattern(pattern)
    
    return {
        "success": True,
        "pattern": pattern,
        "keys_deleted": count,
        "message": f"Cleared {count} cache entries matching '{pattern}'"
    }


@router.get("/cache/health")
async def cache_health():
    """Simple health check for cache availability."""
    available = is_cache_available()
    
    return {
        "cache_enabled": available,
        "status": "healthy" if available else "degraded",
        "fallback": "Direct API calls" if not available else None
    }


def _get_recommendations(stats: dict) -> list[str]:
    """Generate optimization recommendations based on stats."""
    recommendations = []
    
    hit_rate = stats.get("hit_rate", 0)
    memory_percent = stats.get("used_memory_human", "0B")
    
    if hit_rate < 40:
        recommendations.append(
            "⚠️ Low cache hit rate (<40%). Consider increasing TTL for stable data."
        )
    elif hit_rate > 90:
        recommendations.append(
            "✅ Excellent cache hit rate (>90%)! Significant cost savings achieved."
        )
    
    # Simple memory usage check (parsing "12.5M" format)
    if "M" in memory_percent:
        mb_used = float(memory_percent.replace("M", ""))
        if mb_used > 1000:  # 1GB
            recommendations.append(
                "⚠️ High memory usage (>1GB). Consider upgrading node size or reducing TTL."
            )
    
    if not recommendations:
        recommendations.append("✅ Cache performance is optimal.")
    
    return recommendations
import psycopg2
import psycopg2.extras
from app.core.config import settings
from fastapi import HTTPException

def _get_conn():
    return psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)

@router.get("/db/tables")
def get_tables():
    try:
        conn = _get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            tables = [row['table_name'] for row in cur.fetchall()]
            return {"tables": tables}
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/db/tables/{table_name}")
def get_table_data(table_name: str, limit: int = 50, offset: int = 0):
    try:
        conn = _get_conn()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s", (table_name,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Table not found")
            
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s", (table_name,))
            columns = cur.fetchall()

            # Exclude large binary columns if any to avoid massive payloads
            col_names = [c['column_name'] for c in columns if c['data_type'] != 'bytea']
            if not col_names:
                col_names = ['*']
            
            query = f"SELECT {', '.join(col_names)} FROM public.{table_name} LIMIT %s OFFSET %s"
            cur.execute(query, (limit, offset))
            data = cur.fetchall()
            
            cur.execute(f"SELECT COUNT(*) as count FROM public.{table_name}")
            total_count = cur.fetchone()['count']

            return {
                "table": table_name,
                "columns": columns,
                "data": data,
                "total": total_count,
                "limit": limit,
                "offset": offset
            }
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
