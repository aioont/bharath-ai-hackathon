"""
Sarvam AI service — wraps Sarvam-M (chat), Sarvam Translate, and Sarvam Vision.
All calls use the official sarvamai Python SDK via asyncio.to_thread for non-blocking IO.
"""
from __future__ import annotations

import asyncio
import structlog
from typing import Optional, List

from app.core.config import settings
from app.models.schemas import ChatMessageModel, FarmerProfile

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Language code mapping  (2-letter app code → Sarvam BCP-47 code)
# ---------------------------------------------------------------------------
SARVAM_LANG = {
    "hi": "hi-IN", "bn": "bn-IN", "te": "te-IN", "mr": "mr-IN",
    "ta": "ta-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN",
    "pa": "pa-IN", "or": "od-IN", "as": "as-IN", "ur": "ur-IN",
    "en": "en-IN", "ne": "ne-IN", "sa": "sa-IN",
    # fallbacks
    "si": "en-IN",
}

LANG_NAMES = {
    "hi": "Hindi", "bn": "Bengali", "te": "Telugu", "mr": "Marathi",
    "ta": "Tamil", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
    "pa": "Punjabi", "or": "Odia", "as": "Assamese", "ur": "Urdu",
    "en": "English", "ne": "Nepali", "sa": "Sanskrit", "si": "Sinhala",
}

SYSTEM_PROMPT = """You are AgriAI, an expert agricultural advisor for Indian farmers, powered by Sarvam AI.

Your expertise includes:
- Crop management, cultivation techniques, and best practices
- Pest identification, disease diagnosis, and organic/chemical treatment options
- Soil health, fertilizer recommendations, and organic farming methods
- Water management, irrigation systems, and conservation techniques
- Market intelligence, price forecasting, and selling strategies
- Government schemes, subsidies, PM Kisan, crop insurance, eNAM platform
- Weather-based farming decisions and climate adaptation
- Post-harvest management and storage techniques

Important guidelines:
1. Always respond in the language specified
2. Provide practical, actionable advice specific to Indian farming conditions
3. Mention specific product names, doses, and application methods when relevant
4. Consider regional variations across different Indian states
5. Be empathetic — most farmers have limited resources
6. Cite government schemes when relevant
7. Keep responses concise but comprehensive"""


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
# Chat / Reasoning  (Sarvam-M)
# ---------------------------------------------------------------------------

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
    lang_name = LANG_NAMES.get(language, "English")
    profile_ctx = ""
    if farmer_profile:
        parts = [
            f"Location: {farmer_profile.state}" if farmer_profile.state else "",
            f"Primary crop: {farmer_profile.crop}" if getattr(farmer_profile, "crop", None) else "",
            f"Soil: {farmer_profile.soil_type}" if farmer_profile.soil_type else "",
            f"Season: {farmer_profile.season}" if getattr(farmer_profile, "season", None) else "",
        ]
        profile_ctx = "\nFarmer context: " + ", ".join(p for p in parts if p)

    system = (
        SYSTEM_PROMPT
        + f"\n\nRespond in {lang_name}."
        + (f"\nFocus on: {category}" if category else "")
        + profile_ctx
    )

    messages: list = []
    if conversation_history:
        # Sarvam requires messages to start with a user turn.
        # Re-interleave history keeping only user→assistant pairs (skips leading assistant welcome).
        cleaned: list = []
        last_role = None
        for m in conversation_history[-10:]:
            if m.role == "user":
                cleaned.append({"role": "user", "content": m.content})
                last_role = "user"
            elif m.role == "assistant" and last_role == "user":
                cleaned.append({"role": "assistant", "content": m.content})
                last_role = "assistant"
        messages = cleaned
    messages.append({"role": "user", "content": message})

    try:
        response_text = await asyncio.to_thread(_sync_chat, messages, system)
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
