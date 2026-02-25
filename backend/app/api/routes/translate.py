from fastapi import APIRouter, HTTPException
from app.models.schemas import TranslationRequest, TranslationResponse, BatchTranslationRequest, BatchTranslationResponse
from app.services.translate_service import translate_text
import asyncio

router = APIRouter(prefix="/api/translate", tags=["Translation"])


@router.post("", response_model=TranslationResponse)
async def translate(request: TranslationRequest):
    """Translate agricultural text using Sarvam Translate."""
    if request.source_language == request.target_language:
        raise HTTPException(status_code=400, detail="Source and target languages must be different")
    
    result = await translate_text(
        text=request.text,
        source_language=request.source_language,
        target_language=request.target_language,
        domain=request.domain,
    )
    return result


@router.post("/batch", response_model=BatchTranslationResponse)
async def translate_batch(request: BatchTranslationRequest):
    """Translate multiple texts concurrently."""
    if len(request.translations) > 20:
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 20 translations")
    
    tasks = [
        translate_text(
            text=t.text,
            source_language=t.source_language,
            target_language=t.target_language,
            domain=t.domain,
        )
        for t in request.translations
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    valid_results = []
    for r in results:
        if isinstance(r, Exception):
            valid_results.append(TranslationResponse(
                translated_text="Translation error", source_language="en",
                target_language="en", confidence=0.0, domain="general"
            ))
        else:
            valid_results.append(r)
    
    return BatchTranslationResponse(results=valid_results)
