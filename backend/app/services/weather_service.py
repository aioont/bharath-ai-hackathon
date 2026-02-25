import httpx
import structlog
from datetime import datetime, timedelta
from typing import Optional
from app.core.config import settings

logger = structlog.get_logger()

# WMO Weather interpretation codes to our condition names
WMO_CODES = {
    0: "clear", 1: "clear", 2: "partly-cloudy", 3: "cloudy",
    45: "fog", 48: "fog", 51: "rain", 53: "rain", 55: "heavy-rain",
    61: "rain", 63: "rain", 65: "heavy-rain",
    71: "snow", 73: "snow", 75: "snow",
    77: "snow", 80: "rain", 81: "rain", 82: "heavy-rain",
    85: "snow", 86: "snow", 95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
}

# Indian city geocoding (lat, lon)
CITY_COORDS = {
    "delhi": (28.6139, 77.2090), "mumbai": (19.0760, 72.8777),
    "bangalore": (12.9716, 77.5946), "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639), "hyderabad": (17.3850, 78.4867),
    "pune": (18.5204, 73.8567), "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873), "lucknow": (26.8467, 80.9462),
    "nagpur": (21.1458, 79.0882), "bhopal": (23.2599, 77.4126),
    "indore": (22.7196, 75.8577), "patna": (25.5941, 85.1376),
    "chandigarh": (30.7333, 76.7794), "kochi": (9.9312, 76.2673),
    "coimbatore": (11.0168, 76.9558), "visakhapatnam": (17.6868, 83.2185),
}


async def get_weather_forecast(location: str, language: str = "en", days: int = 7) -> dict:
    """Fetch weather forecast using Open-Meteo (free, no API key)."""
    try:
        lat, lon = await _geocode_location(location)
        return await _fetch_weather_data(lat, lon, location, language, days)
    except Exception as e:
        logger.error("Weather fetch error", error=str(e))
        return _get_demo_weather(location)


async def get_weather_by_coords(lat: float, lon: float, language: str = "en") -> dict:
    """Fetch weather by GPS coordinates."""
    try:
        return await _fetch_weather_data(lat, lon, f"{lat:.2f}°N {lon:.2f}°E", language)
    except Exception as e:
        logger.error("Weather by coords error", error=str(e))
        return _get_demo_weather("Your Location")


async def _geocode_location(location: str) -> tuple[float, float]:
    """Resolve location to lat/lon using Nominatim (free)."""
    # Check predefined cities first
    lower = location.lower().replace(",", " ").strip()
    for city, coords in CITY_COORDS.items():
        if city in lower:
            return coords
    
    # Fallback to Nominatim geocoding
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location + " India", "format": "json", "limit": 1},
            headers={"User-Agent": "AgriTranslateAI/1.0"},
        )
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    
    # Default: New Delhi
    return 28.6139, 77.2090


async def _fetch_weather_data(lat: float, lon: float, location: str, language: str, days: int = 7) -> dict:
    """Fetch from Open-Meteo API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode,relative_humidity_2m_max",
                "hourly": "temperature_2m,relativehumidity_2m",
                "current_weather": True,
                "timezone": "Asia/Kolkata",
                "forecast_days": min(days + 1, 14),
            },
        )
        data = resp.json()
    
    daily = data["daily"]
    current_w = data.get("current_weather", {})
    
    current_temp = current_w.get("temperature", daily["temperature_2m_max"][0])
    
    def build_day(i: int) -> dict:
        code = daily["weathercode"][i]
        condition = WMO_CODES.get(code, "clear")
        rain = daily["precipitation_sum"][i] or 0
        wind = daily["windspeed_10m_max"][i] or 0
        humidity = daily.get("relative_humidity_2m_max", [65] * 14)[i] or 65
        tmax = daily["temperature_2m_max"][i]
        tmin = daily["temperature_2m_min"][i]
        tcurr = current_temp if i == 0 else (tmax + tmin) / 2
        
        advice = _get_farming_advice(condition, rain, wind, tmax)
        alerts = _generate_alerts(condition, rain, wind, tmax)
        
        return {
            "location": location,
            "date": daily["time"][i],
            "temperature": {"min": tmin, "max": tmax, "current": round(tcurr, 1)},
            "humidity": round(humidity, 1),
            "rainfall": round(rain, 1),
            "wind_speed": round(wind, 1),
            "condition": condition,
            "farming_advice": advice,
            "alerts": alerts,
        }
    
    current = build_day(0)
    forecast = [build_day(i) for i in range(1, min(days, len(daily["time"])))]
    insights = _generate_agricultural_insights(current, forecast)
    
    return {"location": location, "current": current, "forecast": forecast, "agricultural_insights": insights}


def _get_farming_advice(condition: str, rain: float, wind: float, temp: float) -> str:
    if condition in ("heavy-rain", "thunderstorm"):
        return "Heavy rain expected. Avoid field operations. Ensure drainage channels are clear to prevent waterlogging."
    if condition == "rain" and rain > 10:
        return "Moderate rain today. Postpone pesticide/fertilizer application. Good time for transplanting seedlings."
    if condition == "rain":
        return "Light rain possible. Avoid irrigation. Check soil moisture before any field work."
    if wind > 30:
        return "Strong winds today. Avoid aerial spraying. Secure standing crops and young plants."
    if temp > 40:
        return "Extreme heat today. Irrigate early morning or evening. Provide shade for sensitive crops."
    if temp < 10:
        return "Cold weather. Protect frost-sensitive crops. Delay sowing of tropical crops."
    if condition == "clear" and wind < 15:
        return "Excellent conditions for field operations. Ideal for pesticide/fungicide application. Good irrigation weather."
    return "Moderate weather. Carry out routine field operations and monitoring."


def _generate_alerts(condition: str, rain: float, wind: float, temp: float) -> list:
    alerts = []
    if rain > 30:
        alerts.append({"type": "flood-warning", "message": "Heavy rainfall alert! Risk of field flooding and soil erosion.", "severity": "high"})
    elif rain > 15:
        alerts.append({"type": "rain-warning", "message": "Significant rain expected. Postpone fertilizer application.", "severity": "medium"})
    if wind > 40:
        alerts.append({"type": "wind-warning", "message": "Strong wind alert. Risk of crop lodging.", "severity": "medium"})
    if temp > 42:
        alerts.append({"type": "heat-stress", "message": "Extreme heat! High risk of heat stress in crops. Irrigate immediately.", "severity": "high"})
    if condition == "thunderstorm":
        alerts.append({"type": "storm", "message": "Thunderstorm warning. Stay indoors. Secure farm equipment.", "severity": "high"})
    return alerts


def _generate_agricultural_insights(current: dict, forecast: list) -> list:
    insights = []
    total_rain = sum(d["rainfall"] for d in forecast[:5])
    if total_rain < 5:
        insights.append("Dry spell ahead. Plan irrigation for the next 5 days to maintain soil moisture.")
    elif total_rain > 50:
        insights.append("Heavy rain forecast. Harvest mature crops before rains. Ensure field drainage.")
    
    max_temps = [d["temperature"]["max"] for d in forecast[:3]]
    if any(t > 38 for t in max_temps):
        insights.append("Heat stress risk in the coming days. Increase irrigation frequency and consider mulching.")
    
    insights.append("Optimal spray window: early morning (6-8 AM) when winds are calm and humidity is moderate.")
    insights.append("Monitor soil moisture using finger test — insert finger 2 inches; if dry, irrigate.")
    return insights


def _get_demo_weather(location: str) -> dict:
    today = datetime.now()
    return {
        "location": location,
        "current": {
            "location": location,
            "date": today.strftime("%Y-%m-%d"),
            "temperature": {"min": 18, "max": 32, "current": 26},
            "humidity": 65, "rainfall": 0, "wind_speed": 12,
            "condition": "partly-cloudy",
            "farming_advice": "Good conditions for field work. Moderate temperature suitable for most crops.",
            "alerts": [],
        },
        "forecast": [
            {
                "location": location,
                "date": (today + timedelta(days=i)).strftime("%Y-%m-%d"),
                "temperature": {"min": 17 + i, "max": 31 + i, "current": 24},
                "humidity": 60 + i * 3, "rainfall": 0 if i < 3 else 10,
                "wind_speed": 10, "condition": "clear" if i < 3 else "rain",
                "farming_advice": "Good conditions for field work.",
                "alerts": [],
            }
            for i in range(1, 7)
        ],
        "agricultural_insights": [
            "Soil moisture is adequate — delay irrigation by 2-3 days",
            "Night temperatures suitable for seed germination",
            "Good spray window available for next 2 days",
        ],
    }
