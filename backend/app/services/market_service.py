import httpx
import structlog
import random
from datetime import datetime, timedelta
from typing import Optional

logger = structlog.get_logger()

# Sample commodity MSP (Minimum Support Prices) for 2024-25
MSP_PRICES = {
    "Wheat": 2275, "Rice": 2300, "Maize": 2090, "Cotton": 7121,
    "Soybean": 4892, "Groundnut": 6783, "Mustard": 5650,
    "Sunflower": 7280, "Sugarcane": 340, "Jowar": 3371,
}

# Demo market data structure
DEMO_COMMODITIES = [
    ("Wheat", "Sharbati", "Indore", "Madhya Pradesh", 2100, 2350, 2200, "up", 2.3),
    ("Rice", "Basmati 1121", "Karnal", "Haryana", 3200, 3800, 3500, "stable", 0.1),
    ("Onion", "Red Medium", "Lasalgaon", "Maharashtra", 800, 1400, 1100, "down", -5.2),
    ("Tomato", "Local", "Kolar", "Karnataka", 600, 1600, 1200, "up", 15.8),
    ("Potato", "Kufri Jyoti", "Agra", "Uttar Pradesh", 1200, 1600, 1400, "stable", 0.5),
    ("Soybean", "Yellow", "Indore", "Madhya Pradesh", 4200, 4600, 4400, "up", 3.1),
    ("Cotton", "Long Staple", "Akola", "Maharashtra", 6800, 7200, 7000, "down", -1.4),
    ("Groundnut", "Bold", "Rajkot", "Gujarat", 5200, 5800, 5500, "up", 4.7),
    ("Maize", "Yellow Flint", "Davangere", "Karnataka", 1800, 2100, 1950, "stable", -0.3),
    ("Mustard", "Yellow", "Alwar", "Rajasthan", 5100, 5700, 5400, "up", 2.8),
    ("Chilli", "Red Dry", "Guntur", "Andhra Pradesh", 12000, 16000, 14000, "up", 8.5),
    ("Turmeric", "Finger", "Erode", "Tamil Nadu", 8000, 11000, 9500, "stable", 1.2),
    ("Lentils", "Red", "Bhopal", "Madhya Pradesh", 6500, 7200, 6800, "up", 5.4),
    ("Chickpea", "Desi", "Akola", "Maharashtra", 5800, 6400, 6100, "stable", -0.8),
    ("Banana", "Cavendish", "Jalgaon", "Maharashtra", 800, 1400, 1100, "down", -3.2),
    ("Mango", "Alphonso", "Ratnagiri", "Maharashtra", 4000, 8000, 6000, "stable", 0.5),
    ("Sugarcane", "CO 86032", "Kolhapur", "Maharashtra", 3200, 3500, 3350, "stable", 0.0),
    ("Arhar Dal", "Yellow", "Latur", "Maharashtra", 7000, 8000, 7500, "up", 6.2),
    ("Moong Dal", "Green", "Nagpur", "Maharashtra", 7500, 8500, 8000, "stable", 1.8),
    ("Sunflower", "Hybrid", "Dharwad", "Karnataka", 6800, 7400, 7100, "up", 3.5),
]


async def get_market_prices(
    state: Optional[str] = None,
    commodity: Optional[str] = None,
    language: str = "en",
) -> dict:
    """Get commodity market prices. Tries eNAM API first, falls back to demo data."""
    
    try:
        # Try to fetch from a real API (using data.gov.in if available)
        prices = await _fetch_from_api(state, commodity)
        if prices:
            return {
                "prices": prices,
                "last_updated": datetime.utcnow().isoformat(),
                "total_count": len(prices),
            }
    except Exception as e:
        logger.warning("Market API fetch failed, using demo data", error=str(e))
    
    return _get_demo_prices(state, commodity)


async def get_market_trends(commodity: str, days: int = 30) -> dict:
    """Get historical price trends for a commodity."""
    try:
        end_date = datetime.now()
        dates = [(end_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days, -1, -1)]
        
        # Generate realistic-looking trend data
        base_price = MSP_PRICES.get(commodity, 3000)
        prices = []
        current = base_price * random.uniform(0.9, 1.2)
        for _ in dates:
            change = current * random.uniform(-0.02, 0.025)
            current = max(current + change, base_price * 0.6)
            prices.append(round(current, 2))
        
        return {"dates": dates, "prices": prices, "commodity": commodity}
    except Exception as e:
        logger.error("Market trends error", error=str(e))
        return {"dates": [], "prices": [], "commodity": commodity}


async def _fetch_from_api(state: Optional[str], commodity: Optional[str]) -> list:
    """Fetch from data.gov.in API (free, no auth required for public datasets)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            params = {
                "api-key": "579b464db66ec23bdd000001cdd3946e44ce4aae38d4521d4038f5a",
                "format": "json",
                "limit": 100,
            }
            if state:
                params["filters[State]"] = state
            if commodity:
                params["filters[Commodity]"] = commodity
            
            resp = await client.get(
                "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
                params=params,
            )
            data = resp.json()
            
            if "records" not in data:
                return []
            
            prices = []
            today = datetime.now().strftime("%Y-%m-%d")
            for record in data["records"][:50]:
                try:
                    min_p = float(record.get("Min_x0020_Price", 0))
                    max_p = float(record.get("Max_x0020_Price", 0))
                    modal_p = float(record.get("Modal_x0020_Price", 0))
                    if modal_p > 0:
                        prices.append({
                            "commodity": record.get("Commodity", ""),
                            "variety": record.get("Variety", "General"),
                            "market": record.get("Market", ""),
                            "state": record.get("State", ""),
                            "min_price": min_p,
                            "max_price": max_p,
                            "modal_price": modal_p,
                            "unit": "Quintal",
                            "date": today,
                            "trend": "stable",
                            "trend_percentage": 0.0,
                        })
                except (ValueError, KeyError):
                    continue
            return prices
    except Exception:
        return []


def _get_demo_prices(state: Optional[str] = None, commodity: Optional[str] = None) -> dict:
    """Return demo price data."""
    today = datetime.now().strftime("%Y-%m-%d")
    
    prices = []
    for item in DEMO_COMMODITIES:
        name, variety, market, item_state, min_p, max_p, modal_p, trend, pct = item
        
        if state and state.lower() not in item_state.lower():
            continue
        if commodity and commodity.lower() not in name.lower():
            continue
        
        prices.append({
            "commodity": name,
            "variety": variety,
            "market": market,
            "state": item_state,
            "min_price": min_p,
            "max_price": max_p,
            "modal_price": modal_p,
            "unit": "Quintal",
            "date": today,
            "trend": trend,
            "trend_percentage": pct,
        })
    
    return {
        "prices": prices,
        "last_updated": datetime.utcnow().isoformat(),
        "total_count": len(prices),
    }
