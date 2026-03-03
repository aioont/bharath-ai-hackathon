from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse
from app.services.sarvam_service import get_ai_response
import structlog

router = APIRouter(prefix="/api/chat", tags=["AgriSaarthi"])
log = structlog.get_logger()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AgriSaarthi: Autonomous Multilingual Voice & Text AI Expert for Bharat."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        result = await get_ai_response(
            message=request.message,
            language=request.language,
            conversation_history=request.conversation_history,
            category=request.category,
            farmer_profile=request.farmer_profile,
        )
    except Exception as exc:
        log.error("chat_endpoint_error", error=str(exc))
        raise HTTPException(
            status_code=502,
            detail=f"AI service unavailable: {str(exc)}",
        )
    return ChatResponse(**result)
