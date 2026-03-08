import asyncio
import structlog
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.schemas import CropHealthResponse
from app.services.sarvam_service import analyze_crop_disease, get_ai_response

router = APIRouter(prefix="/api/crop-health", tags=["Crop Health"])
logger = structlog.get_logger()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp", "heic", "heif"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/model-status")
async def get_model_status():
    """Return Rekognition custom label model status and whether it can analyze images."""
    from app.core.aws_client import get_rekognition_client
    client = get_rekognition_client()
    if client is None:
        return {
            "status": "UNAVAILABLE",
            "can_analyze": False,
            "message": "AWS not configured — using AI text analysis fallback",
        }
    status = client.get_status()
    messages = {
        "RUNNING":   "🟢 Custom disease model ready",
        "STARTING":  "🟡 Model warming up — takes 2-3 min (AI fallback active)",
        "STOPPED":   "⚫ Model offline — click Start or submit an image to auto-start",
        "STOPPING":  "🟠 Model shutting down",
        "FAILED":    "🔴 Model failed to start",
        "UNKNOWN":   "⚪ Checking model status…",
    }
    return {
        "status": status,
        "can_analyze": status == "RUNNING",
        "message": messages.get(status, status),
    }


@router.post("/start-model")
async def start_model():
    """Trigger model start (non-blocking). Poll /model-status every 10s for updates."""
    from app.core.aws_client import get_rekognition_client
    client = get_rekognition_client()
    if client is None:
        raise HTTPException(503, "AWS credentials not configured")
    status = client.ensure_running()
    return {
        "status": status,
        "message": "Model starting in background" if status == "STARTING" else f"Model is {status}",
    }


@router.post("/analyze", response_model=CropHealthResponse)
async def analyze_crop(
    image: UploadFile = File(..., description="Crop image file"),
    language: str = Form(default="en"),
    crop_name: str = Form(default=""),
):
    """Analyze crop image using Rekognition Custom Labels + Nova AI diagnosis."""
    # Validate type by content-type or file extension
    ct = (image.content_type or "").lower()
    ext = ((image.filename or "").rsplit(".", 1)[-1]).lower()
    if ct and ct not in ALLOWED_TYPES and ext not in ALLOWED_EXTS:
        raise HTTPException(400, "Invalid file type. Allowed: JPG, PNG, WebP, HEIC")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(400, "Image too large. Maximum 10MB allowed")
    if len(image_bytes) < 1024:
        raise HTTPException(400, "Image appears empty or corrupted")

    # Try Rekognition Custom Labels if model is RUNNING
    from app.core.aws_client import get_rekognition_client
    rek = get_rekognition_client()
    custom_labels = None

    if rek:
        status = rek.get_status()
        if status == "STOPPED":
            rek.ensure_running()  # kick off background start; fall through to AI fallback
        elif status == "RUNNING":
            try:
                custom_labels = await asyncio.to_thread(
                    rek.detect_disease, image_bytes, 50.0
                )
                logger.info(
                    "rekognition_custom_labels",
                    labels=[l["name"] for l in custom_labels],
                    count=len(custom_labels),
                )
            except Exception as exc:
                logger.warning("rekognition_detect_failed", error=str(exc))

    result = await analyze_crop_disease(
        image_bytes=image_bytes,
        language=language,
        crop_name=crop_name or None,
        custom_labels=custom_labels,
    )
    return CropHealthResponse(**result)


@router.get("/disease/{crop_name}/{disease_name}", response_model=CropHealthResponse)
async def get_disease_info(crop_name: str, disease_name: str, language: str = "en"):
    """Get detailed information about a specific crop disease."""
    message = f"Provide detailed information about {disease_name} in {crop_name} crops"
    ai_result = await get_ai_response(message=message, language=language, category="pest-control")
    return CropHealthResponse(
        disease_name=f"{disease_name} in {crop_name}",
        confidence=0.9,
        severity="medium",
        description=ai_result["response"][:300],
        symptoms=["Yellowing of leaves", "Brown spots", "Wilting"],
        treatment=["Apply appropriate fungicide/pesticide", "Remove infected parts", "Improve drainage"],
        prevention=["Use resistant varieties", "Proper spacing", "Crop rotation"],
        affected_crops=[crop_name],
    )
