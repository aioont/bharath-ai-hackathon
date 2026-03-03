from fastapi import APIRouter, HTTPException, BackgroundTasks, Body, Query
from pydantic import BaseModel
from typing import Optional
import asyncio
import structlog

router = APIRouter(prefix="/api/eval", tags=["Evaluation"])
log = structlog.get_logger()

# Store last run result in memory (good enough for demo)
_last_result: dict = {}
_running: bool = False


class EvalRunRequest(BaseModel):
    categories: Optional[list[str]] = None   # None = all categories
    use_llm_judge: bool = True
    max_cases: int = 11


@router.post("/run")
async def run_evaluation(
    req: EvalRunRequest = Body(default=EvalRunRequest()),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Trigger a full evaluation run.
    Returns immediately with a 'started' status; poll /status for results.
    """
    global _running, _last_result
    if _running:
        return {"status": "already_running", "message": "Evaluation is already in progress."}

    async def _do_eval():
        global _running, _last_result
        _running = True
        try:
            from eval.eval_service import run_evaluation as _run_eval
            _last_result = await _run_eval(
                categories=req.categories,
                use_llm_judge=req.use_llm_judge,
                max_cases=req.max_cases,
            )
            _last_result["status"] = "completed"
        except Exception as exc:
            log.error("eval_run_failed", error=str(exc))
            _last_result = {"status": "error", "error": str(exc)}
        finally:
            _running = False

    background_tasks.add_task(_do_eval)
    return {"status": "started", "message": f"Running {req.max_cases} test cases in background. Poll /api/eval/status."}


@router.get("/status")
async def eval_status():
    """Return the status and results of the last evaluation run."""
    if _running:
        return {"status": "running", "message": "Evaluation in progress…"}
    if not _last_result:
        return {"status": "idle", "message": "No evaluation run yet. POST /api/eval/run to start."}
    return _last_result


@router.get("/test-cases")
async def list_test_cases():
    """Return all available test cases from the YAML dataset."""
    try:
        from eval.eval_service import load_test_cases
        cases = load_test_cases()
        return {"test_cases": cases, "total": len(cases)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run-single")
async def run_single_case(case_id: str = Query(..., description="Test case ID e.g. tc_01")):
    """Run a single test case by ID and return the result immediately."""
    try:
        from eval.eval_service import load_test_cases, _run_one, SarvamJudgeLLM
        cases = load_test_cases()
        tc = next((c for c in cases if c["id"] == case_id), None)
        if not tc:
            raise HTTPException(status_code=404, detail=f"Test case '{case_id}' not found.")
        judge = SarvamJudgeLLM()
        result = await _run_one(tc, judge, use_llm_judge=True)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
