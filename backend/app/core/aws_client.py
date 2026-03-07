"""
AWS client — minimal usage.
Only S3 is used (crop image uploads). Redis is handled by the redis-py library directly.
Bedrock and Translate have been replaced by Sarvam AI.
"""
import boto3
import json
import structlog
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

    def invoke_haiku(self, prompt: str, max_tokens: int = 1000, temperature: float = 0.5) -> str:
        """Invoke Claude 3 Haiku model on Bedrock."""
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                }
            ],
            "temperature": temperature,
            "top_p": 0.9,
        })

        try:
            response = self.runtime_client.invoke_model(
                modelId=settings.BEDROCK_CLAUDE_MODEL_ID,
                body=body
            )
            response_body = json.loads(response.get("body").read())
            return response_body["content"][0]["text"]
        except Exception as e:
            error_msg = str(e)
            if "AccessDeniedException" in error_msg and "INVALID_PAYMENT_INSTRUMENT" in error_msg:
                logger.error(
                    "bedrock_payment_issue",
                    suggestion="AWS Billing Issue: Please add a valid credit card in AWS Console > Billing.",
                    details=error_msg
                )
            elif "AccessDeniedException" in error_msg:
                logger.error(
                    "bedrock_access_denied",
                    suggestion="Model Access Issue: Enable Claude 3 Haiku in AWS Console > Bedrock > Model access.",
                    details=error_msg
                )
            else:
                logger.error("bedrock_haiku_error", error=error_msg)
            raise e

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
        """Standard RAG query against Bedrock KB using Claude Haiku as the generation model."""
        # Use Claude 3 Haiku — Titan Text Express is not available in ap-south-1
        model_arn = (
            f"arn:aws:bedrock:{settings.AWS_REGION}::foundation-model/"
            f"{settings.BEDROCK_CLAUDE_MODEL_ID}"
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

