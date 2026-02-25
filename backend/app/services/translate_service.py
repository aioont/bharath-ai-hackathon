"""
Translation service — uses Sarvam Translate (sarvam-translate:v1) for 22 Indian languages.
Falls back to a demo response when the API key is not configured.
"""
from __future__ import annotations

import asyncio
import structlog
from app.core.config import settings
from app.models.schemas import TranslationResponse

logger = structlog.get_logger()

# App 2-letter code → Sarvam BCP-47 code
SARVAM_LANG = {
    "hi": "hi-IN", "bn": "bn-IN", "te": "te-IN", "mr": "mr-IN",
    "ta": "ta-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN",
    "pa": "pa-IN", "or": "od-IN", "as": "as-IN", "ur": "ur-IN",
    "en": "en-IN", "ne": "ne-IN", "sa": "sa-IN",
    "si": "en-IN",  # Sinhala not yet supported → English fallback
}


def _sync_translate(text: str, src_code: str, tgt_code: str) -> str:
    if not settings.SARVAM_API_KEY:
        raise RuntimeError("no_key")
    try:
        from sarvamai import SarvamAI  # type: ignore
    except ImportError:
        raise RuntimeError("sarvamai_not_installed")
    client = SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
    response = client.text.translate(
        input=text,
        source_language_code=src_code,
        target_language_code=tgt_code,
        model=settings.SARVAM_TRANSLATE_MODEL,
    )
    if hasattr(response, "translated_text"):
        return response.translated_text
    if isinstance(response, dict):
        return response.get("translated_text", text)
    return str(response)


async def translate_text(
    text: str,
    source_language: str,
    target_language: str,
    domain: str = "agriculture",
) -> TranslationResponse:
    """Translate text using Sarvam Translate (sarvam-translate:v1)."""
    if source_language == target_language:
        return TranslationResponse(
            translated_text=text,
            source_language=source_language,
            target_language=target_language,
            confidence=1.0,
            domain=domain,
        )

    src = SARVAM_LANG.get(source_language, "en-IN")
    tgt = SARVAM_LANG.get(target_language, "en-IN")

    try:
        translated = await asyncio.to_thread(_sync_translate, text, src, tgt)
        return TranslationResponse(
            translated_text=translated,
            source_language=source_language,
            target_language=target_language,
            confidence=0.95,
            domain=domain,
        )
    except Exception as exc:
        logger.warning("sarvam_translate_fallback", error=str(exc))
        return _demo_translation(text, source_language, target_language, domain)


def _demo_translation(text: str, source: str, target: str, domain: str) -> TranslationResponse:
    lang_names = {
        "hi": "हिंदी", "mr": "मराठी", "ta": "தமிழ்", "te": "తెలుగు",
        "bn": "বাংলা", "gu": "ગુજરાતી", "kn": "ಕನ್ನಡ", "ml": "മലയാളം",
        "pa": "ਪੰਜਾਬੀ", "en": "English",
    }
    target_name = lang_names.get(target, target.upper())
    demo_text = f"[{target_name} अनुवाद Demo]\n{text}\n\n(Add SARVAM_API_KEY in .env for live translation)"
    return TranslationResponse(
        translated_text=demo_text,
        source_language=source,
        target_language=target,
        confidence=0.5,
        domain=domain,
    )
