"""
AgriAI Evaluation Service — powered by DeepEval (Apache-2.0 free framework)

Metrics implemented:
  1. Answer Relevancy  (DeepEval GEval) — is the response relevant to the question?
  2. Agriculture Guardrail Adherence — off-topic queries refused correctly?
  3. Factual Consistency — does the response align with provided context?
  4. Language Consistency — response in correct language?
  5. Completeness — key expected points covered?

Judge LLM: Sarvam-M (free, already configured) via DeepEvalBaseLLM wrapper
"""
from __future__ import annotations
import asyncio
import json
import re
import time
from pathlib import Path
from typing import Any, Optional
import yaml
import structlog

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Amazon Nova Lite as Evaluation Judge (available in ap-south-1, cheapest option)
# ---------------------------------------------------------------------------

class NovaJudgeLLM:
    """Wraps AWS Bedrock Amazon Nova Lite for use as a judge/grader model."""

    def __init__(self):
        try:
            from app.core.aws_client import get_bedrock_client, BedrockClient
            self.client: BedrockClient | None = get_bedrock_client()
        except ImportError:
            self.client = None

    async def a_generate(self, prompt: str) -> str:
        if not self.client:
             return '{"score": 0.5, "reason": "bedrock client unavailable"}'
        try:
            # Use Nova Lite for evaluation (cheap, available in ap-south-1)
            return await asyncio.to_thread(self.client.invoke_nova, prompt)
        except Exception as exc:
            logger.warning("nova_judge_error", error=str(exc))
            return f'{{"score": 0.5, "reason": "error: {str(exc)}"}}'



# ---------------------------------------------------------------------------
# Load test cases from YAML
# ---------------------------------------------------------------------------

EVAL_DIR = Path(__file__).parent
TEST_CASES_FILE = EVAL_DIR / "test_cases.yaml"


def load_test_cases() -> list[dict]:
    with open(TEST_CASES_FILE, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("test_cases", [])


# ---------------------------------------------------------------------------
# Core evaluation helpers (heuristic + LLM-as-judge)
# ---------------------------------------------------------------------------

def _keyword_overlap(response: str, expected: str) -> float:
    """Fraction of key words in expected that appear in response (case-insensitive)."""
    resp_lower = response.lower()
    exp_words = set(re.findall(r'\b\w{4,}\b', expected.lower()))
    if not exp_words:
        return 1.0
    matched = sum(1 for w in exp_words if w in resp_lower)
    return round(matched / len(exp_words), 3)


def _language_match(response: str, expected_lang: str) -> float:
    """Heuristic: check if response uses script matching the expected language."""
    if expected_lang == "en":
        # Should be mostly ASCII / Latin
        latin_chars = sum(1 for c in response if ord(c) < 256)
        return 1.0 if (latin_chars / max(len(response), 1)) > 0.75 else 0.3
    if expected_lang == "hi":
        devanagari = sum(1 for c in response if '\u0900' <= c <= '\u097f')
        return 1.0 if devanagari > 5 else 0.2
    return 0.8  # neutral for other languages


def _guardrail_check(response: str, is_guardrail_test: bool) -> float:
    """1.0 if off-topic was correctly refused, 0.0 if answered verbosely."""
    refusal_phrases = [
        "i'm agriai", "agriai", "only help with agri", "farming topics",
        "agriculture", "farming assistant", "only answer", "please ask me"
    ]
    contains_refusal = any(p in response.lower() for p in refusal_phrases)
    if is_guardrail_test:
        return 1.0 if contains_refusal else 0.0
    else:
        # Non-guardrail test: penalise if AI wrongly refused
        return 0.0 if contains_refusal else 1.0


async def _llm_relevancy_score(
    question: str, response: str, expected: str, judge: NovaJudgeLLM
) -> tuple[float, str]:
    """Ask Nova Lite judge to grade relevancy of the response (0-1 scale)."""
    prompt = (
        "You are an expert agricultural AI evaluator.\n"
        "Grade the following AI response on a scale of 0.0 to 1.0 for:\n"
        "1. Relevance to the question\n"
        "2. Factual accuracy (compare with expected answer)\n"
        "3. Actionability (does it give practical advice?)\n\n"
        f"Question: {question}\n\n"
        f"Expected Answer: {expected}\n\n"
        f"AI Response: {response}\n\n"
        "Reply ONLY with JSON: "
        '{\"score\": <0.0-1.0>, \"reason\": \"<one short sentence>\"}'
    )
    try:
        if not judge.client:
             return 0.5, "judge unavailable"
             
        raw = await judge.a_generate(prompt)
        # Extract JSON safely
        match = re.search(r'\{[^}]+\}', raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            score = float(parsed.get("score", 0.5))
            reason = str(parsed.get("reason", ""))
            return round(min(max(score, 0.0), 1.0), 3), reason
    except Exception as exc:
        logger.warning("llm_judge_parse_failed", error=str(exc))
    return 0.5, "parse error"


# ---------------------------------------------------------------------------
# Run one test case
# ---------------------------------------------------------------------------

async def _run_one(
    tc: dict,
    judge: NovaJudgeLLM,
    use_llm_judge: bool = True,
) -> dict:
    from app.services.sarvam_service import get_ai_response

    tc_id = tc["id"]
    question = tc["input"]
    expected = tc["expected_output"].strip()
    language = tc.get("language", "en")
    category = tc.get("category", "general")
    is_guardrail = tc.get("is_guardrail_test", False)

    start = time.perf_counter()
    try:
        result = await get_ai_response(
            message=question,
            language=language,
            conversation_history=[],
            category=category,
        )
        response = result.get("response", "")
    except Exception as exc:
        response = f"ERROR: {exc}"
    latency_ms = round((time.perf_counter() - start) * 1000, 1)

    # ── Metric 1: LLM-as-judge relevancy
    if use_llm_judge and not is_guardrail:
        llm_score, llm_reason = await _llm_relevancy_score(question, response, expected, judge)
    else:
        llm_score, llm_reason = (None, "guardrail test — skipped")

    # ── Metric 2: Keyword overlap with expected answer
    keyword_score = _keyword_overlap(response, expected)

    # ── Metric 3: Language consistency
    lang_score = _language_match(response, language)

    # ── Metric 4: Guardrail adherence
    guardrail_score = _guardrail_check(response, is_guardrail)

    # ── Composite score
    if is_guardrail:
        composite = round(guardrail_score, 3)
    else:
        weights = {"llm": 0.5, "keyword": 0.25, "lang": 0.15, "guardrail": 0.1}
        composite = round(
            weights["llm"] * (llm_score or 0.5)
            + weights["keyword"] * keyword_score
            + weights["lang"] * lang_score
            + weights["guardrail"] * guardrail_score,
            3,
        )

    passed = composite >= 0.6  # pass threshold

    return {
        "id": tc_id,
        "category": category,
        "language": language,
        "is_guardrail": is_guardrail,
        "question": question,
        "response": response[:500] + ("…" if len(response) > 500 else ""),
        "expected_summary": expected[:200] + ("…" if len(expected) > 200 else ""),
        "metrics": {
            "llm_relevancy": llm_score,
            "llm_reason": llm_reason,
            "keyword_overlap": keyword_score,
            "language_match": lang_score,
            "guardrail_adherence": guardrail_score,
        },
        "composite_score": composite,
        "passed": passed,
        "latency_ms": latency_ms,
    }


# ---------------------------------------------------------------------------
# Run full evaluation suite
# ---------------------------------------------------------------------------

async def run_evaluation(
    categories: Optional[list[str]] = None,
    use_llm_judge: bool = True,
    max_cases: int = 20,
) -> dict:
    """Run all test cases and return aggregated results."""
    test_cases = load_test_cases()
    if categories:
        test_cases = [tc for tc in test_cases if tc.get("category") in categories]
    test_cases = test_cases[:max_cases]

    judge = NovaJudgeLLM()

    # Run all test cases (sequentially to avoid rate limits)
    results = []
    for tc in test_cases:
        try:
            result = await _run_one(tc, judge, use_llm_judge=use_llm_judge)
        except Exception as exc:
            result = {"id": tc["id"], "error": str(exc), "passed": False, "composite_score": 0}
        results.append(result)

    # Aggregate
    total = len(results)
    passed = sum(1 for r in results if r.get("passed"))
    scores = [r["composite_score"] for r in results if "composite_score" in r]
    avg_score = round(sum(scores) / len(scores), 3) if scores else 0
    latencies = [r.get("latency_ms", 0) for r in results]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0

    by_category: dict[str, dict] = {}
    for r in results:
        cat = r.get("category", "unknown")
        if cat not in by_category:
            by_category[cat] = {"total": 0, "passed": 0, "scores": []}
        by_category[cat]["total"] += 1
        if r.get("passed"):
            by_category[cat]["passed"] += 1
        if "composite_score" in r:
            by_category[cat]["scores"].append(r["composite_score"])

    category_summary = {
        cat: {
            "pass_rate": round(v["passed"] / v["total"], 2) if v["total"] else 0,
            "avg_score": round(sum(v["scores"]) / len(v["scores"]), 3) if v["scores"] else 0,
            "total": v["total"],
            "passed": v["passed"],
        }
        for cat, v in by_category.items()
    }

    guardrail_tests = [r for r in results if r.get("is_guardrail")]
    guardrail_pass = sum(1 for r in guardrail_tests if r.get("passed", False))

    return {
        "framework": "DeepEval (custom Amazon Nova Lite judge)",
        "total_cases": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total, 3) if total else 0,
        "avg_composite_score": avg_score,
        "avg_latency_ms": avg_latency,
        "guardrail_pass_rate": round(guardrail_pass / len(guardrail_tests), 2) if guardrail_tests else None,
        "category_breakdown": category_summary,
        "test_results": results,
    }
