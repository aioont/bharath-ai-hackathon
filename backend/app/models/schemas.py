from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ─── Translation ──────────────────────────────────────────────────────────────
class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to translate")
    source_language: str = Field(..., description="Source language code (e.g., 'en', 'hi')")
    target_language: str = Field(..., description="Target language code")
    domain: Literal["agriculture", "general", "market", "weather"] = "agriculture"


class TranslationResponse(BaseModel):
    translated_text: str
    source_language: str
    target_language: str
    confidence: float = Field(ge=0.0, le=1.0)
    domain: str


class BatchTranslationRequest(BaseModel):
    translations: List[TranslationRequest]


class BatchTranslationResponse(BaseModel):
    results: List[TranslationResponse]


# ─── Chat ─────────────────────────────────────────────────────────────────────
class ChatMessageModel(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: Optional[str] = None


class FarmerCropDetail(BaseModel):
    """A single crop entry from the farmer's crop list."""
    crop_name: str
    area_acres: Optional[float] = None
    soil_type: Optional[str] = None
    season: Optional[str] = None
    irrigation: Optional[str] = None
    variety: Optional[str] = None
    notes: Optional[str] = None
    is_primary: bool = False


class FarmerProfile(BaseModel):
    # Basic farmer info
    state: Optional[str] = None
    district: Optional[str] = None
    farming_type: Optional[str] = None
    # Legacy single-crop fields (kept for backwards compat)
    crop: Optional[str] = None
    soil_type: Optional[str] = None
    season: Optional[str] = None
    # Full multi-crop list (new)
    crops: Optional[List[FarmerCropDetail]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    language: str = "en"
    conversation_history: Optional[List[ChatMessageModel]] = []
    conversation_uuid: Optional[str] = None  # For retrieving/continuing conversations
    category: Optional[str] = None
    farmer_profile: Optional[FarmerProfile] = None
    tts_enabled: bool = False  # If True, backend generates TTS audio and returns base64


class ChatResponse(BaseModel):
    response: str
    language: str
    suggestions: Optional[List[str]] = []
    related_topics: Optional[List[str]] = []
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    audio_base64: Optional[str] = None   # base64-encoded WAV from Sarvam TTS
    audio_format: str = "wav"


# ─── Crop Health ──────────────────────────────────────────────────────────────
class CropHealthResponse(BaseModel):
    disease_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    severity: Literal["low", "medium", "high"]
    description: str
    symptoms: List[str]
    treatment: List[str]
    prevention: List[str]
    affected_crops: List[str]
    image_url: Optional[str] = None
    raw_labels: Optional[List[dict]] = None   # Rekognition Custom Labels detections
    model_source: Optional[str] = None        # 'rekognition_custom' | 'rekognition_general' | 'fallback'


# ─── Weather ──────────────────────────────────────────────────────────────────
class TemperatureModel(BaseModel):
    min: float
    max: float
    current: float


class WeatherAlert(BaseModel):
    type: str
    message: str
    severity: Literal["low", "medium", "high"]


class WeatherData(BaseModel):
    location: str
    date: str
    temperature: TemperatureModel
    humidity: float
    rainfall: float
    wind_speed: float
    condition: str
    farming_advice: str
    alerts: List[WeatherAlert] = []


class WeatherForecast(BaseModel):
    location: str
    current: WeatherData
    forecast: List[WeatherData]
    agricultural_insights: List[str]


# ─── Market ───────────────────────────────────────────────────────────────────
class MarketPrice(BaseModel):
    commodity: str
    variety: str
    market: str
    state: str
    min_price: float
    max_price: float
    modal_price: float
    unit: str
    date: str
    trend: Literal["up", "down", "stable"]
    trend_percentage: float


class MarketResponse(BaseModel):
    prices: List[MarketPrice]
    last_updated: str
    total_count: int


class MarketTrend(BaseModel):
    dates: List[str]
    prices: List[float]
    commodity: str


# ─── Forum ────────────────────────────────────────────────────────────────────
class ForumAnswer(BaseModel):
    id: str
    content: str
    author: str
    upvotes: int = 0
    created_at: str
    is_accepted: bool = False


class ForumPost(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1, max_length=10000)
    author: str = "Anonymous"
    language: str = "en"
    category: str = ""
    tags: List[str] = []
    upvotes: int = 0
    answers_count: int = 0
    created_at: Optional[str] = None
    is_resolved: bool = False
    image_url: Optional[str] = None


class ForumListResponse(BaseModel):
    posts: List[ForumPost]
    total: int
    page: int
    per_page: int


class ForumPostDetail(ForumPost):
    answers: List[ForumAnswer] = []


class VoteResponse(BaseModel):
    upvotes: int


# ─── Health Check ─────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    aws_connected: bool
    bedrock_available: bool
    services: dict
