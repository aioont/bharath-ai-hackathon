from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime
from app.models.schemas import ChatRequest, ChatResponse
from app.services.sarvam_service import get_ai_response, generate_tts_audio
from app.services import chat_service
from app.api.routes.auth import get_current_user_id, security
from fastapi.security import HTTPAuthorizationCredentials
import structlog
import time

router = APIRouter(prefix="/api/chat", tags=["AgriSaarthi"])
log = structlog.get_logger()


def get_current_user_optional(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """Get current user (id + email) from JWT token if authenticated, else None."""
    try:
        if creds is None:
            return None
        from app.api.routes.auth import _decode_token
        payload = _decode_token(creds.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"id": user_id, "email": payload.get("email", "")}
    except:
        return None


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    AgriSaarthi: Autonomous Multilingual Voice & Text AI Expert for Bharat.
    
    New Features:
    - Persistent chat history (saved to PostgreSQL)
    - Semantic caching (60-80% cost reduction via ElastiCache)
    - Multilingual audio storage (Sarvam TTS)
    - Analytics tracking (tokens, response time, cache hits)
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    start_time = time.time()
    conversation_id = None
    user_id = current_user.get("id") if current_user else None
    
    try:
        # ─── STEP 1: Get or create single conversation per user ───────────
        if user_id:
            # Always use the same conversation for this user (single chat history)
            conversation = await chat_service.get_or_create_conversation(
                user_id=user_id,
                conversation_uuid=None,  # Single conversation - no UUID needed
                language=request.language,
                category=request.category or "general"
            )
            conversation_id = conversation["id"] if conversation else None
            log.info("conversation_resolved", 
                    conversation_id=conversation_id, 
                    user_id=user_id)
        
        # ─── STEP 2: Save user message ────────────────────────────────────
        if conversation_id:
            await chat_service.save_message(
                conversation_id=conversation_id,
                role="user",
                content=request.message,
                language=request.language,
                metadata={"category": request.category}
            )
        
        # ─── STEP 3: Check semantic cache (COST OPTIMIZATION!) ───────────
        cached_response = await chat_service.get_cached_ai_response(
            message=request.message,
            language=request.language,
            category=request.category or "general"
        )
        
        if cached_response:
            response_time_ms = int((time.time() - start_time) * 1000)
            
            log.info("serving_cached_response", 
                    response_time_ms=response_time_ms,
                    saved_cost="~$0.002-0.01")
            
            # Save cached assistant response
            if conversation_id:
                await chat_service.save_message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=cached_response["response"],
                    language=request.language,
                    audio_base64=cached_response.get("audio_base64"),
                    model_used="cached",
                    response_time_ms=response_time_ms,
                    cached_response=True
                )
            
            return ChatResponse(
                response=cached_response["response"],
                language=request.language,
                audio_base64=cached_response.get("audio_base64"),
                confidence=cached_response.get("confidence", 0.95)
            )
        
        # ─── STEP 4: Generate AI response (cache miss) ────────────────────
        # Email comes from the JWT token — no extra DB round-trip needed
        user_email = (current_user.get("email") or "") if current_user else ""

        result = await get_ai_response(
            message=request.message,
            language=request.language,
            conversation_history=request.conversation_history,
            category=request.category,
            farmer_profile=request.farmer_profile,
            user_id=user_id or "anonymous",
            user_email=user_email,
        )
        
        # ─── STEP 5: Generate TTS audio if requested ──────────────────────
        audio_base64 = None
        if request.tts_enabled:
            audio_base64 = await generate_tts_audio(
                text=result["response"],
                language=request.language
            )
        
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # ─── STEP 6: Save assistant response ──────────────────────────────
        if conversation_id:
            await chat_service.save_message(
                conversation_id=conversation_id,
                role="assistant",
                content=result["response"],
                language=request.language,
                audio_base64=audio_base64,
                audio_format="wav",
                model_used=result.get("model", "sarvam-m"),
                tokens_used=result.get("tokens_used", 0),
                response_time_ms=response_time_ms,
                cached_response=False
            )
        
        # ─── STEP 7: Cache response for future queries ────────────────────
        await chat_service.cache_ai_response(
            message=request.message,
            language=request.language,
            category=request.category or "general",
            response=result["response"],
            audio_base64=audio_base64
        )
        
        log.info("ai_response_generated", 
                response_time_ms=response_time_ms,
                tokens=result.get("tokens_used", 0),
                has_audio=bool(audio_base64))
        
        return ChatResponse(
            response=result["response"],
            language=request.language,
            audio_base64=audio_base64,
            audio_format="wav",
            confidence=result.get("confidence", 0.95)
        )
        
    except Exception as exc:
        log.error("chat_endpoint_error", error=str(exc))
        raise HTTPException(
            status_code=502,
            detail=f"AI service unavailable: {str(exc)}",
        )


# ───────────────────────────────────────────────────────────────────────────────
# CHAT HISTORY ENDPOINTS
# ───────────────────────────────────────────────────────────────────────────────

@router.get("/conversations")
async def get_conversations(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get user's chat conversation list."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    conversations = await chat_service.get_user_conversations(
        user_id=current_user["id"],
        limit=limit,
        offset=offset,
        category=category
    )
    
    return {
        "conversations": conversations,
        "total": len(conversations),
        "limit": limit,
        "offset": offset
    }


@router.get("/conversations/{conversation_uuid}")
async def get_conversation(
    conversation_uuid: str,
    current_user: Optional[dict] = Depends(get_current_user_optional),
    include_audio: bool = Query(False, description="Include audio_base64 in messages")
):
    """Get full conversation with all messages."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get conversation metadata
    conversation = await chat_service.get_conversation_by_uuid(conversation_uuid)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Verify ownership
    if conversation["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get messages
    messages = await chat_service.get_conversation_messages(
        conversation_id=conversation["id"],
        limit=100,
        include_audio=include_audio
    )
    
    return {
        "conversation": conversation,
        "messages": messages,
        "message_count": len(messages)
    }


@router.get("/analytics")
async def get_analytics(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    days: int = Query(7, ge=1, le=90)
):
    """
    Get chat usage analytics and cost metrics.
    
    Returns:
    - total_messages: Total messages sent
    - conversations: Number of conversations
    - cache_hit_rate: % of responses served from cache (cost savings)
    - total_tokens: Token usage
    - avg_response_time_ms: Average response time
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    analytics = await chat_service.get_chat_analytics(
        user_id=current_user["id"],
        days=days
    )
    
    return {
        "user_id": current_user["id"],
        "period_days": days,
        **analytics
    }


@router.get("/history")
async def get_chat_history(
    current_user: Optional[dict] = Depends(get_current_user_optional),
    include_audio: bool = Query(False, description="Include audio_base64 in messages")
):
    """
    Get user's single conversation history (simplified - one conversation per user).
    
    Returns all messages from the user's active conversation.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's single active conversation
    conversations = await chat_service.get_user_conversations(
        user_id=current_user["id"],
        limit=1,
        offset=0
    )
    
    if not conversations or len(conversations) == 0:
        return {
            "messages": [],
            "message_count": 0,
            "conversation": None
        }
    
    conversation = conversations[0]
    
    # Get all messages
    messages = await chat_service.get_conversation_messages(
        conversation_id=conversation["id"],
        limit=1000,  # Get all messages
        include_audio=include_audio
    )
    
    return {
        "conversation": conversation,
        "messages": messages,
        "message_count": len(messages)
    }


@router.delete("/history")
async def clear_chat_history(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Clear user's chat history by archiving their current conversation.
    Next message will create a fresh conversation.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's active conversation
    conversations = await chat_service.get_user_conversations(
        user_id=current_user["id"],
        limit=1,
        offset=0
    )
    
    if not conversations or len(conversations) == 0:
        return {
            "success": True,
            "message": "No active conversation to clear"
        }
    
    conversation = conversations[0]
    
    # Archive the conversation
    success = await chat_service.archive_conversation(conversation["id"])
    
    if success:
        return {
            "success": True,
            "message": "Chat history cleared successfully"
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to clear chat history")
