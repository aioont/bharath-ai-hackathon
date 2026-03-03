from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel
from typing import Optional
from app.services.plan_service import get_plan_questions, generate_farm_plan

router = APIRouter(prefix="/api/plan", tags=["Farm Plan Generator"])


class PlanRequest(BaseModel):
    answers: dict
    language: str = "en"
    tts_enabled: bool = False


@router.get("/questions")
async def plan_questions(language: str = Query(default="en")):
    """Return dynamic Q&A questions for farm plan generation."""
    questions = await get_plan_questions(language)
    return {"questions": questions, "total": len(questions)}


@router.post("/generate")
async def plan_generate(req: PlanRequest = Body(...)):
    """Generate a comprehensive farm plan from farmer answers + IoT sensor data."""
    if not req.answers.get("crop") or not req.answers.get("location"):
        raise HTTPException(status_code=400, detail="At minimum 'crop' and 'location' answers are required")
    try:
        result = await generate_farm_plan(
            answers=req.answers,
            language=req.language,
            tts_enabled=req.tts_enabled,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plan generation failed: {str(exc)}")
