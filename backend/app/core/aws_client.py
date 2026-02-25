"""
AWS client — minimal usage.
Only S3 is used (crop image uploads). Redis is handled by the redis-py library directly.
Bedrock and Translate have been replaced by Sarvam AI.
"""
import boto3
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
# Legacy shim — kept so existing imports don't break during migration
# ---------------------------------------------------------------------------
def is_aws_configured() -> bool:
    return is_s3_configured()

