from fastapi import APIRouter, Query
from app.services.plan_service import get_mock_soil_data, get_mock_weather_sensor, get_mock_irrigation_status

router = APIRouter(prefix="/api/iot", tags=["Mock IoT Sensors"])


@router.get("/soil")
async def soil_sensor(
    crop: str = Query(default="", description="Crop name for realistic data"),
    location: str = Query(default="", description="Location for realistic data"),
):
    """Return mock soil sensor data (pH, moisture, NPK, organic matter, EC)."""
    return get_mock_soil_data(crop=crop, location=location)


@router.get("/weather-sensor")
async def weather_sensor(location: str = Query(default="", description="Location")):
    """Return mock weather sensor reading (temp, humidity, rainfall, UV, forecast)."""
    return get_mock_weather_sensor(location=location)


@router.get("/irrigation")
async def irrigation_status(crop: str = Query(default="", description="Crop name")):
    """Return mock irrigation + leaf health data (water requirement, leaf color, yield estimate)."""
    return get_mock_irrigation_status(crop=crop)


@router.get("/all")
async def all_sensors(
    crop: str = Query(default="wheat"),
    location: str = Query(default="India"),
):
    """Return all sensor data in one combined response."""
    return {
        "soil": get_mock_soil_data(crop=crop, location=location),
        "weather": get_mock_weather_sensor(location=location),
        "irrigation": get_mock_irrigation_status(crop=crop),
    }
