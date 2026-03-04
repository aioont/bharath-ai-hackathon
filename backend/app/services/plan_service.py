"""
Farm Plan Generation Service
Orchestrates: dynamic Q&A → mock IoT sensor data → Sarvam-M plan generation → TTS
"""
from __future__ import annotations
import asyncio
import structlog
from typing import Optional

from app.core.config import settings
from app.services.sarvam_service import _agent_loop, _build_system_prompt, LANG_NAMES, generate_tts_audio

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Dynamic Planning Questions  (shown one-by-one to collect farmer context)
# ---------------------------------------------------------------------------

PLAN_QUESTIONS = [
    {
        "id": "location",
        "key": "location",
        "question_en": "What is your village/district and state?",
        "placeholder": "e.g. Pune, Maharashtra",
        "type": "text",
        "required": True,
    },
    {
        "id": "crop",
        "key": "crop",
        "question_en": "Which crop do you want to grow or plan for?",
        "placeholder": "e.g. Wheat, Rice, Cotton",
        "type": "text",
        "required": True,
    },
    {
        "id": "area",
        "key": "area_acres",
        "question_en": "How many acres of land do you have available?",
        "placeholder": "e.g. 5 acres",
        "type": "number",
        "required": True,
    },
    {
        "id": "soil",
        "key": "soil_type",
        "question_en": "What type of soil is on your farm?",
        "placeholder": "Black cotton / Red loamy / Sandy / Alluvial",
        "type": "select",
        "options": ["Black cotton", "Red loamy", "Sandy", "Alluvial", "Clay", "Not sure"],
        "required": True,
    },
    {
        "id": "water",
        "key": "water_source",
        "question_en": "What is your main source of irrigation water?",
        "placeholder": "Borewell / Canal / Rainfed",
        "type": "select",
        "options": ["Borewell", "Canal", "Rainfed", "Drip irrigation", "River/Tank", "Other"],
        "required": True,
    },
    {
        "id": "season",
        "key": "season",
        "question_en": "Which season are you planning for?",
        "type": "select",
        "options": ["Kharif (June-Oct)", "Rabi (Nov-Mar)", "Zaid (Mar-Jun)", "Year-round"],
        "required": True,
    },
    {
        "id": "budget",
        "key": "budget_inr",
        "question_en": "What is your approximate budget for this crop season? (₹)",
        "placeholder": "e.g. 50000",
        "type": "number",
        "required": False,
    },
    {
        "id": "issues",
        "key": "previous_issues",
        "question_en": "Any previous crop problems? (pests, low yield, waterlogging, etc.)",
        "placeholder": "e.g. aphid attack last year, poor germination",
        "type": "text",
        "required": False,
    },
]

# ---------------------------------------------------------------------------
# Mock IoT / Sensor Data  (realistic data for demo purposes)
# ---------------------------------------------------------------------------

def get_mock_soil_data(crop: str = "", location: str = "") -> dict:
    """Return realistic mock soil sensor reading."""
    import random
    random.seed(hash(f"{crop}{location}") % 1000)
    return {
        "source": "mock_iot_sensor",
        "timestamp": "2026-03-01T19:00:00+05:30",
        "location": location or "Field A",
        "soil_ph": round(random.uniform(6.2, 7.8), 1),
        "moisture_pct": round(random.uniform(28, 62), 1),
        "nitrogen_kg_ha": round(random.uniform(50, 180), 1),
        "phosphorus_kg_ha": round(random.uniform(20, 80), 1),
        "potassium_kg_ha": round(random.uniform(80, 250), 1),
        "organic_matter_pct": round(random.uniform(0.8, 3.2), 2),
        "temperature_c": round(random.uniform(18, 34), 1),
        "ec_ds_m": round(random.uniform(0.3, 1.8), 2),  # electrical conductivity
    }

def get_mock_weather_sensor(location: str = "") -> dict:
    """Return realistic mock weather sensor data."""
    import random
    random.seed(hash(location or "default") % 999)
    return {
        "source": "mock_weather_sensor",
        "timestamp": "2026-03-01T19:00:00+05:30",
        "location": location or "Farm Site",
        "temperature_c": round(random.uniform(20, 38), 1),
        "humidity_pct": round(random.uniform(40, 90), 1),
        "rainfall_mm_last7d": round(random.uniform(0, 45), 1),
        "wind_speed_kmh": round(random.uniform(5, 30), 1),
        "uv_index": round(random.uniform(4, 11), 1),
        "forecast_7d": "Partly cloudy, low chance of rain (15%)",
        "frost_risk": "Low",
        "heat_stress_risk": "Moderate" if random.random() > 0.5 else "Low",
    }

def get_mock_irrigation_status(crop: str = "") -> dict:
    """Return realistic mock irrigation/leaf data."""
    import random
    random.seed(hash(crop or "default") % 777)
    return {
        "source": "mock_iot_irrigation",
        "timestamp": "2026-03-01T19:00:00+05:30",
        "daily_water_requirement_mm": round(random.uniform(4, 12), 1),
        "last_irrigation_days_ago": random.randint(1, 7),
        "soil_moisture_deficit_mm": round(random.uniform(10, 50), 1),
        "recommended_irrigation_mm": round(random.uniform(25, 60), 1),
        "leaf_area_index": round(random.uniform(1.2, 4.5), 2),
        "leaf_color_status": random.choice([
            "Healthy green — no issues detected",
            "Slight yellowing at margins — possible N deficiency",
            "Dark green — adequate nutrition",
            "Pale yellow — check iron/zinc levels",
        ]),
        "estimated_yield_q_per_acre": round(random.uniform(8, 25), 1),
        "growth_stage": random.choice([
            "Germination (0-10 days)",
            "Vegetative (10-40 days)",
            "Flowering (40-70 days)",
            "Grain filling (70-95 days)",
            "Maturity (>95 days)",
        ]),
    }

# ---------------------------------------------------------------------------
# Farm Plan Generation
# ---------------------------------------------------------------------------

def _format_sensor_context(answers: dict, soil: dict, weather: dict, irrigation: dict) -> str:
    """Build a rich sensor + farmer context string for the AI prompt."""
    ctx = []
    ctx.append(f"Location: {answers.get('location', 'India')}")
    ctx.append(f"Target crop: {answers.get('crop', 'unknown')}")
    ctx.append(f"Farm area: {answers.get('area_acres', 'unknown')} acres")
    ctx.append(f"Soil type: {answers.get('soil_type', 'unknown')}")
    ctx.append(f"Water source: {answers.get('water_source', 'unknown')}")
    ctx.append(f"Season: {answers.get('season', 'unknown')}")
    if answers.get('budget_inr'):
        ctx.append(f"Budget: ₹{answers['budget_inr']}")
    if answers.get('previous_issues'):
        ctx.append(f"Previous issues: {answers['previous_issues']}")

    # IoT data
    ctx.append(f"\nSoil Sensor: pH={soil['soil_ph']}, Moisture={soil['moisture_pct']}%, "
               f"N={soil['nitrogen_kg_ha']}kg/ha, P={soil['phosphorus_kg_ha']}kg/ha, "
               f"K={soil['potassium_kg_ha']}kg/ha, Organic matter={soil['organic_matter_pct']}%")
    ctx.append(f"Weather Sensor: Temp={weather['temperature_c']}°C, Humidity={weather['humidity_pct']}%, "
               f"Rainfall last 7d={weather['rainfall_mm_last7d']}mm, "
               f"Forecast: {weather['forecast_7d']}")
    ctx.append(f"Irrigation: Daily water req={irrigation['daily_water_requirement_mm']}mm, "
               f"Last irrigation {irrigation['last_irrigation_days_ago']} days ago, "
               f"Recommend {irrigation['recommended_irrigation_mm']}mm next irrigation")
    ctx.append(f"Crop health: Leaf status — {irrigation['leaf_color_status']}, "
               f"Growth stage: {irrigation['growth_stage']}, "
               f"Estimated yield: {irrigation['estimated_yield_q_per_acre']} q/acre")
    return "\n".join(ctx)


async def get_plan_questions(language: str = "en") -> list:
    """Return the list of dynamic planning questions."""
    return PLAN_QUESTIONS


async def generate_farm_plan(
    answers: dict,
    language: str = "en",
    tts_enabled: bool = False,
) -> dict:
    """Generate a comprehensive farm plan from collected answers + IoT sensor data."""
    lang_name = LANG_NAMES.get(language, "English")
    crop = answers.get("crop", "")
    location = answers.get("location", "")

    # Fetch mock sensor data
    soil = get_mock_soil_data(crop=crop, location=location)
    weather = get_mock_weather_sensor(location=location)
    irrigation = get_mock_irrigation_status(crop=crop)

    context = _format_sensor_context(answers, soil, weather, irrigation)

    system = (
        "You are AgriAI, an expert Indian agricultural planner. "
        "You have real-time IoT sensor data from the farmer's field. "
        "Generate a comprehensive, actionable FARM PLAN with these sections:\n"
        "1. 🌱 Soil Preparation & Correction (based on soil sensor data)\n"
        "2. 💧 Irrigation Schedule (based on soil moisture & weather)\n"
        "3. 🌾 Sowing Guide (variety, spacing, seed rate, timing)\n"
        "4. 🧪 Fertilizer Plan (based on soil NPK — dose, timing, method)\n"
        "5. 🐛 Pest & Disease Prevention\n"
        "6. 📅 Season Timeline (week-by-week key activities)\n"
        "7. 💰 Budget Estimate (inputs, labour, marketing)\n"
        "8. 📈 Expected Yield & Profit Outlook\n\n"
        f"Respond entirely in {lang_name}. Be specific with product names, quantities, Indian market prices.\n"
        "Keep each section brief but actionable."
    )

    messages = [{"role": "user", "content": f"Farm context:\n{context}\n\nGenerate the complete farm plan."}]

    # Disable tools to prevent tool calls in output
    plan_text = await _agent_loop(messages, system, tools_enabled=False)

    audio_b64 = None
    if tts_enabled:
        # Summarise plan for TTS (first 400 chars of cleaned text)
        import re
        clean = re.sub(r"[*#_`>\[\]()]", "", plan_text)
        clean = re.sub(r"\n+", " ", clean).strip()[:400]
        audio_b64 = await generate_tts_audio(clean, language)

    return {
        "plan": plan_text,
        "language": language,
        "sensor_data": {
            "soil": soil,
            "weather": weather,
            "irrigation": irrigation,
        },
        "audio_base64": audio_b64,
        "audio_format": "wav",
    }
