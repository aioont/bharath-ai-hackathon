from fastapi import APIRouter, Query
from app.models.schemas import WeatherForecast
from app.services.weather_service import get_weather_forecast, get_weather_by_coords

router = APIRouter(prefix="/api/weather", tags=["Weather"])


@router.get("/forecast", response_model=WeatherForecast)
async def weather_forecast(
    location: str = Query(..., description="City or location name (e.g., Pune, Maharashtra)"),
    language: str = Query(default="en", description="Response language code"),
    days: int = Query(default=7, ge=1, le=14, description="Number of forecast days"),
):
    """Get weather forecast with agricultural insights using Open-Meteo (free)."""
    result = await get_weather_forecast(location=location, language=language, days=days)
    return WeatherForecast(**result)


@router.get("/forecast/coords", response_model=WeatherForecast)
async def weather_forecast_by_coords(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    language: str = Query(default="en", description="Response language code"),
):
    """Get weather forecast by GPS coordinates."""
    result = await get_weather_by_coords(lat=lat, lon=lon, language=language)
    return WeatherForecast(**result)
