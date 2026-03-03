"""
Script to fetch and cache AgMarkNet filter data (commodities, states, districts, etc.)
Run this script periodically to update the filter data.
"""
import httpx
import json
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
FILTERS_FILE = DATA_DIR / "agmarknet_filters.json"

async def fetch_agmarknet_filters():
    """Fetch filter data from AgMarkNet API"""
    url = "https://api.agmarknet.gov.in/v1/daily-price-arrival/filters"
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status"):
                logger.info("Successfully fetched AgMarkNet filters")
                return data.get("data", {})
            else:
                logger.error(f"API returned status=false: {data.get('message')}")
                return None
    except Exception as e:
        logger.error(f"Failed to fetch filters: {e}")
        return None

async def save_filters_to_file(filters_data):
    """Save filter data to JSON file"""
    DATA_DIR.mkdir(exist_ok=True)
    
    # Add metadata
    output = {
        "last_updated": datetime.utcnow().isoformat(),
        "data": filters_data
    }
    
    with open(FILTERS_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Saved filters to {FILTERS_FILE}")
    
    # Log statistics
    if filters_data:
        cmdt_count = len(filters_data.get("cmdt_data", []))
        state_count = len(filters_data.get("state_data", []))
        logger.info(f"Cached {cmdt_count} commodities and {state_count} states")

async def main():
    """Main function to fetch and cache filter data"""
    logger.info("Fetching AgMarkNet filter data...")
    filters_data = await fetch_agmarknet_filters()
    
    if filters_data:
        await save_filters_to_file(filters_data)
        logger.info("✓ Filter data updated successfully")
    else:
        logger.error("✗ Failed to update filter data")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
