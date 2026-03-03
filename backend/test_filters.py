"""Test script to verify AgMarkNet filters loading"""
from app.services.agmarknet_filters_service import load_agmarknet_filters

data = load_agmarknet_filters()
cmdt_count = len(data.get("data", {}).get("cmdt_data", []))
state_count = len(data.get("data", {}).get("state_data", []))

print(f"✓ Loaded {cmdt_count} commodities and {state_count} states")
print(f"✓ Last updated: {data.get('last_updated', 'unknown')}")

# Show sample commodities
commodities = data.get("data", {}).get("cmdt_data", [])
if commodities:
    print(f"\nSample commodities:")
    for c in commodities[:5]:
        print(f"  - {c['cmdt_name']} (ID: {c['cmdt_id']})")
