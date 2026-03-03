from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel
from app.services.market_analyzer_service import (
    fetch_agmarknet_prices, fetch_market_news, fetch_yield_weather, analyze_market
)

router = APIRouter(prefix="/api/market-analyzer", tags=["Market Analyzer"])


class MarketAnalyzeRequest(BaseModel):
    commodity: str = "wheat"
    state: str = "maharashtra"
    location: str = ""
    language: str = "en"
    tts_enabled: bool = False


@router.get("/prices")
async def get_prices(
    commodity: str = Query(default="wheat", description="Crop/commodity name"),
    state: str = Query(default="maharashtra", description="State name"),
):
    """Get live mandi prices from agmarknet API (with mock fallback)."""
    try:
        return await fetch_agmarknet_prices(commodity=commodity, state=state)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/news")
async def get_market_news(commodity: str = Query(default="", description="Optional crop filter")):
    """Get latest agricultural market news via web search."""
    try:
        news = await fetch_market_news(commodity=commodity)
        return {"news": news, "count": len(news)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/yield-weather")
async def get_yield_weather(location: str = Query(default="Delhi", description="City or district name")):
    """Get 14-day weather forecast + best yield window recommendation."""
    try:
        return await fetch_yield_weather(location=location)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/analyze")
async def market_analyze(req: MarketAnalyzeRequest = Body(...)):
    """Full market analysis: prices + news + yield weather + AI summary + TTS."""
    try:
        return await analyze_market(
            commodity=req.commodity,
            state=req.state,
            location=req.location,
            language=req.language,
            tts_enabled=req.tts_enabled,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Market analysis failed: {str(exc)}")
