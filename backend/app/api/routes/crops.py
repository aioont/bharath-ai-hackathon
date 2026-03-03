from __future__ import annotations
import logging
import uuid
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.auth import require_current_user, _get_conn

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/crops", tags=["Farmer Crops"])


# ── DB setup ──────────────────────────────────────────────────────────────────
def _ensure_crops_table():
    ddl = """
    CREATE TABLE IF NOT EXISTS public.farmer_crops (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        crop_name   TEXT NOT NULL,
        area_acres  NUMERIC(10,2),
        soil_type   TEXT,
        season      TEXT,
        irrigation  TEXT,
        variety     TEXT,
        notes       TEXT,
        is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farmer_crops_user_id ON public.farmer_crops(user_id);
    """
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(ddl)
            conn.commit()
        logger.info("farmer_crops table ready")
    except Exception as e:
        logger.warning(f"farmer_crops table setup failed: {e}")


try:
    _ensure_crops_table()
except Exception:
    pass


# ── Pydantic models ───────────────────────────────────────────────────────────
class CropCreate(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100)
    area_acres: Optional[float] = Field(None, ge=0)
    soil_type: Optional[str] = None
    season: Optional[Literal["kharif", "rabi", "zaid", "perennial", "all-season"]] = None
    irrigation: Optional[Literal["rainfed", "canal", "drip", "sprinkler", "borewell", "other"]] = None
    variety: Optional[str] = None
    notes: Optional[str] = None
    is_primary: bool = False


class CropUpdate(BaseModel):
    crop_name: Optional[str] = Field(None, min_length=1, max_length=100)
    area_acres: Optional[float] = Field(None, ge=0)
    soil_type: Optional[str] = None
    season: Optional[Literal["kharif", "rabi", "zaid", "perennial", "all-season"]] = None
    irrigation: Optional[Literal["rainfed", "canal", "drip", "sprinkler", "borewell", "other"]] = None
    variety: Optional[str] = None
    notes: Optional[str] = None
    is_primary: Optional[bool] = None


class CropOut(BaseModel):
    id: str
    user_id: str
    crop_name: str
    area_acres: Optional[float]
    soil_type: Optional[str]
    season: Optional[str]
    irrigation: Optional[str]
    variety: Optional[str]
    notes: Optional[str]
    is_primary: bool
    created_at: str
    updated_at: str


def _row_to_out(row: dict) -> CropOut:
    return CropOut(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        crop_name=row["crop_name"],
        area_acres=float(row["area_acres"]) if row["area_acres"] is not None else None,
        soil_type=row["soil_type"],
        season=row["season"],
        irrigation=row["irrigation"],
        variety=row["variety"],
        notes=row["notes"],
        is_primary=row["is_primary"],
        created_at=row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
        updated_at=row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"]),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CropOut])
async def list_crops(user_id: str = Depends(require_current_user)):
    """Get all crops for the authenticated farmer."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM farmer_crops WHERE user_id = %s ORDER BY is_primary DESC, created_at ASC",
                    (user_id,)
                )
                rows = cur.fetchall()
        return [_row_to_out(r) for r in rows]
    except Exception as e:
        logger.error(f"List crops error: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch crops.")


@router.post("", response_model=CropOut, status_code=201)
async def add_crop(body: CropCreate, user_id: str = Depends(require_current_user)):
    """Add a new crop for the authenticated farmer."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # If this is set as primary, unset others first
                if body.is_primary:
                    cur.execute(
                        "UPDATE farmer_crops SET is_primary = FALSE WHERE user_id = %s",
                        (user_id,)
                    )
                cur.execute(
                    """INSERT INTO farmer_crops
                       (user_id, crop_name, area_acres, soil_type, season, irrigation, variety, notes, is_primary)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING *""",
                    (user_id, body.crop_name, body.area_acres, body.soil_type,
                     body.season, body.irrigation, body.variety, body.notes, body.is_primary)
                )
                row = cur.fetchone()
            conn.commit()
        return _row_to_out(row)
    except Exception as e:
        logger.error(f"Add crop error: {e}")
        raise HTTPException(status_code=500, detail="Could not add crop.")


@router.put("/{crop_id}", response_model=CropOut)
async def update_crop(crop_id: str, body: CropUpdate, user_id: str = Depends(require_current_user)):
    """Update a specific crop entry."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Verify ownership
                cur.execute("SELECT id FROM farmer_crops WHERE id = %s AND user_id = %s", (crop_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Crop not found.")

                # If setting as primary, unset others
                if body.is_primary:
                    cur.execute(
                        "UPDATE farmer_crops SET is_primary = FALSE WHERE user_id = %s",
                        (user_id,)
                    )

                # Build dynamic SET clause
                updates = {}
                if body.crop_name is not None:
                    updates["crop_name"] = body.crop_name
                if body.area_acres is not None:
                    updates["area_acres"] = body.area_acres
                if body.soil_type is not None:
                    updates["soil_type"] = body.soil_type
                if body.season is not None:
                    updates["season"] = body.season
                if body.irrigation is not None:
                    updates["irrigation"] = body.irrigation
                if body.variety is not None:
                    updates["variety"] = body.variety
                if body.notes is not None:
                    updates["notes"] = body.notes
                if body.is_primary is not None:
                    updates["is_primary"] = body.is_primary

                if not updates:
                    cur.execute("SELECT * FROM farmer_crops WHERE id = %s", (crop_id,))
                    return _row_to_out(cur.fetchone())

                updates["updated_at"] = "NOW()"
                set_clause = ", ".join(
                    f"{k} = NOW()" if v == "NOW()" else f"{k} = %s"
                    for k, v in updates.items()
                )
                values = [v for v in updates.values() if v != "NOW()"]
                values.append(crop_id)

                cur.execute(
                    f"UPDATE farmer_crops SET {set_clause} WHERE id = %s RETURNING *",
                    values
                )
                row = cur.fetchone()
            conn.commit()
        return _row_to_out(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update crop error: {e}")
        raise HTTPException(status_code=500, detail="Could not update crop.")


@router.delete("/{crop_id}", status_code=204)
async def delete_crop(crop_id: str, user_id: str = Depends(require_current_user)):
    """Delete a specific crop entry."""
    try:
        with _get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM farmer_crops WHERE id = %s AND user_id = %s",
                    (crop_id, user_id)
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Crop not found.")
            conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete crop error: {e}")
        raise HTTPException(status_code=500, detail="Could not delete crop.")


@router.patch("/{crop_id}/set-primary", response_model=CropOut)
async def set_primary_crop(crop_id: str, user_id: str = Depends(require_current_user)):
    """Set a crop as the primary crop (unsets all others)."""
    try:
        import psycopg2.extras
        with _get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT id FROM farmer_crops WHERE id = %s AND user_id = %s", (crop_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Crop not found.")
                cur.execute("UPDATE farmer_crops SET is_primary = FALSE WHERE user_id = %s", (user_id,))
                cur.execute(
                    "UPDATE farmer_crops SET is_primary = TRUE, updated_at = NOW() WHERE id = %s RETURNING *",
                    (crop_id,)
                )
                row = cur.fetchone()
            conn.commit()
        return _row_to_out(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Set primary crop error: {e}")
        raise HTTPException(status_code=500, detail="Could not set primary crop.")
