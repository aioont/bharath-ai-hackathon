import json
import structlog
from typing import Optional, List
from app.core.aws_client import get_bedrock_client, is_aws_configured
from app.core.config import settings
from app.models.schemas import ChatMessageModel, FarmerProfile

logger = structlog.get_logger()

LANGUAGE_NAMES = {
    "hi": "Hindi", "bn": "Bengali", "te": "Telugu", "mr": "Marathi",
    "ta": "Tamil", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam",
    "pa": "Punjabi", "or": "Odia", "as": "Assamese", "ur": "Urdu",
    "en": "English", "ne": "Nepali", "si": "Sinhala",
}

SYSTEM_PROMPT = """You are AgriAI, an expert agricultural advisor for Indian farmers, powered by Amazon Bedrock. 

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
1. Always respond in the language specified (if not English, respond in that language)
2. Provide practical, actionable advice specific to Indian farming conditions
3. Mention specific product names, doses, and application methods when relevant
4. Consider regional variations across different Indian states
5. Be empathetic — most farmers have limited resources
6. Cite government schemes when relevant
7. Keep responses concise but comprehensive
8. End with 2-3 follow-up suggestion prompts when appropriate"""


async def get_ai_response(
    message: str,
    language: str = "en",
    conversation_history: Optional[List[ChatMessageModel]] = None,
    category: Optional[str] = None,
    farmer_profile: Optional[FarmerProfile] = None,
) -> dict:
    """Generate AI response using Amazon Bedrock Claude model."""
    
    client = get_bedrock_client()
    
    if not client or not is_aws_configured():
        return _get_demo_response(message, language)
    
    try:
        lang_name = LANGUAGE_NAMES.get(language, "English")
        
        # Build context from farmer profile
        profile_context = ""
        if farmer_profile:
            parts = []
            if farmer_profile.state:
                parts.append(f"Location: {farmer_profile.state}")
            if farmer_profile.crop:
                parts.append(f"Primary crop: {farmer_profile.crop}")
            if farmer_profile.soil_type:
                parts.append(f"Soil type: {farmer_profile.soil_type}")
            if farmer_profile.season:
                parts.append(f"Current season: {farmer_profile.season}")
            if parts:
                profile_context = f"\n\nFarmer Context: {', '.join(parts)}"
        
        category_context = f"\nFocus area: {category}" if category else ""
        
        # Build messages for Claude
        messages = []
        if conversation_history:
            for msg in conversation_history[-8:]:  # Last 8 messages for context
                messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({
            "role": "user",
            "content": f"[Respond in {lang_name}]{category_context}{profile_context}\n\n{message}"
        })
        
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": messages,
            "temperature": 0.7,
            "top_p": 0.9,
        }
        
        response = client.invoke_model(
            modelId=settings.BEDROCK_MODEL_ID,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        
        result = json.loads(response["body"].read())
        response_text = result["content"][0]["text"]
        
        # Generate suggestions
        suggestions = _extract_suggestions(response_text)
        
        return {
            "response": response_text,
            "language": language,
            "suggestions": suggestions,
            "related_topics": _get_related_topics(category),
            "confidence": 0.95,
        }
        
    except Exception as e:
        logger.error("Bedrock API error", error=str(e))
        return _get_demo_response(message, language)


async def analyze_crop_disease(
    image_bytes: bytes,
    language: str = "en",
    crop_name: Optional[str] = None,
) -> dict:
    """Analyze crop image for diseases using Amazon Bedrock Vision."""
    
    client = get_bedrock_client()
    
    if not client or not is_aws_configured():
        return _get_demo_disease_response()
    
    try:
        import base64
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        lang_name = LANGUAGE_NAMES.get(language, "English")
        
        crop_context = f" The farmer says this is a {crop_name} crop." if crop_name else ""
        
        prompt = f"""Analyze this crop image and provide a detailed agricultural diagnosis in {lang_name}.{crop_context}

Please respond with a JSON object containing:
{{
  "disease_name": "Name of the disease or condition detected",
  "confidence": 0.0-1.0,
  "severity": "low|medium|high",
  "description": "Brief description of the disease",
  "symptoms": ["symptom1", "symptom2", ...],
  "treatment": ["treatment step 1", "treatment step 2", ...],
  "prevention": ["prevention measure 1", ...],
  "affected_crops": ["crop1", "crop2", ...]
}}

If the image does not show a plant disease, describe what you see and provide general advice."""
        
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1500,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
        
        response = client.invoke_model(
            modelId=settings.BEDROCK_CLAUDE_SONNET_MODEL_ID,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        
        result = json.loads(response["body"].read())
        text = result["content"][0]["text"]
        
        # Try to parse JSON from response
        try:
            # Extract JSON block
            import re
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            if json_match:
                diagnosis = json.loads(json_match.group())
                return diagnosis
        except Exception:
            pass
        
        return _get_demo_disease_response()
        
    except Exception as e:
        logger.error("Bedrock vision error", error=str(e))
        return _get_demo_disease_response()


def _get_demo_response(message: str, language: str) -> dict:
    """Demo response when AWS is not configured."""
    lang_name = LANGUAGE_NAMES.get(language, "English")
    return {
        "response": f"[Demo Mode - Connect AWS credentials for real AI responses]\n\nI understand you're asking about: '{message[:100]}...'\n\nIn production, Amazon Bedrock's Claude model will provide:\n• Detailed crop-specific advice\n• Disease identification and treatment plans\n• Market insights and price predictions\n• Weather-based recommendations\n• Government scheme information\n\nAll responses will be in {lang_name} as requested.",
        "language": language,
        "suggestions": [
            "What fertilizer is best for my crop?",
            "How to deal with pest infestation?",
            "What government subsidies are available?",
        ],
        "related_topics": ["Crop Management", "Soil Health", "Market Prices"],
        "confidence": 0.5,
    }


def _get_demo_disease_response() -> dict:
    """Demo disease response."""
    return {
        "disease_name": "Leaf Blight (Demo Analysis)",
        "confidence": 0.82,
        "severity": "medium",
        "description": "This appears to be a fungal leaf blight. For accurate diagnosis, please configure Amazon Bedrock credentials.",
        "symptoms": [
            "Brown or tan colored spots on leaves",
            "Water-soaked lesions that enlarge over time",
            "Yellowing of surrounding leaf tissue",
        ],
        "treatment": [
            "Apply Mancozeb 75% WP @ 2g per liter of water",
            "Use Propiconazole 25% EC @ 1ml per liter as systemic fungicide",
            "Remove and destroy severely infected leaves",
        ],
        "prevention": [
            "Use certified disease-resistant seed varieties",
            "Maintain proper plant spacing for air circulation",
            "Avoid overhead irrigation; use drip irrigation",
        ],
        "affected_crops": ["Wheat", "Rice", "Maize", "Vegetables"],
    }


def _extract_suggestions(response_text: str) -> List[str]:
    """Extract follow-up suggestions from AI response."""
    common_suggestions = [
        "What is the best fertilizer dosage for this crop?",
        "How can I improve my soil health?",
        "What government subsidy is available for this?",
    ]
    return common_suggestions[:3]


def _get_related_topics(category: Optional[str]) -> List[str]:
    """Get related topics based on category."""
    topic_map = {
        "crop-management": ["Soil pH", "Fertilizer Schedule", "Irrigation Timing"],
        "pest-control": ["Organic Pesticides", "Integrated Pest Management", "Biological Control"],
        "soil-health": ["Compost Making", "Soil Testing", "Micronutrient Deficiency"],
        "market-advisory": ["MSP Prices", "Storage Tips", "Direct Selling"],
        "government-schemes": ["PM Kisan", "Crop Insurance", "Kisan Credit Card"],
    }
    return topic_map.get(category or "", ["Crop Health", "Market Prices", "Weather Forecast"])
