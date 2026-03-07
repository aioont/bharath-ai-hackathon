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

# Indian city geocoding (lat, lon) - 80+ major cities and agricultural hubs
CITY_COORDS = {
    # Metros & Major Cities
    "delhi": (28.6139, 77.2090), "new delhi": (28.6139, 77.2090),
    "mumbai": (19.0760, 72.8777), "bangalore": (12.9716, 77.5946), "bengaluru": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707), "kolkata": (22.5726, 88.3639), "hyderabad": (17.3850, 78.4867),
    
    # State Capitals
    "pune": (18.5204, 73.8567), "ahmedabad": (23.0225, 72.5714), "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462), "chandigarh": (30.7333, 76.7794), "bhopal": (23.2599, 77.4126),
    "patna": (25.5941, 85.1376), "thiruvananthapuram": (8.5241, 76.9366), "trivandrum": (8.5241, 76.9366),
    "gandhinagar": (23.2156, 72.6369), "bhubaneswar": (20.2961, 85.8245), "ranchi": (23.3441, 85.3096),
    "shimla": (31.1048, 77.1734), "dehradun": (30.3165, 78.0322), "srinagar": (34.0837, 74.7973),
    "jammu": (32.7266, 74.8570), "panaji": (15.4909, 73.8278), "dispur": (26.1433, 91.7898),
    "guwahati": (26.1445, 91.7362), "imphal": (24.8170, 93.9368), "aizawl": (23.7307, 92.7173),
    "kohima": (25.6751, 94.1086), "shillong": (25.5788, 91.8933), "agartala": (23.8315, 91.2868),
    "itanagar": (27.0844, 93.6053), "gangtok": (27.3389, 88.6065), "raipur": (21.2514, 81.6296),
    
    # Major Agricultural Centers
    "amritsar": (31.6340, 74.8723), "ludhiana": (30.9010, 75.8573), "bathinda": (30.2110, 74.9455),
    "jalandhar": (31.3260, 75.5762), "patiala": (30.3398, 76.3869), "moga": (30.8158, 75.1705),
    "nashik": (19.9975, 73.7898), "solapur": (17.6599, 75.9064), "sangli": (16.8524, 74.5815),
    "kolhapur": (16.7050, 74.2433), "satara": (17.6805, 74.0183), "aurangabad": (19.8762, 75.3433),
    "latur": (18.4088, 76.5604), "nagpur": (21.1458, 79.0882), "wardha": (20.7453, 78.5975),
    "akola": (20.7002, 77.0082), "amravati": (20.9374, 77.7796), "yavatmal": (20.3897, 78.1307),
    "coimbatore": (11.0168, 76.9558), "madurai": (9.9252, 78.1198), "salem": (11.6643, 78.1460),
    "tiruppur": (11.1085, 77.3411), "erode": (11.3410, 77.7172), "trichy": (10.7905, 78.7047),
    "thanjavur": (10.7870, 79.1378), "karur": (10.9601, 78.0766), "dindigul": (10.3673, 77.9803),
    "visakhapatnam": (17.6868, 83.2185), "vijayawada": (16.5062, 80.6480), "guntur": (16.3067, 80.4365),
    "nellore": (14.4426, 79.9865), "tirupati": (13.6288, 79.4192), "kadapa": (14.4674, 78.8241),
    "anantapur": (14.6819, 77.6006), "kurnool": (15.8281, 78.0373), "rajahmundry": (17.0005, 81.8040),
    "mysore": (12.2958, 76.6394), "hubli": (15.3647, 75.1240), "belgaum": (15.8497, 74.4977),
    "mangalore": (12.9141, 74.8560), "davangere": (14.4644, 75.9218), "bellary": (15.1394, 76.9214),
    "gulbarga": (17.3297, 76.8343), "bijapur": (16.8302, 75.7100), "shimoga": (13.9299, 75.5681),
    "kochi": (9.9312, 76.2673), "kozhikode": (11.2588, 75.7804), "calicut": (11.2588, 75.7804),
    "thrissur": (10.5276, 76.2144), "kollam": (8.8932, 76.6141), "kannur": (11.8745, 75.3704),
    "alappuzha": (9.4981, 76.3388), "palakkad": (10.7867, 76.6548), "kottayam": (9.5916, 76.5222),
    
    # North India Agricultural Belt
    "meerut": (28.9845, 77.7064), "agra": (27.1767, 78.0081), "aligarh": (27.8974, 78.0880),
    "moradabad": (28.8389, 78.7378), "varanasi": (25.3176, 82.9739), "allahabad": (25.4358, 81.8463),
    "prayagraj": (25.4358, 81.8463), "kanpur": (26.4499, 80.3319), "bareilly": (28.3670, 79.4304),
    "ghaziabad": (28.6692, 77.4538), "noida": (28.5355, 77.3910), "faridabad": (28.4089, 77.3178),
    "gorakhpur": (26.7606, 83.3732), "mathura": (27.4924, 77.6737), "muzaffarnagar": (29.4727, 77.7085),
    "jodhpur": (26.2389, 73.0243), "kota": (25.2138, 75.8648), "bikaner": (28.0229, 73.3119),
    "udaipur": (24.5854, 73.7125), "ajmer": (26.4499, 74.6399), "alwar": (27.5530, 76.6346),
    "bharatpur": (27.2173, 77.4900), "sikar": (27.6119, 75.1397), "pali": (25.7711, 73.3234),
    "indore": (22.7196, 75.8577), "ujjain": (23.1765, 75.7885), "gwalior": (26.2183, 78.1828),
    "jabalpur": (23.1815, 79.9864), "sagar": (23.8388, 78.7378), "dewas": (22.9676, 76.0534),
    "ratlam": (23.3315, 75.0367), "mandsaur": (24.0734, 75.0691), "khargone": (21.8234, 75.6149),
    
    # Eastern & Northeastern Agricultural Regions
    "siliguri": (26.7271, 88.3953), "durgapur": (23.5204, 87.3119), "asansol": (23.6739, 86.9524),
    "kharagpur": (22.3460, 87.2320), "malda": (25.0097, 88.1450), "midnapore": (22.4248, 87.3200),
    "jorhat": (26.7509, 94.2037), "dibrugarh": (27.4728, 94.9120), "silchar": (24.8333, 92.7789),
    "tezpur": (26.6338, 92.8000), "nagaon": (26.3473, 92.6836),
}


async def get_weather_forecast(location: str, language: str = "en", days: int = 7) -> dict:
    """Fetch weather forecast using Open-Meteo (free, no API key)."""
    try:
        # Check cache first (reduces API calls and improves response time)
        from app.core.cache import cache_get, cache_set, generate_cache_key, TTL_CONFIG
        
        cache_key = generate_cache_key("weather", location=location.lower(), days=days)
        cached = await cache_get(cache_key)
        
        if cached:
            logger.info("weather_cache_hit", location=location)
            import json
            return json.loads(cached)
        
        lat, lon = await _geocode_location(location)
        result = await _fetch_weather_data(lat, lon, location, language, days)
        
        # Cache the result for 1 hour
        import json
        await cache_set(cache_key, json.dumps(result), ttl=TTL_CONFIG["weather"])
        
        return result
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
    logger.info("weather_api_fetch", location=location, lat=round(lat, 2), lon=round(lon, 2), days=days)
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
