from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services.scheme_service import KNOWN_SCHEMES, check_eligibility

router = APIRouter(prefix="/api/schemes", tags=["Scheme Advisor"])


class EligibilityRequest(BaseModel):
    state: Optional[str] = None
    farming_type: Optional[str] = None
    land_acres: Optional[float] = None
    gender: Optional[str] = None
    name: Optional[str] = "Farmer"
    language: str = "en"
    tts_enabled: bool = False


@router.get("/list")
async def list_schemes():
    """Return all known government schemes database."""
    return {
        "schemes": KNOWN_SCHEMES,
        "total": len(KNOWN_SCHEMES),
        "source": "Embedded DB (Central schemes 2024-25)",
    }


@router.post("/check-eligibility")
async def check_scheme_eligibility(req: EligibilityRequest = Body(...)):
    """Match farmer profile to eligible schemes + AI-generated narration."""
    try:
        farmer_profile = {
            "state": req.state,
            "farming_type": req.farming_type,
            "land_acres": req.land_acres,
            "gender": req.gender,
            "name": req.name,
        }
        return await check_eligibility(
            farmer_profile=farmer_profile,
            language=req.language,
            tts_enabled=req.tts_enabled,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Eligibility check failed: {str(exc)}")
