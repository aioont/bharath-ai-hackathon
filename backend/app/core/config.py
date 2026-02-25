from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Agri-Translate AI"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Sarvam AI (primary AI + translation)
    SARVAM_API_KEY: str = ""
    SARVAM_CHAT_MODEL: str = "sarvam-m"
    SARVAM_TRANSLATE_MODEL: str = "sarvam-translate:v1"
    # Note: Sarvam Vision is OCR-only; crop analysis uses AWS Rekognition + Sarvam-M

    # AWS — minimal (S3 images + ElastiCache)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql://postgres:7MGCdVgJjwRruuXT@db.omsukgvwlzmyprszgkuj.supabase.co:5432/postgres"
    DATABASE_POOL_URL: str = "postgresql://postgres.omsukgvwlzmyprszgkuj:7MGCdVgJjwRruuXT@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # S3
    S3_BUCKET_NAME: str = "agri-translate-images"
    S3_REGION: str = "ap-south-1"

    # Weather
    WEATHER_API_BASE: str = "https://api.open-meteo.com/v1"

    # eNAM Market
    ENAM_API_KEY: str = ""
    ENAM_API_BASE: str = "https://api.enam.gov.in/web/api/trade-data"

    # Security
    SECRET_KEY: str = "change-this-in-production-please"
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:3001","http://localhost:5173","http://localhost:4173","http://127.0.0.1:3000","http://127.0.0.1:3001","http://127.0.0.1:5173"]'

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:5173",
            ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # allow unknown env vars without crashing


settings = Settings()
