"""
Insurance Suggestion Service
Flow:
  1. Fetch live schemes from myscheme.gov.in API (with local JSON cache fallback)
  2. Build RAG context:
     a. If BEDROCK_INSURANCE_KB_ID is set → query AWS Bedrock Knowledge Base (retrieve_and_generate)
     b. Else → local keyword search over cached JSON (demo fallback)
  3. Sarvam-M reasons over retrieved schemes + user profile → personalised recommendations
"""
from __future__ import annotations
import json
import asyncio
import re
from pathlib import Path
from typing import Optional
import httpx
import structlog

from app.core.config import settings
from app.services.sarvam_service import _agent_loop, LANG_NAMES, generate_tts_audio

logger = structlog.get_logger()

MYSCHEME_API_KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
MYSCHEME_BASE    = "https://api.myscheme.gov.in/search/v6/schemes"
# Headers that myscheme.gov.in API requires (mirrors browser requests)
MYSCHEME_HEADERS = {
    "x-api-key": MYSCHEME_API_KEY,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
}
# Also check relative to this file
_local_cache     = Path(__file__).parent.parent.parent / "insurance_schemes.json"

# ---------------------------------------------------------------------------
# Live fetch from myscheme.gov.in
# ---------------------------------------------------------------------------

async def fetch_live_schemes(keyword: str = "insurance", size: int = 10) -> list[dict]:
    # Check cache first (schemes don't change often - 6 hour TTL)
    from app.core.cache import cache_get, cache_set, generate_cache_key, TTL_CONFIG
    
    cache_key = generate_cache_key("insurance_schemes", keyword=keyword, size=size)
    cached = await cache_get(cache_key)
    
    if cached:
        logger.info("insurance_schemes_cache_hit", keyword=keyword)
        import json
        return json.loads(cached)
    
    # Build URL manually — httpx would double-encode `[]` to `%255B%255D`
    kw_encoded = httpx.URL("", params={"k": keyword}).params["k"]
    url = f"{MYSCHEME_BASE}?lang=en&q=%5B%5D&keyword={kw_encoded}&sort=&from=0&size={size}"
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            r = await client.get(url, headers=MYSCHEME_HEADERS)
            r.raise_for_status()
            data = r.json()
            # Safety navigation through response structure
            hits_container = data.get("data", {})
            if isinstance(hits_container, str): 
                 hits_container = {} # Parsing failed or unexpected structure
            
            hits = hits_container.get("hits", {})
            raw_list = hits.get("hits", hits) if isinstance(hits, dict) else hits
            
            # Ensure we have a list of dicts
            if not isinstance(raw_list, list):
                raw_list = []
            
            result = [_normalise(h) for h in raw_list if isinstance(h, dict)]
            
            # Cache the result
            import json
            await cache_set(cache_key, json.dumps(result), ttl=TTL_CONFIG["insurance_schemes"])
            
            return result

    except Exception as exc:
        logger.warning("myscheme_fetch_failed", error=str(exc))
        return []

def _normalise(raw: dict) -> dict:
    src = raw.get("_source", raw)
    name = src.get("name", {})
    desc = src.get("briefDescription", {})
    state = src.get("state", {})
    return {
        "id":          src.get("slug") or src.get("schemeId") or raw.get("_id", ""),
        "name":        name.get("en", src.get("schemeName", "")) if isinstance(name, dict) else str(name),
        "ministry":    src.get("nodalMinistryName", {}).get("en", "") if isinstance(src.get("nodalMinistryName"), dict) else "",
        "state":       state.get("en", "Central") if isinstance(state, dict) else str(state or "Central"),
        "description": desc.get("en", "") if isinstance(desc, dict) else str(desc or ""),
        "eligibility": src.get("eligibility", []),
        "benefits":    src.get("benefits", []),
        "official_url": src.get("schemeUrl", src.get("url", "")),
        "tags":        src.get("tags", []),
    }


# ---------------------------------------------------------------------------
# AWS Bedrock Knowledge Base retrieve-and-generate
# ---------------------------------------------------------------------------

async def _bedrock_rag(query: str, kb_id: str, max_results: int = 5) -> tuple[str, list[dict]]:
    """Query Bedrock KB and return generated answer + source citations."""
    try:
        from app.core.aws_client import get_bedrock_client
        from app.core.cache import get_cached_bedrock_kb_query, cache_bedrock_kb_query
        
        # Check cache first (MAJOR COST SAVINGS - OpenSearch is expensive!)
        cached_result = await get_cached_bedrock_kb_query(query, kb_id)
        if cached_result:
            logger.info("insurance_kb_cache_hit", query=query[:50])
            # Cached result is just the text, return with empty citations
            return cached_result, []
        
        client = get_bedrock_client()

        # Run blocking call in thread
        response = await asyncio.to_thread(
            client.retrieve_and_generate,
            query=query,
            kb_id=kb_id, 
            max_results=max_results
        )

        output_text = response.get("output", {}).get("text", "")
        citations = response.get("citations", [])
        
        # Cache the result (semantic + exact match) - COST SAVINGS
        if output_text:
            await cache_bedrock_kb_query(query, kb_id, output_text)
            logger.info("insurance_kb_cached", query=query[:50])
        
        # Log retrieved KB data clearly
        logger.info(
            "bedrock_kb_retrieval_success",
            kb_id=kb_id,
            query_used=query,
            content_preview=output_text[:200] + "..." if output_text else "No content generated",
            sources_count=len(citations),
        )

        sources = []
        for c in citations:
            for ref in c.get("retrievedReferences", []):
                snippet = ref.get("content", {}).get("text", "")[:300]
                loc = ref.get("location", {}).get("s3Location", {})
                uri = loc.get("uri", "")
                
                # Log individual source retrieval
                logger.debug("bedrock_kb_source_item", uri=uri, snippet_preview=snippet[:50])
                
                sources.append({
                    "content": snippet,
                    "uri": uri,
                })
        return output_text, sources
    except Exception as exc:
        logger.warning("bedrock_kb_failed", error=str(exc))
        return "", []


# ---------------------------------------------------------------------------
# Local fallback: keyword search over cached JSON
# ---------------------------------------------------------------------------

def _load_local_cache() -> list[dict]:
    if _local_cache.exists():
        try:
            return json.loads(_local_cache.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _local_search(profile: dict, top_n: int = 5) -> list[dict]:
    """Simple keyword match against cached schemes."""
    schemes = _load_local_cache()
    if not schemes:
        # Embedded minimal fallback so the page works even without running ingest
        return _embedded_fallback_schemes()

    state = (profile.get("state") or "").lower()
    occupation = (profile.get("occupation") or "").lower()
    keywords = ["insurance", "bima", "farmer", "kisan", "agricult"]
    if "crop" in occupation or "farm" in occupation:
        keywords += ["fasal", "crop"]

    scored = []
    for s in schemes:
        text = f"{s.get('name','')} {s.get('description','')} {' '.join(s.get('tags',[]))}".lower()
        score = sum(1 for kw in keywords if kw in text)
        if state and state in text:
            score += 2
        scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:top_n]]


def _embedded_fallback_schemes() -> list[dict]:
    """Always-available minimal scheme dataset (no API or cache required)."""
    return [
        {
            "id": "pmfby", "name": "PM Fasal Bima Yojana (PMFBY)",
            "ministry": "Ministry of Agriculture", "state": "Central",
            "description": "Comprehensive crop insurance cover against all non-preventable natural risks from pre-sowing to post-harvest. Farmer premium: 2% (Kharif), 1.5% (Rabi), 5% (Horticulture).",
            "eligibility": ["All farmers growing notified crops", "Loanee farmers compulsorily covered", "Non-loanee farmers can opt-in voluntarily"],
            "benefits": ["Full sum insured for crop loss", "Post-harvest losses covered for 14 days", "Localized calamities covered"],
            "official_url": "https://pmfby.gov.in",
        },
        {
            "id": "rwbcis", "name": "Restructured Weather Based Crop Insurance Scheme (RWBCIS)",
            "ministry": "Ministry of Agriculture", "state": "Central",
            "description": "Insurance based on weather parameters (rainfall, temperature, humidity) as proxy for crop losses. Faster settlement without crop cutting experiments.",
            "eligibility": ["Farmers in notified areas", "Covers notified weather-sensitive crops"],
            "benefits": ["Automatic claims based on weather station data", "Quick settlement within 45 days"],
            "official_url": "https://pmfby.gov.in",
        },
        {
            "id": "pmsby", "name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
            "ministry": "Ministry of Finance", "state": "Central",
            "description": "Accidental death and disability insurance at only ₹20/year premium. Full ₹2 lakh cover for accidental death or total disability.",
            "eligibility": ["Age 18-70 years", "Savings bank account holder", "Aadhaar linked to bank account"],
            "benefits": ["₹2 lakh for accidental death / total disability", "₹1 lakh for partial disability", "Only ₹20/year premium — auto-debited"],
            "official_url": "https://jansuraksha.gov.in",
        },
        {
            "id": "pmjjby", "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
            "ministry": "Ministry of Finance", "state": "Central",
            "description": "Life insurance cover of ₹2 lakh at just ₹436/year for any cause of death. Renewable annually.",
            "eligibility": ["Age 18-50 years", "Savings bank account with auto-debit consent"],
            "benefits": ["₹2 lakh life cover", "₹436/year premium", "Any cause of death covered"],
            "official_url": "https://jansuraksha.gov.in",
        },
        {
            "id": "livestock_insurance", "name": "Livestock Insurance Scheme",
            "ministry": "Ministry of Agriculture", "state": "Central",
            "description": "Covers loss of cattle (cows, buffaloes) at market value. 50% premium subsidy for BPL farmers and SC/ST farmers.",
            "eligibility": ["Animal owners with tagged cattle", "BPL / SC / ST farmers get 50% subsidy"],
            "benefits": ["Full market value compensation for death of animal", "Premium subsidy for marginal farmers"],
            "official_url": "https://dahd.nic.in",
        },
        {
            "id": "agri_infra_insurance", "name": "National Agriculture Insurance Scheme (NAIS)",
            "ministry": "Ministry of Agriculture", "state": "Central",
            "description": "Provides financial support to farmers suffering crop loss/damage due to calamities, pests & diseases.",
            "eligibility": ["All farmers (loanee and non-loanee)", "Covers food crops, oilseeds, and commercial crops"],
            "benefits": ["Coverage for post-harvest losses", "Marginal and small farmers get 10% subsidy on premium"],
            "official_url": "https://www.aicofindia.com",
        },
    ]


# ---------------------------------------------------------------------------
# Profile-based query builder
# ---------------------------------------------------------------------------

def _build_query(profile: dict) -> str:
    parts = ["insurance cover for"]
    if profile.get("occupation"):
        parts.append(profile["occupation"].lower())
    if profile.get("crop"):
        parts.append(f"growing {profile['crop']}")
    if profile.get("state"):
        parts.append(f"in {profile['state']}")
    if profile.get("land_acres"):
        parts.append(f"with {profile['land_acres']} acres of land")
    if profile.get("gender") and profile["gender"].lower() in ["female", "woman", "f"]:
        parts.append("women farmer")
    if profile.get("income_level"):
        parts.append(f"{profile['income_level']} income level")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Main: suggest insurance
# ---------------------------------------------------------------------------

async def suggest_insurance(
    user_details: dict,
    language: str = "en",
    tts_enabled: bool = False,
) -> dict:
    lang_name = LANG_NAMES.get(language, "English")
    query = _build_query(user_details)
    kb_id = getattr(settings, "BEDROCK_INSURANCE_KB_ID", "") if hasattr(settings, "BEDROCK_INSURANCE_KB_ID") else ""

    # Step 1: Retrieve relevant schemes
    bedrock_context, sources = "", []
    if kb_id:
        logger.info("using_bedrock_kb", kb_id=kb_id)
        bedrock_context, sources = await _bedrock_rag(query, kb_id)

    # Step 2: Local/API schemes for structured output
    local_schemes = _local_search(user_details)

    # Also try live API for the user's most relevant keyword
    live_kw = user_details.get("crop") or user_details.get("occupation") or "farmer insurance"
    live_schemes = await fetch_live_schemes(live_kw, size=5)
    all_schemes = (live_schemes or []) + local_schemes

    # Deduplicate
    seen_ids: set = set()
    unique_schemes = []
    for s in all_schemes:
        sid = s.get("id") or s.get("name", "")[:30]
        if sid and sid not in seen_ids:
            seen_ids.add(sid)
            unique_schemes.append(s)

    top_schemes = unique_schemes[:6]

    # Step 3: Format for Sarvam-M context
    scheme_text = "\n\n".join([
        f"**{s['name']}** ({s.get('state','Central')})\n"
        f"Description: {s.get('description','')[:300]}\n"
        f"Eligibility: {', '.join(str(e) for e in s.get('eligibility',[])[:3])}\n"
        f"Benefits: {', '.join(str(b) for b in s.get('benefits',[])[:3])}"
        for s in top_schemes
    ])

    profile_text = "\n".join([
        f"Name: {user_details.get('name','Not provided')}",
        f"Age: {user_details.get('age','Not provided')}",
        f"Gender: {user_details.get('gender','Not provided')}",
        f"State: {user_details.get('state','Not provided')}",
        f"District: {user_details.get('district','Not provided')}",
        f"Occupation: {user_details.get('occupation','Farmer')}",
        f"Land (acres): {user_details.get('land_acres','Not provided')}",
        f"Primary Crop: {user_details.get('crop','Not provided')}",
        f"Farming Type: {user_details.get('farming_type','Not provided')}",
        f"Annual Income: {user_details.get('income_level','Not provided')}",
        f"Category: {user_details.get('category','General')}",
    ])

    bedrock_extra = f"\nAdditional context from Knowledge Base:\n{bedrock_context}" if bedrock_context else ""

    prompt = (
        f"Farmer Profile:\n{profile_text}\n"
        f"{bedrock_extra}\n\n"
        f"Available Insurance Schemes:\n{scheme_text}\n\n"
        f"In {lang_name}, provide a personalised insurance recommendation:\n"
        "1. 🏆 Top 3 recommended schemes for this farmer (with clear REASON why each fits their profile)\n"
        "2. 📋 Documents they should collect NOW to apply\n"
        "3. ⚡ Most urgent action step (which scheme to apply for first and why)\n"
        "4. 💰 Estimated annual premium cost and benefit calculation for this farmer\n\n"
        "Be specific — mention the farmer's actual crop, state, gender, and income when justifying each choice."
    )

    system = (
        "You are AgriAI Insurance Advisor for Indian farmers. "
        "Match farmers to the best government insurance schemes based on their exact profile. "
        "Always explain WHY a scheme suits this specific farmer's situation. "
        f"Respond in {lang_name}."
    )

    logger.info("insurance_suggestion_reasoning", system=system, user_prompt=prompt)
    
    # Use Haiku via Bedrock if available (User requested marketplace model for suggestion)
    # Defaulting to use it when KB is active, as that implies AWS features are on for this flow.
    if kb_id:
        try:
            from app.core.aws_client import get_bedrock_client
            client = get_bedrock_client()
            # Combine system and user prompt for Haiku simple invocation
            full_prompt = f"{system}\n\nUSER REQUEST:\n{prompt}"
            ai_recommendation = await asyncio.to_thread(client.invoke_haiku, full_prompt)
        except Exception as e:
            logger.error("haiku_suggestion_failed", error=str(e))
            # Fallback to Sarvam
            messages = [{"role": "user", "content": prompt}]
            ai_recommendation = await _agent_loop(messages, system, tools_enabled=False)
    else:
        messages = [{"role": "user", "content": prompt}]
        ai_recommendation = await _agent_loop(messages, system, tools_enabled=False)

    audio_b64 = None
    if tts_enabled:
        clean = re.sub(r"[*#_`>\[\]()]", "", ai_recommendation)
        clean = re.sub(r"\n+", " ", clean).strip()[:400]
        audio_b64 = await generate_tts_audio(clean, language)

    return {
        "recommendation": ai_recommendation,
        "top_schemes": top_schemes,
        "sources": sources,
        "used_bedrock_kb": bool(kb_id and bedrock_context),
        "audio_base64": audio_b64,
        "audio_format": "wav",
        "language": language,
    }
