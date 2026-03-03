"""
Scheme Eligibility Advisor Service
Sources: embedded scheme database → DuckDuckGo latest scheme news → Sarvam-M eligibility analysis
"""
from __future__ import annotations
import asyncio
import structlog
from typing import Optional

from app.services.sarvam_service import _agent_loop, LANG_NAMES, generate_tts_audio

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Known Central & High-Impact State Schemes Database
# ---------------------------------------------------------------------------

KNOWN_SCHEMES = [
    {
        "id": "pm_kisan",
        "name": "PM Kisan Samman Nidhi",
        "type": "Central",
        "benefit": "₹6,000/year in 3 equal installments (₹2,000 each)",
        "eligibility": {
            "land_required": True,
            "max_land_acres": None,     # No upper limit
            "farmer_type": "all",
            "income_limit": None,
            "states": "all",
        },
        "exclusions": [
            "Income tax payers",
            "Govt employees (except Class IV / Group D)",
            "Retired pensioners (>₹10,000/month)",
            "Doctors, Engineers, Lawyers, CAs",
            "Elected representatives",
        ],
        "documents": ["Aadhaar card", "Bank account linked to Aadhaar", "Land records (Khatauni/7-12)"],
        "how_to_apply": "Visit pmkisan.gov.in or nearest CSC / Gram Panchayat",
        "helpline": "1800-115-526 (toll-free)",
        "portal": "https://pmkisan.gov.in",
        "last_updated": "Ongoing — 19th installment released Feb 2026",
    },
    {
        "id": "pmfby",
        "name": "PM Fasal Bima Yojana (PMFBY)",
        "type": "Central",
        "benefit": "Crop insurance — full compensation for losses due to drought, flood, pest, hail",
        "eligibility": {
            "farmer_type": "all",
            "seasons": ["Kharif", "Rabi"],
            "states": "all",
        },
        "exclusions": [],
        "premium": {
            "kharif": "2% of sum insured",
            "rabi": "1.5% of sum insured",
            "horticulture": "5% of sum insured",
        },
        "documents": ["Aadhaar", "Bank passbook", "Land records", "Sowing certificate"],
        "how_to_apply": "Via bank/CSC before cutoff date (15 July Kharif, 15 Dec Rabi)",
        "helpline": "1800-200-7710",
        "portal": "https://pmfby.gov.in",
    },
    {
        "id": "kcc",
        "name": "Kisan Credit Card (KCC)",
        "type": "Central",
        "benefit": "Revolving credit up to ₹3 lakh at 4% interest (7% nominal, 3% subvention)",
        "eligibility": {
            "farmer_type": "all",
            "land_required": True,
            "min_age": 18,
            "max_age": 70,
        },
        "documents": ["Aadhaar", "PAN", "Land records", "Passport-size photo"],
        "how_to_apply": "Apply at any nationalised bank, RRB, cooperative bank",
        "helpline": "1800-180-1551 (NABARD)",
        "portal": "https://www.nabard.org",
    },
    {
        "id": "pmksy",
        "name": "PM Krishi Sinchayee Yojana (PMKSY)",
        "type": "Central",
        "benefit": "Subsidy on drip/sprinkler irrigation equipment (55% SC/ST/Small farmers, 45% others)",
        "eligibility": {
            "farmer_type": "all",
            "land_required": True,
        },
        "focus": "Drip and sprinkler irrigation, watershed development",
        "documents": ["Aadhaar", "Land records", "Bank account", "Quotation from approved vendor"],
        "how_to_apply": "Apply via state agriculture department or pmksy.gov.in",
        "portal": "https://pmksy.gov.in",
    },
    {
        "id": "soil_health_card",
        "name": "Soil Health Card Scheme",
        "type": "Central",
        "benefit": "Free soil testing + personalised fertilizer recommendation card every 2 years",
        "eligibility": {"farmer_type": "all", "land_required": True},
        "documents": ["Aadhaar", "Land records"],
        "how_to_apply": "Contact local agriculture department or soilhealth.dac.gov.in",
        "portal": "https://soilhealth.dac.gov.in",
    },
    {
        "id": "enam",
        "name": "eNAM (Electronic National Agriculture Market)",
        "type": "Central",
        "benefit": "Sell produce online to buyers across India — better price discovery, reduced middlemen",
        "eligibility": {"farmer_type": "all", "land_required": True},
        "documents": ["Aadhaar", "Bank account", "Produce weighment receipt"],
        "how_to_apply": "Register at enam.gov.in or nearest eNAM-linked mandi",
        "portal": "https://enam.gov.in",
        "markets_connected": 1361,
    },
    {
        "id": "agri_infra_fund",
        "name": "Agriculture Infrastructure Fund (AIF)",
        "type": "Central",
        "benefit": "Loan up to ₹2 crore at 3% interest subvention for storage, processing, agri infrastructure",
        "eligibility": {
            "entities": ["FPO", "PACS", "Individual farmers", "Agri-entrepreneurs", "SHGs"],
        },
        "focus": "Cold storage, warehouses, sorting & grading units, primary processing",
        "portal": "https://agriinfra.dac.gov.in",
        "helpline": "1800-270-0224",
    },
    {
        "id": "pm_aasha",
        "name": "PM Annadata Aay Sanrakshan Abhiyan (PM-AASHA)",
        "type": "Central",
        "benefit": "Price support for oilseeds, pulses — ensures MSP payment to farmers",
        "eligibility": {"farmer_type": "all", "crops": ["Oilseeds", "Pulses", "Copra"]},
        "portal": "https://acresindia.gov.in",
    },
    {
        "id": "nrlm_shg",
        "name": "DAY-NRLM Self Help Group (Farm Livelihood)",
        "type": "Central",
        "benefit": "₹1.5 lakh revolving fund + linkage to bank credit for women farmer SHGs",
        "eligibility": {"gender": "women", "farmer_type": "all"},
        "portal": "https://nrlm.gov.in",
    },
    {
        "id": "pkvy",
        "name": "Paramparagat Krishi Vikas Yojana (PKVY)",
        "type": "Central",
        "benefit": "₹50,000/ha over 3 years for organic farming conversion + certification support",
        "eligibility": {
            "farmer_type": "all",
            "farming_preference": "organic",
            "min_group": "5 farmers / 50 acres cluster",
        },
        "portal": "https://pgsindia-ncof.gov.in",
    },
]


# ---------------------------------------------------------------------------
# Scheme News (DuckDuckGo)
# ---------------------------------------------------------------------------

async def fetch_scheme_news() -> list[dict]:
    """Fetch latest government scheme notifications via DuckDuckGo."""
    try:
        from duckduckgo_search import DDGS
        query = "India agriculture government scheme PM Kisan subsidy 2026 notification"
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: list(DDGS().text(query, max_results=5))
        )
        return [{"title": r.get("title", ""), "body": r.get("body", ""), "href": r.get("href", "")} for r in results]
    except Exception as exc:
        logger.warning("scheme_news_failed", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Eligibility Matching
# ---------------------------------------------------------------------------

def _quick_match_schemes(
    state: Optional[str] = None,
    farming_type: Optional[str] = None,
    land_acres: Optional[float] = None,
    gender: Optional[str] = None,
) -> list[dict]:
    """Quick rule-based scheme matching before AI enrichment."""
    matched = []
    for scheme in KNOWN_SCHEMES:
        elig = scheme.get("eligibility", {})
        # Skip if scheme requires land but farmer has none
        if elig.get("land_required") and land_acres is not None and land_acres == 0:
            continue
        # Women-only schemes
        if elig.get("gender") == "women" and gender and gender.lower() not in ["female", "f", "woman", "women"]:
            continue
        # Organic preference
        if elig.get("farming_preference") == "organic" and farming_type:
            if "organic" not in farming_type.lower():
                scheme = {**scheme, "_note": "Requires organic farming commitment"}
        matched.append(scheme)
    return matched


async def check_eligibility(
    farmer_profile: dict,
    language: str = "en",
    tts_enabled: bool = False,
) -> dict:
    """Match farmer profile to eligible schemes and generate an AI-narrated summary."""
    lang_name = LANG_NAMES.get(language, "English")

    state = farmer_profile.get("state", "")
    farming_type = farmer_profile.get("farming_type", "")
    land_acres = farmer_profile.get("land_acres")
    gender = farmer_profile.get("gender", "")
    name = farmer_profile.get("name", "Farmer")

    # Step 1: quick match
    matched_schemes = _quick_match_schemes(state, farming_type, land_acres, gender)

    # Step 2: fetch news in parallel
    news = await fetch_scheme_news()
    news_text = "\n".join([f"- {n['title']}: {n['body'][:100]}" for n in news[:3]]) if news else ""

    # Step 3: AI narration
    scheme_list = "\n".join([
        f"• {s['name']} ({s['type']}): {s['benefit']}"
        for s in matched_schemes[:8]
    ])

    prompt = (
        f"Farmer profile: Name={name}, State={state or 'India'}, "
        f"Farming type={farming_type or 'general'}, Land={land_acres or 'unknown'} acres\n\n"
        f"Matched government schemes:\n{scheme_list}\n\n"
        f"Recent scheme news:\n{news_text}\n\n"
        f"In {lang_name}, tell this farmer:\n"
        "1. Which 3-5 schemes they should IMMEDIATELY apply for (by priority)\n"
        "2. Which documents to collect first\n"
        "3. Any scheme they might be missing out on\n"
        "4. One financial benefit calculation (e.g., PM Kisan = ₹6000/year for them)\n"
        "Be warm, encouraging, and specific."
    )

    system = (
        "You are AgriAI Government Scheme Advisor. "
        "Help farmers understand and access their entitled benefits. "
        f"Respond in {lang_name}."
    )
    messages = [{"role": "user", "content": prompt}]
    ai_narration = await _agent_loop(messages, system, tools_enabled=False)

    audio_b64 = None
    if tts_enabled:
        import re
        clean = re.sub(r"[*#_`>\[\]()]", "", ai_narration)
        clean = re.sub(r"\n+", " ", clean).strip()[:400]
        audio_b64 = await generate_tts_audio(clean, language)

    return {
        "matched_schemes": matched_schemes,
        "scheme_count": len(matched_schemes),
        "news": news[:5],
        "ai_narration": ai_narration,
        "audio_base64": audio_b64,
        "audio_format": "wav",
        "language": language,
    }
