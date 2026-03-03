"""
Market Analyzer Service
Sources: agmarknet API proxy → DuckDuckGo market news → Open-Meteo yield weather → Sarvam-M summary
"""
from __future__ import annotations
import asyncio
import structlog
from typing import Optional
from datetime import date, timedelta

import httpx

from app.services.sarvam_service import _agent_loop, LANG_NAMES, generate_tts_audio

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# agmarknet API Proxy
# ---------------------------------------------------------------------------

AGMARKNET_BASE = "https://api.agmarknet.gov.in/v1/daily-price-arrival/report"

# Commodity ID map (agmarknet codes for common crops)
COMMODITY_CODES: dict[str, str] = {
    "wheat": "24", "rice": "29", "maize": "11", "cotton": "71",
    "onion": "127", "potato": "138", "tomato": "32", "sugarcane": "30",
    "soybean": "16", "groundnut": "17", "mustard": "23", "chilli": "50",
    "turmeric": "51", "garlic": "131", "banana": "81", "mango": "85",
}

# State code map (agmarknet codes)
STATE_CODES: dict[str, str] = {
    "maharashtra": "8", "punjab": "4", "uttar pradesh": "9",
    "madhya pradesh": "14", "rajasthan": "5", "haryana": "3",
    "gujarat": "7", "karnataka": "16", "andhra pradesh": "1",
    "telangana": "28", "tamil nadu": "19", "kerala": "17",
    "west bengal": "22", "bihar": "10", "odisha": "21",
}


async def fetch_agmarknet_prices(commodity: str = "wheat", state: str = "maharashtra") -> dict:
    """Proxy agmarknet API for live mandi prices. Falls back to realistic mock data."""
    today = date.today().strftime("%Y-%m-%d")
    from_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    commodity_code = COMMODITY_CODES.get(commodity.lower(), "24")
    state_code = STATE_CODES.get(state.lower(), "8")

    params = {
        "from_date": from_date,
        "to_date": today,
        "data_type": "100004",
        "group": "6",
        "commodity": commodity_code,
        "state": f"[{state_code}]",
        "district": "[100001]",
        "market": "[100002]",
        "grade": "[100003]",
        "variety": "[100007]",
        "page": "1",
        "limit": "10",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(AGMARKNET_BASE, params=params)
            if resp.status_code == 200:
                data = resp.json()
                logger.info("agmarknet_success", commodity=commodity, state=state)
                return {"source": "agmarknet_live", "data": data, "commodity": commodity, "state": state}
    except Exception as exc:
        logger.warning("agmarknet_failed", error=str(exc))

    # Fallback: realistic mock mandi data
    return _mock_mandi_prices(commodity, state, today)


def _mock_mandi_prices(commodity: str, state: str, date_str: str) -> dict:
    """Realistic mock mandi price data as fallback."""
    import random
    random.seed(hash(f"{commodity}{state}{date_str}") % 9999)
    base_prices = {
        "wheat": 2200, "rice": 2250, "maize": 1900, "cotton": 6500,
        "onion": 1200, "potato": 900, "tomato": 1500, "sugarcane": 340,
        "soybean": 4300, "groundnut": 5000, "mustard": 5500, "chilli": 8000,
        "turmeric": 9500, "garlic": 6000, "banana": 2200, "mango": 4000,
    }
    base = base_prices.get(commodity.lower(), 2500)
    variation = random.uniform(0.85, 1.15)
    modal = int(base * variation)
    mandis = ["Nashik", "Amravati", "Pune", "Kolhapur", "Nagpur", "Indore",
              "Ludhiana", "Amritsar", "Karnal", "Jaipur"]
    rows = []
    for i in range(min(5, len(mandis))):
        mv = random.uniform(0.92, 1.08)
        rows.append({
            "market": mandis[i % len(mandis)],
            "state": state.title(),
            "commodity": commodity.title(),
            "variety": "FAQ",
            "grade": "A",
            "min_price": int(modal * mv * 0.92),
            "modal_price": int(modal * mv),
            "max_price": int(modal * mv * 1.08),
            "unit": "Quintal",
            "arrival_tonnes": random.randint(50, 500),
            "date": date_str,
        })
    return {
        "source": "mock_fallback",
        "commodity": commodity,
        "state": state,
        "date": date_str,
        "data": rows,
        "msp": _get_msp(commodity),
    }


def _get_msp(commodity: str) -> Optional[int]:
    """Return 2024-25 MSP in ₹/quintal for major crops."""
    msp_table = {
        "wheat": 2275, "rice": 2300, "maize": 2090, "cotton": 7121,
        "soybean": 4892, "groundnut": 6783, "mustard": 5650,
        "sugarcane": 340, "sunflower": 7280, "jowar": 3371, "bajra": 2625,
    }
    return msp_table.get(commodity.lower())


# ---------------------------------------------------------------------------
# Market News (DuckDuckGo)
# ---------------------------------------------------------------------------

async def fetch_market_news(commodity: str = "") -> list[dict]:
    """Fetch latest agri market news via DuckDuckGo search."""
    try:
        from duckduckgo_search import DDGS
        current_year = date.today().year
        # More relevant query: "{commodity} market price news India {year}"
        query = f"{commodity} crop market price news India {current_year}" if commodity else f"agricultural market price news India {current_year}"
        
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: list(DDGS().text(query, max_results=5))
        )
        return [{"title": r.get("title", ""), "body": r.get("body", ""), "href": r.get("href", "")} for r in results]
    except Exception as exc:
        logger.warning("market_news_failed", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Yield Weather Window (Open-Meteo)
# ---------------------------------------------------------------------------

async def fetch_yield_weather(location: str = "Delhi") -> dict:
    """Get 14-day weather forecast for yield planning using Open-Meteo."""
    # Low-tech geocoding for speed
    COORDS = {
        "delhi": (28.6, 77.2), "mumbai": (19.1, 72.9), "lucknow": (26.8, 80.9), "jaipur": (26.9, 75.8),
        "bhopal": (23.3, 77.4), "pune": (18.5, 73.9), "hyderabad": (17.4, 78.5), "bangalore": (12.9, 77.6),
        "chennai": (13.1, 80.3), "chandigarh": (30.7, 76.8), "nagpur": (21.1, 79.1), "patna": (25.6, 85.1),
        "kolkata": (22.6, 88.4), "ahmedabad": (23.0, 72.6), "indore": (22.7, 75.9), "ludhiana": (30.9, 75.9),
        "amritsar": (31.6, 74.9), "agra": (27.2, 78.0), "coimbatore": (11.0, 77.0), "nashik": (20.0, 73.8),
    }
    lat, lon = COORDS.get(location.lower().split(",")[0].strip(), (20.6, 78.0))  # Default: central India (Vidarbha)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration",
                    "timezone": "Asia/Kolkata",
                    "forecast_days": 14,
                }
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        logger.warning("yield_weather_failed", error=str(exc))

    return {"error": "Weather forecast unavailable", "lat": lat, "lon": lon}


def _weather_analyze(weather_data: dict) -> str:
    """Analyze weather data for simple actionable advice."""
    try:
        daily = weather_data.get("daily", {})
        if not daily:
            return "Weather details unavailable."
        
        temps_max = daily.get("temperature_2m_max", [])
        rain_sum = daily.get("precipitation_sum", [])
        
        avg_max = sum(temps_max) / len(temps_max) if temps_max else 30
        total_rain = sum(rain_sum) if rain_sum else 0
        
        if total_rain > 50:
            return f"Heavy rain alert ({total_rain}mm expected). Avoid harvesting or storage without cover."
        elif total_rain > 10:
            return f"Light to moderate rain ({total_rain}mm). Good for standing crops, bad for harvesting."
        elif avg_max > 38:
            return f"Heatwave conditions (Avg Max {avg_max:.1f}°C). Irrigate frequently."
        else:
            return "Clear weather expected. Safe for harvesting and transport."
    except Exception:
        return "Weather analysis unavailable."


def _get_season_context() -> str:
    m = date.today().month
    if 6 <= m <= 9: return "Kharif (Monsoon) - Sowing/Growing Phase"
    elif 10 <= m <= 11: return "Post-Monsoon - Kharif Harvest / Rabi Sowing"
    elif 12 <= m <= 3: return "Rabi (Winter) - Growing/Harvesting Phase"
    else: return "Zaid (Summer) - Short Season"


# ---------------------------------------------------------------------------
# Full Market Analysis
# ---------------------------------------------------------------------------

async def analyze_market(
    commodity: str = "wheat",
    state: str = "maharashtra",
    location: str = "",
    language: str = "en",
    tts_enabled: bool = False,
) -> dict:
    """Combine agmarknet prices + news + weather into an AI-generated market summary."""
    lang_name = LANG_NAMES.get(language, "English")

    # Run data fetches
    prices_task = asyncio.create_task(fetch_agmarknet_prices(commodity, state))
    news_task = asyncio.create_task(fetch_market_news(commodity))
    weather_loc = location or state
    weather_task = asyncio.create_task(fetch_yield_weather(weather_loc))

    prices, news, weather_raw = await asyncio.gather(prices_task, news_task, weather_task)

    weather_advice = _weather_analyze(weather_raw)
    season = _get_season_context()

    # Format inputs
    news_text = "\n".join([f"- {n['title']} ({n['href'][:30]}...)" for n in news[:3]]) if news else "No recent digital news found."
    
    price_rows = prices.get("data", [])
    if price_rows:
        # Calculate stats for better prompting
        vals = [r.get('modal_price', 0) for r in price_rows if r.get('modal_price')]
        avg_price = sum(vals) // len(vals) if vals else 0
        min_p = min(vals) if vals else 0
        max_p = max(vals) if vals else 0
        price_summary = (
            f"Range: ₹{min_p}-{max_p}/Qt | Avg: ₹{avg_price}/Qt\n" + 
            "\n".join([f"• {r.get('market', 'Mandi')}: ₹{r.get('modal_price', 'N/A')}" for r in price_rows[:4]])
        )
    else:
        price_summary = "Live mandi data unavailable locally."

    msp = prices.get("msp") or _get_msp(commodity)
    msp_line = f"MSP Reference: ₹{msp}/quintal" if msp else "MSP: Not specific"

    # Robust Prompt Engineering
    prompt = (
        f"Act as an expert Agricultural Economist for {lang_name} speaking farmers.\n"
        f"Analyze market conditions for {commodity.title()} in {state.title()}.\n\n"
        f"**Context**:\n- Date: {date.today()}\n- Season: {season}\n"
        f"- Market Data: {price_summary}\n- {msp_line}\n"
        f"- Weather Impact: {weather_advice}\n- Recent News Headlines: {news_text}\n\n"
        f"**Task**: Provide a strategic advice summary in {lang_name} using markdown.\n"
        "Use these specific sections:\n"
        "1. **Market Status**: Is the current price good compared to MSP? (Bullish/Bearish)\n"
        "2. **Forecast**: Expected trend for next 2 weeks based on season/news.\n"
        "3. **Action Plan**: Sell now vs Hold? (Give clear rationale)\n"
        "4. **Smart Tip**: One specific innovative idea (e.g., specific market to target, storage tip, or value addition).\n\n"
        "Keep it concise, strictly grounded in the provided data. Do not hallucinate prices."
    )

    system = "You are a helpful AI agricultural assistant. Output valid Markdown."
    
    # We use tools_enabled=False to force a direct text response based on context
    summary = await _agent_loop([{"role": "user", "content": prompt}], system, tools_enabled=False)

    # Simple TTS processing if grounded
    audio_b64 = None
    if tts_enabled:
        import re
        # Strip markdown for TTS reading
        clean = re.sub(r"[*#_`>\[\]-]", "", summary)
        clean = re.sub(r"\n+", ". ", clean).strip()[:450]
        audio_b64 = await generate_tts_audio(clean, language)

    return {
        "commodity": commodity,
        "state": state,
        "prices": prices,
        "news": news[:5],
        "yield_weather_advice": weather_advice,
        "ai_summary": summary,
        "audio_base64": audio_b64,
        "audio_format": "wav",
        "language": language,
    }
