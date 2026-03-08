"""
AWS client — minimal usage.
Only S3 is used (crop image uploads). Redis is handled by the redis-py library directly.
Bedrock and Translate have been replaced by Sarvam AI.
"""
import boto3
import json
import structlog
import threading
from datetime import datetime, timedelta
from typing import Optional
from functools import lru_cache
from app.core.config import settings

logger = structlog.get_logger()


@lru_cache(maxsize=1)
def get_s3_client():
    """Get Amazon S3 client for crop image storage (cached)."""
    try:
        client = boto3.client(
            "s3",
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        logger.info("S3 client initialised", bucket=settings.S3_BUCKET_NAME)
        return client
    except Exception as exc:
        logger.warning("s3_init_failed", error=str(exc))
        return None


def is_s3_configured() -> bool:
    """True when AWS credentials are set and S3 bucket name is configured."""
    return bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.S3_BUCKET_NAME
    )


# ---------------------------------------------------------------------------
# AWS Bedrock Client
# ---------------------------------------------------------------------------
class BedrockClient:
    def __init__(self):
        ak = settings.AWS_ACCESS_KEY_ID or None
        sk = settings.AWS_SECRET_ACCESS_KEY or None
        
        # Runtime for InvokeModel (Claude, etc.) — also used for guardrails (same region)
        self.runtime_client = boto3.client(
            service_name="bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
        )
        self.guardrail_client = self.runtime_client

        # Agent Runtime for Knowledge Bases (RetrieveAndGenerate)
        self.agent_runtime_client = boto3.client(
            service_name="bedrock-agent-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
        )
        # Circuit-breaker counter for apply_guardrail
        self._guardrail_failures: int = 0

    def invoke_nova(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.5, pro: bool = False) -> str:
        """
        Invoke Amazon Nova Lite or Pro via the Bedrock converse API.
        Uses inference profile IDs (apac.*) — required for on-demand throughput in ap-south-1.
        Nova Lite  — ultra-cheap, good for general tasks ($0.00006/$0.00024 per 1K tokens)
        Nova Pro   — stronger reasoning for insurance suggestions ($0.0008/$0.0032 per 1K tokens)
        Both support tool calling natively.
        """
        # Must use inference profile ID, not direct model ID (on-demand throughput restriction)
        profile_id = settings.BEDROCK_NOVA_PRO_PROFILE_ID if pro else settings.BEDROCK_NOVA_LITE_PROFILE_ID
        try:
            response = self.runtime_client.converse(
                modelId=profile_id,
                messages=[{"role": "user", "content": [{"text": prompt}]}],
                inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
            )
            return response["output"]["message"]["content"][0]["text"]
        except Exception as e:
            logger.error("bedrock_nova_error", model=profile_id, error=str(e))
            raise

    def invoke_haiku(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.5) -> str:
        """
        Invoke a Bedrock text model. Tries Claude 3 Haiku first; if unavailable in the
        current region (ap-south-1) automatically falls back to Amazon Nova Lite.
        """
        try:
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
                "temperature": temperature,
                "top_p": 0.9,
            })
            response = self.runtime_client.invoke_model(
                modelId=settings.BEDROCK_CLAUDE_MODEL_ID,
                body=body
            )
            response_body = json.loads(response.get("body").read())
            return response_body["content"][0]["text"]
        except Exception as e:
            error_msg = str(e)
            if "AccessDeniedException" in error_msg or "ResourceNotFoundException" in error_msg:
                logger.warning(
                    "bedrock_haiku_unavailable",
                    msg="Claude 3 Haiku not available in this region — falling back to Amazon Nova Lite.",
                    region=settings.AWS_REGION,
                )
                return self.invoke_nova(prompt, max_tokens=max_tokens, temperature=temperature)
            logger.error("bedrock_haiku_error", error=error_msg)
            raise

    def apply_guardrail(self, content: str, source: str = "INPUT") -> dict:
        """
        Apply Bedrock Guardrail to content.
        source: 'INPUT' (user query) or 'OUTPUT' (model response)
        Returns dict with 'action': 'GUARDRAIL_INTERVENED' | 'NONE'

        Circuit-breaker: after 3 consecutive failures the guardrail is
        bypassed for the rest of the process lifetime to stop log spam.
        """
        if not settings.BEDROCK_GUARDRAIL_ID:
            return {"action": "NONE"}

        # Circuit-breaker: skip if already tripped
        if self._guardrail_failures >= 3:
            return {"action": "NONE"}

        try:
            response = self.guardrail_client.apply_guardrail(
                guardrailIdentifier=settings.BEDROCK_GUARDRAIL_ID,
                guardrailVersion=settings.BEDROCK_GUARDRAIL_VERSION,
                source=source,
                content=[{"text": {"text": content}}]
            )
            self._guardrail_failures = 0   # reset on success
            return {
                "action": response["action"],
                "outputs": response["outputs"]
            }
        except Exception as e:
            self._guardrail_failures += 1
            if self._guardrail_failures == 1:
                logger.warning(
                    "bedrock_guardrail_error",
                    error=str(e),
                    region=settings.AWS_REGION,
                    guardrail_id=settings.BEDROCK_GUARDRAIL_ID,
                )
            elif self._guardrail_failures == 3:
                logger.warning(
                    "bedrock_guardrail_circuit_open",
                    msg="Guardrail failed 3 times — bypassing for this session. Restart after fixing BEDROCK_GUARDRAIL_ID."
                )
            # Fail open — never block real traffic
            return {"action": "NONE", "error": str(e)}

    def retrieve_and_generate(self, query: str, kb_id: str, max_results: int = 5):
        """
        RAG query against Bedrock KB using Amazon Nova Pro inference profile.
        Must use the inference profile ARN (apac.*) — direct model IDs are not supported.
        """
        # Use inference profile ARN — system-defined profiles use '::' (no account ID)
        model_arn = (
            f"arn:aws:bedrock:{settings.AWS_REGION}::inference-profile/"
            f"{settings.BEDROCK_NOVA_PRO_PROFILE_ID}"
        )
        return self.agent_runtime_client.retrieve_and_generate(
            input={"text": query},
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": kb_id,
                    "modelArn": model_arn,
                    "retrievalConfiguration": {
                        "vectorSearchConfiguration": {"numberOfResults": max_results}
                    },
                },
            },
        )

    def retrieve_only(self, query: str, kb_id: str, max_results: int = 5) -> list:
        """
        Retrieve chunks from Bedrock KB without generation (cheaper, faster).
        Returns list of text passages with source info.
        """
        response = self.agent_runtime_client.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": max_results}
            },
        )
        results = []
        for item in response.get("retrievalResults", []):
            content = item.get("content", {}).get("text", "")
            score = item.get("score", 0)
            source = item.get("location", {}).get("s3Location", {}).get("uri", "")
            if content:
                results.append({"text": content, "score": score, "source": source})
        return results


_bedrock_instance = None

def get_bedrock_client() -> BedrockClient:
    global _bedrock_instance
    if not _bedrock_instance:
        _bedrock_instance = BedrockClient()
    return _bedrock_instance


# ---------------------------------------------------------------------------
# Legacy shim — kept so existing imports don't break during migration
# ---------------------------------------------------------------------------
def is_aws_configured() -> bool:
    return is_s3_configured()


# ---------------------------------------------------------------------------
# Rekognition Custom Labels — Plant Disease Detection
# ---------------------------------------------------------------------------
class RekognitionClient:
    """
    Manages the Rekognition Custom Labels model lifecycle.
    Starts on demand in a background thread, auto-stops after IDLE_MINUTES of inactivity.
    """
    IDLE_MINUTES = 10

    def __init__(self):
        ak = settings.AWS_ACCESS_KEY_ID or None
        sk = settings.AWS_SECRET_ACCESS_KEY or None
        self.client = boto3.client(
            "rekognition",
            region_name=settings.AWS_REGION,
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
        )
        self._last_used: Optional[datetime] = None
        self._start_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    def get_status(self) -> str:
        """Query AWS for actual model status."""
        try:
            resp = self.client.describe_project_versions(
                ProjectArn=settings.REKOGNITION_PROJECT_ARN,
                VersionNames=[settings.REKOGNITION_MODEL_VERSION],
            )
            versions = resp.get("ProjectVersionDescriptions", [])
            if not versions:
                return "STOPPED"
            aws_status = versions[0].get("Status", "STOPPED")
            status_map = {
                "RUNNING": "RUNNING",
                "STARTING": "STARTING",
                "TRAINING_COMPLETED": "STOPPED",
                "STOPPING": "STOPPING",
                "STOPPED": "STOPPED",
                "FAILED": "FAILED",
                "TRAINING_FAILED": "FAILED",
                "DELETING": "STOPPING",
            }
            return status_map.get(aws_status, aws_status)
        except Exception as e:
            logger.warning("rekognition_status_error", error=str(e))
            return "UNKNOWN"

    def ensure_running(self) -> str:
        """If STOPPED, start model in background thread. Returns current status immediately."""
        with self._lock:
            status = self.get_status()
            if status == "RUNNING":
                if self._last_used is None:
                    self._last_used = datetime.utcnow()
                return "RUNNING"
            if status == "STARTING":
                return "STARTING"
            if status == "STOPPED":
                if self._start_thread is None or not self._start_thread.is_alive():
                    self._start_thread = threading.Thread(
                        target=self._start_blocking, daemon=True
                    )
                    self._start_thread.start()
                return "STARTING"
            return status

    def _start_blocking(self):
        """Blocking start — runs in a daemon thread."""
        try:
            logger.info("rekognition_model_starting", model_arn=settings.REKOGNITION_MODEL_ARN)
            self.client.start_project_version(
                ProjectVersionArn=settings.REKOGNITION_MODEL_ARN,
                MinInferenceUnits=1,
            )
            waiter = self.client.get_waiter("project_version_running")
            waiter.wait(
                ProjectArn=settings.REKOGNITION_PROJECT_ARN,
                VersionNames=[settings.REKOGNITION_MODEL_VERSION],
                WaiterConfig={"Delay": 30, "MaxAttempts": 20},
            )
            self._last_used = datetime.utcnow()
            logger.info("rekognition_model_running")
        except Exception as e:
            logger.error("rekognition_start_failed", error=str(e))

    def stop_model(self):
        """Stop the model to save costs."""
        try:
            logger.info("rekognition_model_stopping")
            self.client.stop_project_version(
                ProjectVersionArn=settings.REKOGNITION_MODEL_ARN
            )
        except Exception as e:
            logger.warning("rekognition_stop_error", error=str(e))

    def detect_disease(self, image_bytes: bytes, min_confidence: float = 50.0) -> list:
        """
        Run detect_custom_labels on raw image bytes.
        Updates last_used timestamp. Returns list of {name, confidence, bounding_box?} dicts.
        """
        self._last_used = datetime.utcnow()
        resp = self.client.detect_custom_labels(
            Image={"Bytes": image_bytes},
            MinConfidence=min_confidence,
            ProjectVersionArn=settings.REKOGNITION_MODEL_ARN,
        )
        results = []
        for lbl in resp.get("CustomLabels", []):
            entry = {
                "name": lbl["Name"].replace("___", " — ").replace("_", " "),
                "raw_name": lbl["Name"],
                "confidence": round(lbl["Confidence"] / 100, 3),
            }
            if "Geometry" in lbl:
                box = lbl["Geometry"]["BoundingBox"]
                entry["bounding_box"] = {
                    "left": round(box.get("Left", 0), 3),
                    "top": round(box.get("Top", 0), 3),
                    "width": round(box.get("Width", 0), 3),
                    "height": round(box.get("Height", 0), 3),
                }
            results.append(entry)
        results.sort(key=lambda x: -x["confidence"])
        return results

    def check_idle_stop(self):
        """Stop model after IDLE_MINUTES of no requests. Called by APScheduler."""
        if self._last_used is None:
            return
        try:
            status = self.get_status()
            if status != "RUNNING":
                return
            idle = datetime.utcnow() - self._last_used
            if idle > timedelta(minutes=self.IDLE_MINUTES):
                logger.info("rekognition_auto_stop_idle", idle_min=round(idle.total_seconds() / 60, 1))
                self.stop_model()
                self._last_used = None
        except Exception as e:
            logger.warning("rekognition_idle_check_error", error=str(e))


_rekognition_instance: Optional[RekognitionClient] = None


def get_rekognition_client() -> Optional[RekognitionClient]:
    """Returns None if AWS creds or Rekognition ARN not configured."""
    global _rekognition_instance
    if not (settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY
            and settings.REKOGNITION_MODEL_ARN):
        return None
    if _rekognition_instance is None:
        _rekognition_instance = RekognitionClient()
    return _rekognition_instance

