from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional
from app.services.insurance_service import suggest_insurance

router = APIRouter(prefix="/api/insurance", tags=["Insurance Advisor"])


class InsuranceRequest(BaseModel):
    # Profile fields (pre-filled from farmer profile + form)
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    occupation: str = "Farmer"
    land_acres: Optional[float] = None
    crop: Optional[str] = None
    farming_type: Optional[str] = None        # irrigated / rain-fed / organic
    income_level: Optional[str] = None        # BPL / marginal / small / medium
    category: Optional[str] = "General"       # SC / ST / OBC / General
    # Interaction options
    language: str = "en"
    tts_enabled: bool = False


@router.post("/suggest")
async def suggest(req: InsuranceRequest = Body(...)):
    """
    Match farmer profile to best insurance schemes.
    Uses: myscheme.gov.in API + AWS Bedrock KB (if configured) + Sarvam-M reasoning.
    """
    user_details = req.model_dump(exclude={"language", "tts_enabled"})
    try:
        result = await suggest_insurance(
            user_details=user_details,
            language=req.language,
            tts_enabled=req.tts_enabled,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Insurance suggestion failed: {str(exc)}")


@router.get("/schemes")
async def list_schemes():
    """Return embedded fallback scheme dataset (no auth required)."""
    from app.services.insurance_service import _embedded_fallback_schemes, _load_local_cache
    schemes = _load_local_cache() or _embedded_fallback_schemes()
    return {"schemes": schemes, "total": len(schemes), "source": "cache" if _load_local_cache() else "embedded"}
