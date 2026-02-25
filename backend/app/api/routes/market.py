from fastapi import APIRouter, Query
from app.models.schemas import MarketResponse, MarketTrend
from app.services.market_service import get_market_prices, get_market_trends

router = APIRouter(prefix="/api/market", tags=["Market Prices"])


@router.get("/prices", response_model=MarketResponse)
async def market_prices(
    commodity: str = Query(default="", description="Commodity name filter"),
    state: str = Query(default="", description="State filter"),
    language: str = Query(default="en", description="Response language code"),
):
    """Get live mandi prices from AGMARKNET / data.gov.in."""
    result = await get_market_prices(commodity=commodity, state=state, language=language)
    return MarketResponse(**result)


@router.get("/trends", response_model=list[MarketTrend])
async def market_trends(
    commodity: str = Query(..., description="Commodity name for trend data"),
    days: int = Query(default=30, ge=7, le=90, description="Number of days"),
):
    """Get price trend data for charts (last N days)."""
    trends = await get_market_trends(commodity=commodity, days=days)
    return [MarketTrend(**t) for t in trends]
