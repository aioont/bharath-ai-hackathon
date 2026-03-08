"""
Sarvam AI service — wraps Sarvam-M (chat), Sarvam Translate, and Sarvam Vision.
All calls use the official sarvamai Python SDK via asyncio.to_thread for non-blocking IO.
"""
from __future__ import annotations

import asyncio
import functools
import pathlib
import re
import structlog
from typing import Optional, List

from app.core.config import settings
from app.models.schemas import ChatMessageModel, FarmerProfile

logger = structlog.get_logger()

_PROMPTS_FILE = pathlib.Path(__file__).parent.parent / "prompts.yaml"


def _strip_think_blocks(text: str) -> str:
    """Remove leaked chain-of-thought tags from model output before showing users."""
    cleaned = text or ""
    for _ in range(3):
        updated = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        if updated == cleaned:
            break
        cleaned = updated
    cleaned = re.sub(r"</?think>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _normalize_chat_messages(messages: list) -> list:
    """Ensure the conversation starts with a user turn and strictly alternates roles."""
    normalized: list = []
    for message in messages:
        role = message.get("role")
        content = (message.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        entry = {"role": role, "content": content}
        if not normalized:
            if role != "user":
                continue
            normalized.append(entry)
            continue
        if normalized[-1]["role"] == role:
            normalized[-1] = entry
        else:
            normalized.append(entry)
    return normalized


def _has_explicit_schedule_time(raw_text: str) -> bool:
    """Return True only when the user explicitly gave a scheduling cue."""
    normalized = (raw_text or "").lower()
    schedule_patterns = [
        r"\btoday\b",
        r"\btomorrow\b",
        r"\btonight\b",
        r"\bmorning\b",
        r"\bevening\b",
        r"\bafternoon\b",
        r"\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b",
        r"\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bin\s+\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)\b",
        r"\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b",
        r"\b\d{1,2}(:\d{2})\s*(am|pm)\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b",
        r"\bjan(uary)?\b|\bfeb(ruary)?\b|\bmar(ch)?\b|\bapr(il)?\b|\bmay\b|\bjun(e)?\b|\bjul(y)?\b|\baug(ust)?\b|\bsep(tember)?\b|\boct(ober)?\b|\bnov(ember)?\b|\bdec(ember)?\b",
    ]
    return any(re.search(pattern, normalized) for pattern in schedule_patterns)


@functools.lru_cache(maxsize=1)
def _load_prompts() -> dict:
    """Load prompts.yaml once at startup (cached in-process)."""
    try:
        import yaml  # type: ignore
        with open(_PROMPTS_FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        logger.info("prompts_loaded", categories=list(data.get("categories", {}).keys()))
        return data
    except Exception as exc:
        logger.error("prompts_load_failed", error=str(exc), path=str(_PROMPTS_FILE))
        return {}


def _build_system_prompt(category: Optional[str] = None) -> str:
    """Combine base_prompt with the selected category's role_suffix from prompts.yaml."""
    prompts = _load_prompts()
    base = prompts.get("base_prompt", "").strip()
    if category:
        cat_data = prompts.get("categories", {}).get(category, {})
        role_suffix = cat_data.get("role_suffix", "").strip()
        if role_suffix:
            return f"{base}\n\n{role_suffix}"
    return base

# ---------------------------------------------------------------------------
# Language code mapping  (2-letter app code → Sarvam BCP-47 code)
# Sarvam AI officially supports 15 Indian languages + English
# ---------------------------------------------------------------------------
SARVAM_LANG = {
    # Major Indian Languages (fully supported by Sarvam AI)
    "en": "en-IN",  # English
    "hi": "hi-IN",  # Hindi (हिंदी)
    "bn": "bn-IN",  # Bengali (বাংলা)
    "te": "te-IN",  # Telugu (తెలుగు)
    "mr": "mr-IN",  # Marathi (मराठी)
    "ta": "ta-IN",  # Tamil (தமிழ்)
    "gu": "gu-IN",  # Gujarati (ગુજરાતી)
    "kn": "kn-IN",  # Kannada (ಕನ್ನಡ)
    "ml": "ml-IN",  # Malayalam (മലയാളം)
    "pa": "pa-IN",  # Punjabi (ਪੰਜਾਬੀ)
    "or": "od-IN",  # Odia (ଓଡ଼ିଆ)
    "as": "as-IN",  # Assamese (অসমীয়া)
    "ur": "ur-IN",  # Urdu (اردو)
    # Additional Supported Languages
    "ne": "ne-IN",  # Nepali (नेपाली)
    "sa": "sa-IN",  # Sanskrit (संस्कृत)
}

LANG_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "te": "Telugu",
    "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi", "or": "Odia", "as": "Assamese",
    "ur": "Urdu", "ne": "Nepali", "sa": "Sanskrit",
}

# System prompts are now loaded from backend/app/prompts.yaml via _load_prompts() / _build_system_prompt()


def _get_sarvam_client():
    """Return a SarvamAI client, or None if key not configured."""
    if not settings.SARVAM_API_KEY:
        return None
    try:
        from sarvamai import SarvamAI  # type: ignore
        return SarvamAI(api_subscription_key=settings.SARVAM_API_KEY)
    except ImportError:
        logger.warning("sarvamai SDK not installed; run: pip install sarvamai")
        return None
    except Exception as exc:
        logger.error("sarvam_client_init_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Agent Tools & Search
# ---------------------------------------------------------------------------

def _tool_search_web(query: str) -> str:
    """Perform a real web search using DuckDuckGo."""
    try:
        # Package was renamed from duckduckgo_search → ddgs
        try:
            from ddgs import DDGS  # type: ignore  (new package name)
        except ImportError:
            from duckduckgo_search import DDGS  # type: ignore  (old package name)
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            if not results:
                return "No search results found."
            summary = "\n".join([f"- {r['title']}: {r['body']}" for r in results])
            return f"Search Results for '{query}':\n{summary}"
    except ImportError:
        return "Search tool unavailable (install ddgs: pip install ddgs)."
    except Exception as e:
        logger.error("search_tool_error", error=str(e))
        return f"Search failed: {str(e)}"

async def _tool_get_weather(location: str) -> str:
    """Get real weather data using the Open-Meteo-backed weather service."""
    try:
        from app.services.weather_service import get_weather_forecast
        data = await get_weather_forecast(location, language="en", days=5)
        current = data.get("current", {})
        forecast = data.get("forecast", [])[:4]
        loc = data.get("location", location)

        lines = [
            f"Weather for {loc}:",
            f"Today: {current.get('condition','')}, "
            f"temp {current['temperature']['min']}–{current['temperature']['max']}°C, "
            f"humidity {current.get('humidity', '?')}%, "
            f"rain {current.get('rainfall', 0)} mm, "
            f"wind {current.get('wind_speed', 0)} km/h",
            f"Farming advice: {current.get('farming_advice', '')}",
        ]
        if forecast:
            lines.append("Next days:")
            for d in forecast:
                lines.append(
                    f"  {d['date']}: {d['condition']}, "
                    f"{d['temperature']['min']}–{d['temperature']['max']}°C, "
                    f"rain {d.get('rainfall', 0)} mm"
                )
        alerts = current.get("alerts", [])
        if alerts:
            for a in alerts:
                lines.append(f"ALERT ({a.get('severity','').upper()}): {a.get('message','')}")
        insights = data.get("agricultural_insights", [])
        if insights:
            lines.append("Insights: " + " | ".join(insights[:2]))

        logger.info("weather_tool_success", location=loc, condition=current.get("condition"))
        return "\n".join(lines)
    except Exception as e:
        logger.error("weather_tool_error", error=str(e), location=location)
        # Graceful fallback to web search
        return _tool_search_web(f"current weather {location} India today forecast")

async def _tool_market_prices(commodity: str, location: str) -> str:
    """Get live mandi prices from AGMARKNET API, with web search fallback."""
    from app.services.agmarknet_filters_service import load_agmarknet_filters
    from app.services.market_service import _fetch_from_agmarknet

    try:
        filters = load_agmarknet_filters()
        d = filters.get("data", {})

        # Resolve commodity ID by fuzzy name match
        commodity_id = None
        commodity_name = commodity
        for c in d.get("cmdt_data", []):
            cname = c.get("cmdt_name", "").lower()
            if commodity.lower() in cname or cname in commodity.lower():
                commodity_id = c["cmdt_id"]
                commodity_name = c["cmdt_name"]
                break

        # Resolve state ID (100000 = All States)
        state_id = 100000
        state_name = location
        for s in d.get("state_data", []):
            sname = s.get("state_name", "").lower()
            if location.lower() in sname or sname in location.lower():
                state_id = s["state_id"]
                state_name = s["state_name"]
                break

        if commodity_id:
            records = await _fetch_from_agmarknet(
                commodity_id=commodity_id,
                state_id=state_id,
            )
            if records:
                date = records[0].get("date", "today")
                lines = [
                    f"Live AGMARKNET mandi prices for {commodity_name} in {state_name} (as of {date}):"
                ]
                for r in records[:10]:
                    lines.append(
                        f"  {r['market']}, {r.get('state','')}: "
                        f"\u20b9{r['modal_price']}/Quintal "
                        f"(min \u20b9{r['min_price']}, max \u20b9{r['max_price']})"
                        + (f" — {r['variety']}" if r.get('variety') and r['variety'] != 'General' else "")
                    )
                if len(records) > 10:
                    lines.append(f"  ... and {len(records)-10} more markets.")
                logger.info("market_tool_agmarknet_success",
                            commodity=commodity_name, state=state_name, records=len(records))
                return "\n".join(lines)
            else:
                logger.info("market_tool_agmarknet_empty",
                            commodity=commodity, state=state_name,
                            note="No data today, falling back to web search")
        else:
            logger.info("market_tool_commodity_not_found", commodity=commodity)

    except Exception as e:
        logger.warning("market_tool_agmarknet_error", error=str(e),
                       commodity=commodity, location=location)

    # Fallback to targeted web search
    return _tool_search_web(
        f"current mandi price {commodity} {location} today site:agmarknet.gov.in "
        f"OR site:mandibhav.com OR site:kisan.gov.in"
    )

async def _tool_agriculture_knowledge(query: str) -> str:
    """Query agriculture knowledge base for farming information, crop cultivation, pest management, etc."""
    from app.core.config import settings
    from app.core.aws_client import get_bedrock_client
    from app.core.cache import get_cached_bedrock_kb_query, cache_bedrock_kb_query

    # Check if agriculture KB is configured
    if not settings.BEDROCK_AGRI_KB_ID:
        logger.warning("agri_kb_not_configured", query=query)
        return _tool_search_web(f"agriculture farming {query}")

    # Check cache first (saves OpenSearch cost)
    cached_result = await get_cached_bedrock_kb_query(query, settings.BEDROCK_AGRI_KB_ID)
    if cached_result:
        logger.info("agri_kb_cache_hit", query=query[:50])
        return cached_result

    bedrock = get_bedrock_client()

    # --- Strategy 1: RetrieveAndGenerate (full RAG with Amazon Nova Pro) ---
    try:
        response = await asyncio.to_thread(
            bedrock.retrieve_and_generate,
            query=query,
            kb_id=settings.BEDROCK_AGRI_KB_ID,
            max_results=5
        )
        output_text = response.get("output", {}).get("text", "")
        if output_text:
            await cache_bedrock_kb_query(query, settings.BEDROCK_AGRI_KB_ID, output_text)
            logger.info("agri_kb_rag_success", query=query[:50], length=len(output_text))
            return output_text
        logger.warning("agri_kb_rag_empty", query=query)
    except Exception as e:
        logger.warning("agri_kb_rag_failed", error=str(e), query=query[:50],
                       hint="Falling back to retrieve_only")

    # --- Strategy 2: Retrieve-only (chunks without generation — always works) ---
    try:
        chunks = await asyncio.to_thread(
            bedrock.retrieve_only,
            query=query,
            kb_id=settings.BEDROCK_AGRI_KB_ID,
            max_results=5
        )
        if chunks:
            passages = "\n\n".join(
                f"[Source {i+1}] {c['text']}" for i, c in enumerate(chunks)
            )
            result = f"Relevant agriculture knowledge for '{query}':\n\n{passages}"
            await cache_bedrock_kb_query(query, settings.BEDROCK_AGRI_KB_ID, result)
            logger.info("agri_kb_retrieve_only_success", query=query[:50], chunks=len(chunks))
            return result
        logger.warning("agri_kb_retrieve_only_empty", query=query)
    except Exception as e:
        logger.error("agri_kb_retrieve_only_failed", error=str(e), query=query[:50])

    # --- Strategy 3: Web search fallback ---
    logger.info("agri_kb_web_search_fallback", query=query[:50])
    return _tool_search_web(f"agriculture farming {query}")


# ---------------------------------------------------------------------------
# SCHEDULE tool — extract + persist reminders from chat mid-conversation
# ---------------------------------------------------------------------------

async def _tool_schedule_reminder(
    raw_text: str,
    user_id: str,
    user_email: str,
) -> str:
    """
    ReAct THINK→PLAN→ACT tool.

    THINK : parse raw_text for intent, item, date/time, and type.
    PLAN  : validate & fill defaults; ask for missing required fields.
    ACT   : persist reminder; return confirmation string for the agent.

    Returns a human-readable status string (the agent includes this in its reply).
    """
    import json as _json
    import re as _re
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz

    # ── Guard: need email to send reminders ──────────────────────────────────
    if not user_email or "@" not in user_email:
        return (
            "REMINDER_NEEDS_INFO: I'd love to set a reminder, but I need your "
            "email address first. Could you share it so I can send you the alert?"
        )

    # ── THINK: use the AI itself to extract structured data ─────────────────
    extraction_prompt = (
        "You are a data-extraction assistant. Given a farmer's message, "
        "extract reminder details as JSON with these fields:\n"
        "  title         : short reminder title (string)\n"
        "  body          : full reminder message to send to farmer (string)\n"
        "  reminder_type : one of fertilizer|irrigation|pesticide|harvest|sowing|market_alert|general\n"
        "  scheduled_at  : ISO 8601 datetime in UTC (string). "
        "Today (IST) is " + _dt.now().strftime("%Y-%m-%d %H:%M") + ". "
        "If farmer says 'tomorrow', add 1 day. If time not mentioned, use 08:00 IST (02:30 UTC).\n"
        "  commodity     : crop/commodity name if market_alert, else null\n"
        "  target_price  : numeric price if market_alert, else null\n"
        "  price_direction: 'above' or 'below' if market_alert, else null\n\n"
        "Farmer message: " + raw_text + "\n\n"
        "Return ONLY valid JSON. No explanation."
    )

    extracted: dict = {}
    try:
        raw_resp = await asyncio.to_thread(
            _sync_chat,
            [{"role": "user", "content": extraction_prompt}],
            "You extract structured data from text. Output only valid JSON.",
        )
        json_match = _re.search(r"\{.*\}", raw_resp, _re.DOTALL)
        if json_match:
            extracted = _json.loads(json_match.group())
    except Exception as exc:
        logger.warning("schedule_extraction_failed: %s", exc)

    # ── PLAN: validate required fields ───────────────────────────────────────
    title = extracted.get("title", "").strip()
    body = extracted.get("body", "").strip()
    reminder_type = extracted.get("reminder_type", "general")
    scheduled_at_raw = extracted.get("scheduled_at", "")
    commodity = extracted.get("commodity")
    target_price = extracted.get("target_price")
    price_direction = extracted.get("price_direction", "above")

    if reminder_type == "market_alert":
        if not commodity:
            return (
                "REMINDER_NEEDS_INFO: I can set the market alert, but which crop or commodity "
                "should I track?"
            )
        if target_price in (None, ""):
            return (
                "REMINDER_NEEDS_INFO: I can set the market alert, but what target price should I watch for?"
            )
    elif not _has_explicit_schedule_time(raw_text):
        return (
            "REMINDER_NEEDS_INFO: I can set that reminder. When should I remind you about fertilizing? "
            "For example: tomorrow morning, today at 6 PM, or next Monday."
        )

    if not title:
        title = "Farming Reminder"
    if not body:
        body = raw_text  # fall back to full message

    # Validate / parse scheduled_at
    scheduled_at: _dt | None = None
    if scheduled_at_raw:
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                scheduled_at = _dt.strptime(scheduled_at_raw, fmt).replace(
                    tzinfo=_tz.utc
                )
                break
            except ValueError:
                continue

    if not scheduled_at:
        # Default: tomorrow 08:00 IST (UTC+5:30 → 02:30 UTC)
        tomorrow = _dt.now(_tz.utc) + _td(days=1)
        scheduled_at = tomorrow.replace(hour=2, minute=30, second=0, microsecond=0)

    # ── ACT: persist ─────────────────────────────────────────────────────────
    try:
        from app.services.reminder_service import create_reminder
        row = create_reminder(
            user_id=user_id,
            user_email=user_email,
            title=title,
            body=body,
            scheduled_at=scheduled_at,
            reminder_type=reminder_type,
            commodity=commodity,
            target_price=float(target_price) if target_price else None,
            price_direction=price_direction,
            raw_chat_text=raw_text,
        )
        # Format scheduled time in IST for display
        ist_offset = _td(hours=5, minutes=30)
        ist_time = (scheduled_at + ist_offset).strftime("%d %b %Y at %I:%M %p IST")
        return (
            f"REMINDER_SET_SUCCESS: Reminder scheduled!\n"
            f"  📌 Title: {title}\n"
            f"  🕐 When: {ist_time}\n"
            f"  📧 Email: {user_email}\n"
            f"  ID: #{row['id']}\n"
            f"The farmer will receive an email reminder at that time."
        )
    except Exception as exc:
        logger.error("schedule_reminder_db_error: %s", exc)
        return f"REMINDER_FAILED: Could not save reminder due to a database error: {exc}"


AVAILABLE_TOOLS = {
    "SEARCH": _tool_search_web,
    "WEATHER": _tool_get_weather,
    "MARKET": _tool_market_prices,
    "KNOWLEDGE": _tool_agriculture_knowledge,
    "SCHEDULE": _tool_schedule_reminder,   # 🆕 reminder scheduling
}


# ---------------------------------------------------------------------------
# Chat / Reasoning  (Sarvam-M with Tool Use)
# ---------------------------------------------------------------------------

async def _agent_loop(
    messages: list,
    system_prompt: str,
    tools_enabled: bool = True,
    user_id: str = "anonymous",
    user_email: str = "",
) -> str:
    """
    ReAct (Reason + Act) agent loop with THINK → PLAN → ACT pattern.

    Capabilities:
    - THINK : decides which tool to call (or to answer directly)
    - PLAN  : validates required data, asks for missing fields
    - ACT   : executes tool, observes result, continues loop

    Tools: SEARCH | WEATHER | MARKET | KNOWLEDGE | SCHEDULE
    Max tool turns: 5
    """
    if not tools_enabled:
        response_text = await asyncio.to_thread(_sync_chat, messages, system_prompt)
        return _strip_think_blocks(response_text)

    # Augmented system prompt for tool use
    tool_instructions = (
        "\n\nYou have access to these tools to answer questions accurately:\n"
        "- SEARCH: General knowledge, news, government schemes (web search).\n"
        "- WEATHER: Current weather and forecasts.\n"
        "- MARKET: Mandi prices and market trends. ALWAYS use this for ANY price/rate/mandi question.\n"
        "- KNOWLEDGE: Agriculture knowledge base - use for farming practices, crop cultivation, "
        "pest management, soil health, fertilizer recommendations, etc.\n"
        "- SCHEDULE: Set a reminder / schedule an event for the farmer. Use this whenever the farmer "
        "mentions wanting to remember something, set an alert, schedule a task "
        "(e.g. 'remind me to add fertilizer tomorrow', 'alert me when wheat price goes above ₹2500', "
        "'set a reminder for irrigation next Monday').\n\n"
        "To use a tool, your response must be valid JSON strictly in this format:\n"
        '{"tool": "SEARCH", "query": "your search query"}\n'
        '{"tool": "WEATHER", "location": "city name"}\n'
        '{"tool": "MARKET", "commodity": "crop name", "location": "state name"}\n'
        '{"tool": "KNOWLEDGE", "query": "farming question"}\n'
        '{"tool": "SCHEDULE", "raw_text": "exactly what the farmer said about the reminder"}\n\n'
        "AGENT REASONING PATTERN (THINK → PLAN → ACT):\n"
        "  THINK: What does the farmer need? Which tool applies?\n"
        "  PLAN:  Do I have all required info? If not, ask ONE clarifying question.\n"
        "  ACT:   Call the tool. Read the result. Respond helpfully in the farmer's language.\n\n"
        "CRITICAL RULES:\n"
        "- NEVER answer price/rate/mandi questions from training data — always call MARKET first.\n"
        "- For SCHEDULE, always pass the farmer's original words as raw_text.\n"
        "- For location in MARKET/WEATHER, use the STATE name (e.g. Kerala, Maharashtra).\n"
        "- Use KNOWLEDGE tool for farming/crop cultivation questions.\n"
        "- If no tool is needed, just respond with expert advice in the user's language."
    )
    
    agent_system = system_prompt + tool_instructions
    
    # We allow max 5 tool turns to support THINK→PLAN→ACT chaining
    for _ in range(5):
        try:
            messages = _normalize_chat_messages(messages)

            # 1. Get AI response
            response_text = await asyncio.to_thread(_sync_chat, messages, agent_system)
            response_text = _strip_think_blocks(response_text)
            
            # 2. Check if it's a tool call (JSON)
            import json
            import re
            
            # Try to find JSON block
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                try:
                    tool_call = json.loads(json_match.group())
                    tool_name = tool_call.get("tool")
                    
                    if tool_name in AVAILABLE_TOOLS:
                        # Execute Tool
                        logger.info("agent_tool_use", tool=tool_name, params=tool_call)
                        
                        if tool_name == "SEARCH":
                            tool_result = await asyncio.to_thread(_tool_search_web, tool_call.get("query", ""))
                        elif tool_name == "WEATHER":
                            tool_result = await _tool_get_weather(tool_call.get("location", ""))
                        elif tool_name == "MARKET":
                            tool_result = await _tool_market_prices(tool_call.get("commodity", ""), tool_call.get("location", ""))
                        elif tool_name == "KNOWLEDGE":
                            tool_result = await _tool_agriculture_knowledge(tool_call.get("query", ""))
                        elif tool_name == "SCHEDULE":
                            tool_result = await _tool_schedule_reminder(
                                raw_text=tool_call.get("raw_text", ""),
                                user_id=user_id,
                                user_email=user_email,
                            )
                        else:
                            tool_result = "Unknown tool."

                        # Append Exchange to History
                        # Note: We need to append the AI's "thought" (the JSON) and the "observation" (result)
                        # Sarvam might handle this better if we just append the result as a System or User message context
                        messages.append({"role": "assistant", "content": response_text})
                        messages.append({"role": "user", "content": f"Tool Output: {tool_result}\n\nNow answer the user's original request based on this."})
                        continue  # Loop again to get final answer
                        
                except json.JSONDecodeError:
                    pass # Not valid JSON, treat as final answer

            # If no valid tool call found, this is the final answer
            return _strip_think_blocks(response_text)

        except Exception as e:
            logger.error("agent_loop_error", error=str(e))
            return "I apologize, but I encountered an error while processing your request."

    return "I apologize, this request is taking too long."


def _sync_chat(messages: list, system: str) -> str:
    client = _get_sarvam_client()
    if not client:
        raise RuntimeError("no_sarvam_client — check SARVAM_API_KEY")

    messages = _normalize_chat_messages(messages)

    # Sarvam API does not support a "system" role — prepend the system prompt
    # to the first user message so context is preserved.
    combined: list = []
    system_injected = False
    for m in messages:
        if m["role"] == "user" and not system_injected:
            combined.append({"role": "user", "content": f"{system}\n\n---\n\n{m['content']}"})
            system_injected = True
        else:
            combined.append(m)
    if not system_injected:
        # Fallback: no user message found — inject as opening user turn
        combined = [{"role": "user", "content": system}] + messages

    response = client.chat.completions(
        messages=combined,
        temperature=0.3,
        top_p=0.9,
        max_tokens=1024,
    )

    if hasattr(response, "choices"):
        return response.choices[0].message.content
    if isinstance(response, dict):
        return response["choices"][0]["message"]["content"]
    return str(response)


async def get_ai_response(
    message: str,
    language: str = "en",
    conversation_history: Optional[List[ChatMessageModel]] = None,
    category: Optional[str] = None,
    farmer_profile: Optional[FarmerProfile] = None,
    user_id: str = "anonymous",
    user_email: str = "",
) -> dict:
    """Generate AI response using Sarvam-M model."""
    # Apply AWS Guardrail (ONLY for English)
    if language == "en":
        from app.core.aws_client import get_bedrock_client
        bedrock = get_bedrock_client()
        if bedrock:
            try:
                # Run sync in thread to avoid blocking loop
                guard_res = await asyncio.to_thread(bedrock.apply_guardrail, message, "INPUT")
                if guard_res.get("action") == "GUARDRAIL_INTERVENED":
                    logger.warning("guardrail_blocked_input", message=message[:50])
                    return {
                        "response": "I apologize, but I cannot answer that question as it violates our safety policies.",
                        "language": language,
                        "model": "guardrail-intervention",
                        "tokens_used": 0,
                    }
            except Exception as e:
                logger.error("guardrail_check_failed", error=str(e))
                # Fail open (continue)

    lang_name = LANG_NAMES.get(language, "English")
    profile_ctx = ""
    if farmer_profile:
        ctx_parts = []

        # Basic farmer info
        if farmer_profile.state:
            loc = farmer_profile.state
            if farmer_profile.district:
                loc = f"{farmer_profile.district}, {farmer_profile.state}"
            ctx_parts.append(f"Location: {loc}")

        if farmer_profile.farming_type:
            ctx_parts.append(f"Farming approach: {farmer_profile.farming_type}")

        # Multi-crop list (preferred)
        if farmer_profile.crops:
            primary = next((c for c in farmer_profile.crops if c.is_primary), None)
            if primary:
                ctx_parts.append(f"Primary crop: {primary.crop_name}" +
                    (f" ({primary.variety})" if primary.variety else "") +
                    (f", {primary.area_acres} acres" if primary.area_acres else "") +
                    (f", {primary.season} season" if primary.season else "") +
                    (f", {primary.irrigation} irrigation" if primary.irrigation else "") +
                    (f", {primary.soil_type} soil" if primary.soil_type else ""))

            other_crops = [c for c in farmer_profile.crops if not c.is_primary]
            if other_crops:
                other_names = ", ".join(
                    c.crop_name + (f" ({c.area_acres} ac)" if c.area_acres else "")
                    for c in other_crops
                )
                ctx_parts.append(f"Also grows: {other_names}")

            # Collect all unique soil types and seasons across crops
            soils = list({c.soil_type for c in farmer_profile.crops if c.soil_type})
            seasons = list({c.season for c in farmer_profile.crops if c.season})
            irrigations = list({c.irrigation for c in farmer_profile.crops if c.irrigation})
            if soils:
                ctx_parts.append(f"Soil type(s): {', '.join(soils)}")
            if seasons:
                ctx_parts.append(f"Season(s): {', '.join(seasons)}")
            if irrigations:
                ctx_parts.append(f"Irrigation: {', '.join(irrigations)}")

            total_area = sum(c.area_acres or 0 for c in farmer_profile.crops)
            if total_area > 0:
                ctx_parts.append(f"Total farm area: {total_area:.1f} acres")

        else:
            # Fallback: legacy single-crop fields
            if farmer_profile.crop:
                ctx_parts.append(f"Primary crop: {farmer_profile.crop}")
            if farmer_profile.soil_type:
                ctx_parts.append(f"Soil: {farmer_profile.soil_type}")
            if farmer_profile.season:
                ctx_parts.append(f"Season: {farmer_profile.season}")

        if ctx_parts:
            profile_ctx = "\nFarmer context: " + " | ".join(ctx_parts)

    system_prompt_base = _build_system_prompt(category)

    system = (
        system_prompt_base
        + f"\n\nRespond in {lang_name}. Language Code: {language}"
        + profile_ctx
    )

    messages: list = []
    if conversation_history:
        # Sarvam requires messages to start with a user turn and strictly alternate.
        # Build a clean alternating list from the last 10 history entries.
        raw: list = []
        for m in conversation_history[-10:]:
            role = m.role if m.role in ["user", "assistant"] else "user"
            raw.append({"role": role, "content": m.content})
        messages = _normalize_chat_messages(raw)

    # Append the current user message.
    # If the cleaned history is empty or ends with assistant, add it normally.
    # If history ends with user (shouldn't normally happen), replace to avoid duplicate.
    if messages and messages[-1]["role"] == "user":
        # Replace the trailing user entry (e.g. duplicate from frontend slice)
        messages[-1] = {"role": "user", "content": message}
    else:
        messages.append({"role": "user", "content": message})

    try:
        # Use Agent Loop instead of direct sync_chat
        response_text = await _agent_loop(
            messages, system, tools_enabled=True,
            user_id=user_id, user_email=user_email,
        )
        response_text = _strip_think_blocks(response_text)
        return {
            "response": response_text,
            "language": language,
            "model": settings.SARVAM_CHAT_MODEL,
            "tokens_used": len(response_text.split()),
        }
    except Exception as exc:
        logger.error("sarvam_chat_failed", error=str(exc), message_preview=message[:80])
        # Re-raise so the FastAPI route returns a proper 502, not a silent demo response
        raise


# ---------------------------------------------------------------------------
# Text-to-Speech  (Sarvam TTS → base64 WAV)
# ---------------------------------------------------------------------------

def _sync_tts(text: str, language: str) -> Optional[bytes]:
    """Call Sarvam TTS synchronously; returns raw audio bytes or None."""
    client = _get_sarvam_client()
    if not client:
        return None
    try:
        sarvam_lang = SARVAM_LANG.get(language, "en-IN")
        # Sarvam TTS: text_to_speech endpoint
        response = client.text_to_speech.convert(
            text=text[:500],      # cap at 500 chars per request
            target_language_code=sarvam_lang,
            speaker="anushka",    # female Indian voice; works for all 10 Indic langs
            model="bulbul:v2",
            enable_preprocessing=True,
        )
        # SDK may return bytes directly or a response object
        if isinstance(response, (bytes, bytearray)):
            return bytes(response)
        # Some SDK versions return object with .audios list
        if hasattr(response, "audios") and response.audios:
            audio = response.audios[0]
            if isinstance(audio, (bytes, bytearray)):
                return bytes(audio)
            if isinstance(audio, str):
                # already base64
                import base64
                return base64.b64decode(audio)
        if isinstance(response, dict):
            audios = response.get("audios", [])
            if audios:
                import base64
                return base64.b64decode(audios[0]) if isinstance(audios[0], str) else audios[0]
        return None
    except Exception as exc:
        logger.warning("sarvam_tts_failed", error=str(exc), language=language)
        return None


async def generate_tts_audio(text: str, language: str = "en") -> Optional[str]:
    """Generate TTS audio for the given text; returns base64-encoded WAV or None."""
    import base64
    # Strip markdown formatting before TTS
    import re
    clean = re.sub(r"[*#_`>~\[\]()]", "", text)
    clean = re.sub(r"\n+", " ", clean).strip()
    if not clean:
        return None
    audio_bytes = await asyncio.to_thread(_sync_tts, clean[:500], language)
    if audio_bytes:
        return base64.b64encode(audio_bytes).decode("utf-8")
    return None


# ---------------------------------------------------------------------------
# Crop Disease Analysis  (AWS Rekognition labels → Sarvam-M diagnosis)
# Sarvam Vision is OCR-only; we use Rekognition for image understanding.
# ---------------------------------------------------------------------------

def _rekognition_labels(image_bytes: bytes) -> list[str]:
    """Detect visual labels from a crop image using AWS Rekognition."""
    try:
        import boto3
        if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
            return []
        rek = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        resp = rek.detect_labels(
            Image={"Bytes": image_bytes}, MaxLabels=20, MinConfidence=65
        )
        return [lbl["Name"] for lbl in resp["Labels"]]
    except Exception as exc:
        logger.warning("rekognition_labels_failed", error=str(exc))
        return []


def _sync_diagnose(prompt: str) -> str:
    """Use Sarvam-M to generate a structured crop-disease JSON response."""
    client = _get_sarvam_client()
    if not client:
        raise RuntimeError("no_client")
    system = (
        "You are an expert plant pathologist for Indian crops. "
        "Always respond with a valid JSON object containing exactly these keys: "
        "disease_name, confidence (float 0-1), severity (low/medium/high), "
        "description (string), symptoms (list of strings), "
        "treatment (list of strings), prevention (list of strings), "
        "affected_crops (list of strings). No extra text outside JSON."
    )
    # Sarvam API does not support system role — prefix instructions to user message
    response = client.chat.completions(
        messages=[{"role": "user", "content": f"{system}\n\n{prompt}"}],
        temperature=0.2,
        max_tokens=800,
    )
    if hasattr(response, "choices"):
        return response.choices[0].message.content
    if isinstance(response, dict):
        return response["choices"][0]["message"]["content"]
    return str(response)


async def analyze_crop_disease(
    image_bytes: bytes,
    language: str = "en",
    crop_name: Optional[str] = None,
    custom_labels: Optional[list] = None,
) -> dict:
    """
    Analyze crop image for disease.
    Priority: Rekognition Custom Labels model > General Rekognition labels > AI fallback.
    Nova Lite is used for diagnosis synthesis (fast + cheap).
    """
    lang_name = LANG_NAMES.get(language, "English")
    crop_ctx = f" {crop_name}" if crop_name else ""

    if custom_labels:
        # Custom model labels — most accurate path
        top = custom_labels[:3]  # already sorted by confidence desc
        confidence_text = "; ".join(
            f'{l["name"]} ({int(l["confidence"] * 100)}%)' for l in top
        )
        prompt = (
            f"AWS Rekognition Custom Disease Detection analysed a{crop_ctx} crop image.\n"
            f"Detected labels (by confidence): {confidence_text}\n\n"
            f"The top detection '{top[0]['name']}' is the primary finding. "
            f"Provide a detailed agricultural diagnosis for an Indian farmer. "
            f"Respond in {lang_name} with a valid JSON object containing exactly these keys: "
            f"disease_name (string), confidence (float 0-1, use {top[0]['confidence']}), "
            f"severity (one of: low/medium/high), description (string), "
            f"symptoms (list of strings), treatment (list of strings), "
            f"prevention (list of strings), affected_crops (list of strings). "
            f"No text outside the JSON."
        )
        model_source = "rekognition_custom"
    else:
        # Fall back to general Rekognition detect_labels
        labels = await asyncio.to_thread(_rekognition_labels, image_bytes)
        label_text = ", ".join(labels) if labels else None
        model_source = "rekognition_general" if labels else "fallback"

        if label_text:
            prompt = (
                f"An image of a{crop_ctx} crop was analysed by AWS Rekognition and shows: {label_text}. "
                f"Based on these visual cues, diagnose any plant diseases, pest damage, or nutrient deficiencies. "
                f"Respond in {lang_name} with a valid JSON object: disease_name, confidence (float 0-1), "
                f"severity (low/medium/high), description, symptoms (list), treatment (list), "
                f"prevention (list), affected_crops (list). No text outside JSON."
            )
        else:
            prompt = (
                f"A{crop_ctx} crop image was uploaded for disease diagnosis. "
                f"Assess the most common diseases affecting {crop_name or 'Indian crops'} and provide "
                f"a structured diagnosis. Respond in {lang_name} with a valid JSON object: "
                f"disease_name, confidence (float 0-1), severity (low/medium/high), description, "
                f"symptoms (list), treatment (list), prevention (list), affected_crops (list). No text outside JSON."
            )

    # Try Nova Lite first (fast, cheap), fall back to Sarvam-M
    raw = None
    try:
        from app.core.aws_client import get_bedrock_client
        bedrock = get_bedrock_client()
        raw = await asyncio.to_thread(bedrock.invoke_nova, prompt, 1000, 0.2, False)
    except Exception:
        pass

    if raw is None:
        try:
            raw = await asyncio.to_thread(_sync_diagnose, prompt)
        except Exception as exc:
            logger.warning("crop_disease_fallback", error=str(exc))
            result = _demo_vision(crop_name, language)
            result["model_source"] = "fallback"
            result["raw_labels"] = custom_labels or []
            return result

    try:
        import json as _json
        import re as _re
        json_match = _re.search(r"\{.*\}", raw, _re.DOTALL)
        result = _json.loads(json_match.group()) if json_match else {
            "disease_name": "Analysis Complete",
            "confidence": 0.80,
            "severity": "medium",
            "description": raw[:400],
            "symptoms": [],
            "treatment": [],
            "prevention": [],
            "affected_crops": [crop_name] if crop_name else [],
        }
    except Exception:
        result = {
            "disease_name": "Analysis Complete",
            "confidence": 0.75,
            "severity": "medium",
            "description": (raw or "")[:400],
            "symptoms": [],
            "treatment": [],
            "prevention": [],
            "affected_crops": [crop_name] if crop_name else [],
        }

    result["model_source"] = model_source
    result["raw_labels"] = custom_labels or []
    return result


# ---------------------------------------------------------------------------
# Demo / offline fallbacks
# ---------------------------------------------------------------------------

def _demo_chat(message: str, language: str) -> dict:
    responses = {
        "hi": "नमस्ते किसान भाई! आपका प्रश्न प्राप्त हुआ। कृपया अपनी फसल और मिट्टी की जानकारी दें।",
        "mr": "नमस्कार शेतकरी बंधू! तुमचा प्रश्न मिळाला. कृपया तुमच्या पिकाची माहिती द्या.",
        "ta": "வணக்கம் விவசாயி! உங்கள் கேள்வி கிடைத்தது. உங்கள் பயிர் பற்றிய தகவலை தயவுசெய்து வழங்குங்கள்.",
        "en": (
            "Hello farmer! I'm AgriAI, your agricultural assistant. "
            "I can help with crop diseases, weather-based decisions, government schemes, and market prices. "
            "What would you like to know?"
        ),
    }
    return {
        "response": responses.get(language, responses["en"]),
        "language": language,
        "model": "demo",
        "tokens_used": 0,
    }


def _demo_vision(crop_name: Optional[str], language: str) -> dict:
    crop = crop_name or "crop"
    return {
        "disease_name": f"Leaf Blight ({crop})",
        "confidence": 0.85,
        "severity": "medium",
        "description": (
            f"Early signs of fungal infection detected on {crop}. "
            "Brownish water-soaked lesions visible on leaves."
        ),
        "symptoms": [
            "Brown water-soaked lesions on leaves",
            "Yellowing around infected areas",
            "Premature leaf drop",
        ],
        "treatment": [
            "Apply Mancozeb 75WP @ 2.5g/litre water",
            "Remove and destroy infected plant parts",
            "Avoid overhead irrigation",
        ],
        "prevention": [
            "Use certified disease-free seeds",
            "Maintain proper plant spacing",
            "Ensure good drainage",
            "Rotate crops every season",
        ],
        "affected_crops": [crop],
    }
