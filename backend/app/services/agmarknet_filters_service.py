"""
Service to load and serve AgMarkNet filter data
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent.parent / "data" / "agmarknet_filters.json"

_CACHE: Optional[Dict] = None

def load_agmarknet_filters() -> Dict:
    """Load AgMarkNet filter data from cached file"""
    global _CACHE
    
    if _CACHE is not None:
        return _CACHE
    
    if not DATA_FILE.exists():
        logger.warning(f"AgMarkNet filters file not found: {DATA_FILE}")
        return get_fallback_filters()
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            cached_data = json.load(f)
        
        _CACHE = cached_data
        logger.info(f"Loaded AgMarkNet filters (updated: {cached_data.get('last_updated', 'unknown')})")
        return _CACHE
    except Exception as e:
        logger.error(f"Failed to load AgMarkNet filters: {e}")
        return get_fallback_filters()

def get_fallback_filters() -> Dict:
    """Return minimal fallback filter data"""
    return {
        "last_updated": "fallback",
        "data": {
            "cmdt_data": [
                {"cmdt_id": 1, "cmdt_name": "Wheat", "cmdt_group_id": 1},
                {"cmdt_id": 3, "cmdt_name": "Rice", "cmdt_group_id": 1},
                {"cmdt_id": 4, "cmdt_name": "Maize", "cmdt_group_id": 1},
                {"cmdt_id": 23, "cmdt_name": "Onion", "cmdt_group_id": 6},
                {"cmdt_id": 65, "cmdt_name": "Tomato", "cmdt_group_id": 6},
            ],
            "state_data": [
                {"state_id": 100000, "state_name": "All States"},
                {"state_id": 16, "state_name": "Karnataka"},
                {"state_id": 17, "state_name": "Kerala"},
                {"state_id": 20, "state_name": "Maharashtra"},
                {"state_id": 31, "state_name": "Tamil Nadu"},
            ],
            "type_data": [
                {"id": 100004, "type": "Price"}
            ]
        }
    }

def get_commodities() -> List[Dict]:
    """Get list of all commodities"""
    filters = load_agmarknet_filters()
    return filters.get("data", {}).get("cmdt_data", [])

def get_states() -> List[Dict]:
    """Get list of all states"""
    filters = load_agmarknet_filters()
    return filters.get("data", {}).get("state_data", [])

def get_districts() -> List[Dict]:
    """Get list of all districts"""
    filters = load_agmarknet_filters()
    return filters.get("data", {}).get("district_data", [])

def get_markets() -> List[Dict]:
    """Get list of all markets"""
    filters = load_agmarknet_filters()
    return filters.get("data", {}).get("market_data", [])
