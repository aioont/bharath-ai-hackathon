"""
Sarvam AI service — wraps Sarvam-M (chat), Sarvam Translate, and Sarvam Vision.
All calls use the official sarvamai Python SDK via asyncio.to_thread for non-blocking IO.
"""
from __future__ import annotations

import asyncio
import functools
import pathlib
import structlog
from typing import Optional, List

from app.core.config import settings
from app.models.schemas import ChatMessageModel, FarmerProfile

logger = structlog.get_logger()

_PROMPTS_FILE = pathlib.Path(__file__).parent.parent / "prompts.yaml"


@functools.lru_cache(maxsize=1)
def _load_prompts() -> dict:
    """Load prompts.yaml once at startup (cached in-process)."""
    try:
        import yaml  # type: ignore
        with open(_PROMPTS_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        logger.info("prompts_loaded", categories=list(data.get("categories", {}).keys()))
        return data
    except Exception as exc:
        logger.error("prompts_load_failed", error=str(exc), path=str(_PROMPTS_FILE))
        return {}


def _build_system_prompt(category: Optional[str] = None) -> str:
    """Combine base_prompt with the selected category's role_suffix from prompts.yaml."""
    prompts = _load_prompts()
    base = prompts.get("base_prompt", "").strip()
    if category:
        cat_data = prompts.get("categories", {}).get(category, {})
        role_suffix = cat_data.get("role_suffix", "").strip()
        if role_suffix:
            return f"{base}\n\n{role_suffix}"
    return base

# ---------------------------------------------------------------------------
# Language code mapping  (2-letter app code → Sarvam BCP-47 code)
# Sarvam AI officially supports 15 Indian languages + English
# ---------------------------------------------------------------------------
SARVAM_LANG = {
    # Major Indian Languages (fully supported by Sarvam AI)
    "en": "en-IN",  # English
    "hi": "hi-IN",  # Hindi (हिंदी)
    "bn": "bn-IN",  # Bengali (বাংলা)
    "te": "te-IN",  # Telugu (తెలుగు)
    "mr": "mr-IN",  # Marathi (मराठी)
    "ta": "ta-IN",  # Tamil (தமிழ்)
    "gu": "gu-IN",  # Gujarati (ગુજરાતી)
    "kn": "kn-IN",  # Kannada (ಕನ್ನಡ)
    "ml": "ml-IN",  # Malayalam (മലയാളം)
    "pa": "pa-IN",  # Punjabi (ਪੰਜਾਬੀ)
    "or": "od-IN",  # Odia (ଓଡ଼ିଆ)
    "as": "as-IN",  # Assamese (অসমীয়া)
    "ur": "ur-IN",  # Urdu (اردو)
    # Additional Supported Languages
    "ne": "ne-IN",  # Nepali (नेपाली)
    "sa": "sa-IN",  # Sanskrit (संस्कृत)
}

LANG_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "te": "Telugu",
    "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "ne": "Nepali", "sa": "Sanskrit",
}

# System prompts are now loaded from backend/app/prompts.yaml via _load_prompts() / _build_system_prompt()


def _get_sarvam_client():
    """Return a SarvamAI client, or None if key not configured."""
    if not settings.SARVAM_API_KEY:
        return None
    try:
        from sarvamai import SarvamAI  # type: ignore
        return SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
    except ImportError:
        logger.warning("sarvamai SDK not installed; run: pip install sarvamai")
        return None
    except Exception as exc:
        logger.error("sarvam_client_init_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Agent Tools & Search
# ---------------------------------------------------------------------------

def _tool_search_web(query: str) -> str:
    """Perform a real web search using DuckDuckGo."""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            if not results:
                return "No search results found."
            summary = "\n".join([f"- {r['title']}: {r['body']}" for r in results])
            return f"Search Results for '{query}':\n{summary}"
    except ImportError:
        return "Search tool unavailable (duckduckgo_search not installed)."
    except Exception as e:
        logger.error("search_tool_error", error=str(e))
        return f"Search failed: {str(e)}"

def _tool_get_weather(location: str) -> str:
    """Get weather data by searching online."""
    return _tool_search_web(f"current weather in {location} forecast moisture humidity")

def _tool_market_prices(commodity: str, location: str) -> str:
    """Get market prices by searching online."""
    return _tool_search_web(f"current market price (mandi bhav) of {commodity} in {location} today")

async def _tool_agriculture_knowledge(query: str) -> str:
    """Query agriculture knowledge base for farming information, crop cultivation, pest management, etc."""
    from app.core.config import settings
    from app.core.aws_client import get_bedrock_client
    from app.core.cache import get_cached_bedrock_kb_query, cache_bedrock_kb_query
    
    # Check if agriculture KB is configured
    if not settings.BEDROCK_AGRI_KB_ID:
        logger.warning("agri_kb_not_configured", query=query)
        # Fallback to web search
        return _tool_search_web(f"agriculture farming {query}")
    
    # Check cache first (MAJOR COST SAVINGS - OpenSearch is expensive!)
    cached_result = await get_cached_bedrock_kb_query(query, settings.BEDROCK_AGRI_KB_ID)
    if cached_result:
        logger.info("agri_kb_cache_hit", query=query[:50])
        return cached_result
    
    try:
        bedrock = get_bedrock_client()
        response = await asyncio.to_thread(
            bedrock.retrieve_and_generate,
            query=query,
            kb_id=settings.BEDROCK_AGRI_KB_ID,
            max_results=5
        )
        
        # Extract generated text from response
        output_text = response.get("output", {}).get("text", "")
        
        if not output_text:
            logger.warning("agri_kb_empty_response", query=query)
            return f"No relevant farming information found for: {query}"
        
        # Cache the result (semantic + exact match)
        await cache_bedrock_kb_query(query, settings.BEDROCK_AGRI_KB_ID, output_text)
        
        logger.info("agri_kb_success", query=query, response_length=len(output_text), cached=True)
        return output_text
        
    except Exception as e:
        logger.error("agri_kb_error", error=str(e), query=query)
        # Fallback to web search on error
        return _tool_search_web(f"agriculture farming {query}")

AVAILABLE_TOOLS = {
    "SEARCH": _tool_search_web,
    "WEATHER": _tool_get_weather,
    "MARKET": _tool_market_prices,
    "KNOWLEDGE": _tool_agriculture_knowledge,  # NEW: RAG-based agriculture knowledge
}


# ---------------------------------------------------------------------------
# Chat / Reasoning  (Sarvam-M with Tool Use)
# ---------------------------------------------------------------------------

async def _agent_loop(messages: list, system_prompt: str, tools_enabled: bool = True) -> str:
    """
    Run a ReAct-style loop:
    1. AI thinks -> decides to use a tool or answer.
    2. If tool -> execute tool -> add result to history -> repeat.
    3. If answer -> return.
    """
    if not tools_enabled:
        return await asyncio.to_thread(_sync_chat, messages, system_prompt)

    # Augmented system prompt for tool use
    tool_instructions = (
        "\n\nYou have access to these tools to answer questions accurately:\n"
        "- SEARCH: General knowledge, news, government schemes (web search).\n"
        "- WEATHER: Current weather and forecasts.\n"
        "- MARKET: Mandi prices and market trends.\n"
        "- KNOWLEDGE: Agriculture knowledge base - use for farming practices, crop cultivation, "
        "pest management, soil health, fertilizer recommendations, etc.\n\n"
        "To use a tool, your response must be valid JSON strictly in this format:\n"
        '{"tool": "SEARCH", "query": "your search query"}\n'
        '{"tool": "WEATHER", "location": "city name"}\n'
        '{"tool": "MARKET", "commodity": "crop name", "location": "city/state"}\n'
        '{"tool": "KNOWLEDGE", "query": "farming question"}\n\n'
        "IMPORTANT: Use KNOWLEDGE tool for farming/agriculture questions. Use SEARCH for other topics.\n"
        "If no tool is needed, just respond with your expert advice in the user's language."
    )
    
    agent_system = system_prompt + tool_instructions
    
    # We allow max 3 tool turns to prevent loops
    for _ in range(3):
        try:
            # 1. Get AI response
            response_text = await asyncio.to_thread(_sync_chat, messages, agent_system)
            
            # 2. Check if it's a tool call (JSON)
            import json
            import re
            
            # Try to find JSON block
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                try:
                    tool_call = json.loads(json_match.group())
                    tool_name = tool_call.get("tool")
                    
                    if tool_name in AVAILABLE_TOOLS:
                        # Execute Tool
                        logger.info("agent_tool_use", tool=tool_name, params=tool_call)
                        
                        if tool_name == "SEARCH":
                            tool_result = await asyncio.to_thread(_tool_search_web, tool_call.get("query", ""))
                        elif tool_name == "WEATHER":
                            tool_result = await asyncio.to_thread(_tool_get_weather, tool_call.get("location", ""))
                        elif tool_name == "MARKET":
                            tool_result = await asyncio.to_thread(_tool_market_prices, tool_call.get("commodity", ""), tool_call.get("location", ""))
                        elif tool_name == "KNOWLEDGE":
                            tool_result = await _tool_agriculture_knowledge(tool_call.get("query", ""))
                        else:
                            tool_result = "Unknown tool."

                        # Append Exchange to History
                        # Note: We need to append the AI's "thought" (the JSON) and the "observation" (result)
                        # Sarvam might handle this better if we just append the result as a System or User message context
                        messages.append({"role": "assistant", "content": response_text})
                        messages.append({"role": "user", "content": f"Tool Output: {tool_result}\n\nNow answer the user's original request based on this."})
                        continue  # Loop again to get final answer
                        
                except json.JSONDecodeError:
                    pass # Not valid JSON, treat as final answer

            # If no valid tool call found, this is the final answer
            return response_text

        except Exception as e:
            logger.error("agent_loop_error", error=str(e))
            return "I apologize, but I encountered an error while processing your request."

    return "I apologize, this request is taking too long."


def _sync_chat(messages: list, system: str) -> str:
    client = _get_sarvam_client()
    if not client:
        raise RuntimeError("no_sarvam_client — check SARVAM_API_KEY")

    # Sarvam API does not support a "system" role — prepend the system prompt
    # to the first user message so context is preserved.
    combined: list = []
    system_injected = False
    for m in messages:
        if m["role"] == "user" and not system_injected:
            combined.append({"role": "user", "content": f"{system}\n\n---\n\n{m['content']}"})
            system_injected = True
        else:
            combined.append(m)
    if not system_injected:
        # Fallback: no user message found — inject as opening user turn
        combined = [{"role": "user", "content": system}] + messages

    response = client.chat.completions(
        messages=combined,
        temperature=0.3,
        top_p=0.9,
        max_tokens=1024,
    )

    if hasattr(response, "choices"):
        return response.choices[0].message.content
    if isinstance(response, dict):
        return response["choices"][0]["message"]["content"]
    return str(response)


async def get_ai_response(
    message: str,
    language: str = "en",
    conversation_history: Optional[List[ChatMessageModel]] = None,
    category: Optional[str] = None,
    farmer_profile: Optional[FarmerProfile] = None,
) -> dict:
    """Generate AI response using Sarvam-M model."""
    # Apply AWS Guardrail (ONLY for English)
    if language == "en":
        from app.core.aws_client import get_bedrock_client
        bedrock = get_bedrock_client()
        if bedrock:
            try:
                # Run sync in thread to avoid blocking loop
                guard_res = await asyncio.to_thread(bedrock.apply_guardrail, message, "INPUT")
                if guard_res.get("action") == "GUARDRAIL_INTERVENED":
                    logger.warning("guardrail_blocked_input", message=message[:50])
                    return {
                        "response": "I apologize, but I cannot answer that question as it violates our safety policies.",
                        "language": language,
                        "model": "guardrail-intervention",
                        "tokens_used": 0,
                    }
            except Exception as e:
                logger.error("guardrail_check_failed", error=str(e))
                # Fail open (continue)

    lang_name = LANG_NAMES.get(language, "English")
    profile_ctx = ""
    if farmer_profile:
        ctx_parts = []

        # Basic farmer info
        if farmer_profile.state:
            loc = farmer_profile.state
            if farmer_profile.district:
                loc = f"{farmer_profile.district}, {farmer_profile.state}"
            ctx_parts.append(f"Location: {loc}")

        if farmer_profile.farming_type:
            ctx_parts.append(f"Farming approach: {farmer_profile.farming_type}")

        # Multi-crop list (preferred)
        if farmer_profile.crops:
            primary = next((c for c in farmer_profile.crops if c.is_primary), None)
            if primary:
                ctx_parts.append(f"Primary crop: {primary.crop_name}" +
                    (f" ({primary.variety})" if primary.variety else "") +
                    (f", {primary.area_acres} acres" if primary.area_acres else "") +
                    (f", {primary.season} season" if primary.season else "") +
                    (f", {primary.irrigation} irrigation" if primary.irrigation else "") +
                    (f", {primary.soil_type} soil" if primary.soil_type else ""))

            other_crops = [c for c in farmer_profile.crops if not c.is_primary]
            if other_crops:
                other_names = ", ".join(
                    c.crop_name + (f" ({c.area_acres} ac)" if c.area_acres else "")
                    for c in other_crops
                )
                ctx_parts.append(f"Also grows: {other_names}")

            # Collect all unique soil types and seasons across crops
            soils = list({c.soil_type for c in farmer_profile.crops if c.soil_type})
            seasons = list({c.season for c in farmer_profile.crops if c.season})
            irrigations = list({c.irrigation for c in farmer_profile.crops if c.irrigation})
            if soils:
                ctx_parts.append(f"Soil type(s): {', '.join(soils)}")
            if seasons:
                ctx_parts.append(f"Season(s): {', '.join(seasons)}")
            if irrigations:
                ctx_parts.append(f"Irrigation: {', '.join(irrigations)}")

            total_area = sum(c.area_acres or 0 for c in farmer_profile.crops)
            if total_area > 0:
                ctx_parts.append(f"Total farm area: {total_area:.1f} acres")

        else:
            # Fallback: legacy single-crop fields
            if farmer_profile.crop:
                ctx_parts.append(f"Primary crop: {farmer_profile.crop}")
            if farmer_profile.soil_type:
                ctx_parts.append(f"Soil: {farmer_profile.soil_type}")
            if farmer_profile.season:
                ctx_parts.append(f"Season: {farmer_profile.season}")

        if ctx_parts:
            profile_ctx = "\nFarmer context: " + " | ".join(ctx_parts)

    system_prompt_base = _build_system_prompt(category)

    system = (
        system_prompt_base
        + f"\n\nRespond in {lang_name}. Language Code: {language}"
        + profile_ctx
    )

    messages: list = []
    if conversation_history:
        # Sarvam requires messages to start with a user turn.
        # Re-interleave history keeping only user→assistant pairs (skips leading assistant welcome).
        cleaned: list = []
        last_role = None
        for m in conversation_history[-10:]:
            # Normalize roles
            role = m.role if m.role in ["user", "assistant"] else "user"
            
            if role == "user":
                cleaned.append({"role": "user", "content": m.content})
                last_role = "user"
            elif role == "assistant" and last_role == "user":
                cleaned.append({"role": "assistant", "content": m.content})
                last_role = "assistant"
        messages = cleaned
    
    # Ensure we don't duplicate the last user message if frontend sent it in history
    if not messages or (messages and messages[-1]["role"] == "assistant"):
        messages.append({"role": "user", "content": message})

    try:
        # Use Agent Loop instead of direct sync_chat
        response_text = await _agent_loop(messages, system, tools_enabled=True)
        return {
            "response": response_text,
            "language": language,
            "model": settings.SARVAM_CHAT_MODEL,
            "tokens_used": len(response_text.split()),
        }
    except Exception as exc:
        logger.error("sarvam_chat_failed", error=str(exc), message_preview=message[:80])
        # Re-raise so the FastAPI route returns a proper 502, not a silent demo response
        raise


# ---------------------------------------------------------------------------
# Text-to-Speech  (Sarvam TTS → base64 WAV)
# ---------------------------------------------------------------------------

def _sync_tts(text: str, language: str) -> Optional[bytes]:
    """Call Sarvam TTS synchronously; returns raw audio bytes or None."""
    client = _get_sarvam_client()
    if not client:
        return None
    try:
        sarvam_lang = SARVAM_LANG.get(language, "en-IN")
        # Sarvam TTS: text_to_speech endpoint
        response = client.text_to_speech.convert(
            inputs=[text[:500]],  # cap at 500 chars per request
            target_language_code=sarvam_lang,
            speaker="meera",      # female Indian voice; works for all 10 Indic langs
            model="bulbul:v1",
            enable_preprocessing=True,
        )
        # SDK may return bytes directly or a response object
        if isinstance(response, (bytes, bytearray)):
            return bytes(response)
        # Some SDK versions return object with .audios list
        if hasattr(response, "audios") and response.audios:
            audio = response.audios[0]
            if isinstance(audio, (bytes, bytearray)):
                return bytes(audio)
            if isinstance(audio, str):
                # already base64
                import base64
                return base64.b64decode(audio)
        if isinstance(response, dict):
            audios = response.get("audios", [])
            if audios:
                import base64
                return base64.b64decode(audios[0]) if isinstance(audios[0], str) else audios[0]
        return None
    except Exception as exc:
        logger.warning("sarvam_tts_failed", error=str(exc), language=language)
        return None


async def generate_tts_audio(text: str, language: str = "en") -> Optional[str]:
    """Generate TTS audio for the given text; returns base64-encoded WAV or None."""
    import base64
    # Strip markdown formatting before TTS
    import re
    clean = re.sub(r"[*#_`>~\[\]()]", "", text)
    clean = re.sub(r"\n+", " ", clean).strip()
    if not clean:
        return None
    audio_bytes = await asyncio.to_thread(_sync_tts, clean[:500], language)
    if audio_bytes:
        return base64.b64encode(audio_bytes).decode("utf-8")
    return None


# ---------------------------------------------------------------------------
# Crop Disease Analysis  (AWS Rekognition labels → Sarvam-M diagnosis)
# Sarvam Vision is OCR-only; we use Rekognition for image understanding.
# ---------------------------------------------------------------------------

def _rekognition_labels(image_bytes: bytes) -> list[str]:
    """Detect visual labels from a crop image using AWS Rekognition."""
    try:
        import boto3
        if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
            return []
        rek = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        resp = rek.detect_labels(
            Image={"Bytes": image_bytes}, MaxLabels=20, MinConfidence=65
        )
        return [lbl["Name"] for lbl in resp["Labels"]]
    except Exception as exc:
        logger.warning("rekognition_labels_failed", error=str(exc))
        return []


def _sync_diagnose(prompt: str) -> str:
    """Use Sarvam-M to generate a structured crop-disease JSON response."""
    client = _get_sarvam_client()
    if not client:
        raise RuntimeError("no_client")
    system = (
        "You are an expert plant pathologist for Indian crops. "
        "Always respond with a valid JSON object containing exactly these keys: "
        "disease_name, confidence (float 0-1), severity (low/medium/high), "
        "description (string), symptoms (list of strings), "
        "treatment (list of strings), prevention (list of strings), "
        "affected_crops (list of strings). No extra text outside JSON."
    )
    # Sarvam API does not support system role — prefix instructions to user message
    response = client.chat.completions(
        messages=[{"role": "user", "content": f"{system}\n\n{prompt}"}],
        temperature=0.2,
        max_tokens=800,
    )
    if hasattr(response, "choices"):
        return response.choices[0].message.content
    if isinstance(response, dict):
        return response["choices"][0]["message"]["content"]
    return str(response)


async def analyze_crop_disease(
    image_bytes: bytes,
    language: str = "en",
    crop_name: Optional[str] = None,
) -> dict:
    """Analyze crop image: AWS Rekognition for visual labels + Sarvam-M for diagnosis."""
    lang_name = LANG_NAMES.get(language, "English")
    crop_ctx = f" {crop_name}" if crop_name else ""

    # Step 1 — visual labels via Rekognition (if AWS creds available)
    labels = await asyncio.to_thread(_rekognition_labels, image_bytes)
    label_text = ", ".join(labels) if labels else None

    # Step 2 — diagnosis prompt for Sarvam-M
    if label_text:
        prompt = (
            f"An image of a{crop_ctx} crop was analysed by AWS Rekognition and shows: {label_text}. "
            f"Based on these visual cues, diagnose any plant diseases, pest damage, or nutrient deficiencies. "
            f"Respond in {lang_name}."
        )
    else:
        prompt = (
            f"A{crop_ctx} crop image was uploaded for disease diagnosis. "
            f"Assess the most common diseases affecting {crop_name or 'Indian crops'} and provide "
            f"a structured diagnosis. Respond in {lang_name}."
        )

    try:
        raw = await asyncio.to_thread(_sync_diagnose, prompt)
        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        # Fallback: wrap response text
        return {
            "disease_name": "Analysis Complete",
            "confidence": 0.80,
            "severity": "medium",
            "description": raw[:400],
            "symptoms": [],
            "treatment": [],
            "prevention": [],
            "affected_crops": [crop_name] if crop_name else [],
        }
    except Exception as exc:
        logger.warning("crop_disease_fallback", error=str(exc))
        return _demo_vision(crop_name, language)


# ---------------------------------------------------------------------------
# Demo / offline fallbacks
# ---------------------------------------------------------------------------

def _demo_chat(message: str, language: str) -> dict:
    responses = {
        "hi": "नमस्ते किसान भाई! आपका प्रश्न प्राप्त हुआ। कृपया अपनी फसल और मिट्टी की जानकारी दें।",
        "mr": "नमस्कार शेतकरी बंधू! तुमचा प्रश्न मिळाला. कृपया तुमच्या पिकाची माहिती द्या.",
        "ta": "வணக்கம் விவசாயி! உங்கள் கேள்வி கிடைத்தது. உங்கள் பயிர் பற்றிய தகவலை தயவுசெய்து வழங்குங்கள்.",
        "en": (
            "Hello farmer! I'm AgriAI, your agricultural assistant. "
            "I can help with crop diseases, weather-based decisions, government schemes, and market prices. "
            "What would you like to know?"
        ),
    }
    return {
        "response": responses.get(language, responses["en"]),
        "language": language,
        "model": "demo",
        "tokens_used": 0,
    }


def _demo_vision(crop_name: Optional[str], language: str) -> dict:
    crop = crop_name or "crop"
    return {
        "disease_name": f"Leaf Blight ({crop})",
        "confidence": 0.85,
        "severity": "medium",
        "description": (
            f"Early signs of fungal infection detected on {crop}. "
            "Brownish water-soaked lesions visible on leaves."
        ),
        "symptoms": [
            "Brown water-soaked lesions on leaves",
            "Yellowing around infected areas",
            "Premature leaf drop",
        ],
        "treatment": [
            "Apply Mancozeb 75WP @ 2.5g/litre water",
            "Remove and destroy infected plant parts",
            "Avoid overhead irrigation",
        ],
        "prevention": [
            "Use certified disease-free seeds",
            "Maintain proper plant spacing",
            "Ensure good drainage",
            "Rotate crops every season",
        ],
        "affected_crops": [crop],
    }
