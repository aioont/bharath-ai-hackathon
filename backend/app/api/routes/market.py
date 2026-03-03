from fastapi import APIRouter, Query
from app.models.schemas import MarketResponse, MarketTrend
from app.services.market_service import get_market_prices, get_market_trends
from app.services.agmarknet_filters_service import load_agmarknet_filters

router = APIRouter(prefix="/api/market", tags=["Market Prices"])


@router.get("/filters")
async def get_market_filters():
    """Get AgMarkNet filter data (commodities, states, districts, markets)"""
    filters = load_agmarknet_filters()
    return filters


@router.get("/prices", response_model=MarketResponse)
async def market_prices(
    commodity_id: int = Query(default=3, description="Commodity ID (3=all)"),
    state_id: int = Query(default=17, description="State ID (17=all states)"),
    from_date: str = Query(default="", description="From date (YYYY-MM-DD)"),
    to_date: str = Query(default="", description="To date (YYYY-MM-DD)"),
    language: str = Query(default="en", description="Response language code"),
):
    """Get live mandi prices from AGMARKNET API."""
    result = await get_market_prices(
        commodity_id=commodity_id,
        state_id=state_id,
        from_date=from_date,
        to_date=to_date,
        language=language
    )
    return MarketResponse(**result)


@router.get("/trends", response_model=list[MarketTrend])
async def market_trends(
    commodity: str = Query(..., description="Commodity name for trend data"),
    days: int = Query(default=30, ge=7, le=90, description="Number of days"),
):
    """Get price trend data for charts (last N days)."""
    trends = await get_market_trends(commodity=commodity, days=days)
    return [MarketTrend(**t) for t in trends]
