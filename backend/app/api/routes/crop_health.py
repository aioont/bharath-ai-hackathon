from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.models.schemas import CropHealthResponse
from app.services.sarvam_service import analyze_crop_disease, get_ai_response

router = APIRouter(prefix="/api/crop-health", tags=["Crop Health"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/analyze", response_model=CropHealthResponse)
async def analyze_crop(
    image: UploadFile = File(..., description="Crop image file"),
    language: str = Form(default="en"),
    crop_name: str = Form(default=""),
):
    """Analyze crop image for diseases using Sarvam Vision."""
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: JPG, PNG, WebP, HEIC"
        )
    
    image_bytes = await image.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 10MB")
    
    result = await analyze_crop_disease(
        image_bytes=image_bytes,
        language=language,
        crop_name=crop_name or None,
    )
    return CropHealthResponse(**result)


@router.get("/disease/{crop_name}/{disease_name}", response_model=CropHealthResponse)
async def get_disease_info(crop_name: str, disease_name: str, language: str = "en"):
    """Get detailed information about a specific crop disease."""
    message = f"Provide detailed information about {disease_name} in {crop_name} crops"
    ai_result = await get_ai_response(message=message, language=language, category="pest-control")
    
    # Return structured demo info
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
