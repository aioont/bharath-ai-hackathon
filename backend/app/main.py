from __future__ import annotations
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.routes import translate, chat, crop_health, weather, market, forum

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)
log = structlog.get_logger(__name__)
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup", app="agri-translate-ai", version=settings.APP_VERSION)
    yield
    log.info("shutdown")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Agri-Translate AI",
    description=(
        "Multilingual AI platform for Indian farmers — "
        "powered by Amazon Bedrock, Amazon Translate, and Open-Meteo."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(translate.router)
app.include_router(chat.router)
app.include_router(crop_health.router)
app.include_router(weather.router)
app.include_router(market.router)
app.include_router(forum.router)


# ---------------------------------------------------------------------------
# Root / Health
# ---------------------------------------------------------------------------
@app.get("/", tags=["Meta"])
async def root():
    return {
        "app": "Agri-Translate AI",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Meta"])
async def health():
    from app.core.aws_client import is_s3_configured
    return {
        "status": "healthy",
        "sarvam_configured": bool(settings.SARVAM_API_KEY),
        "aws_s3_configured": is_s3_configured(),
        "version": settings.APP_VERSION,
    }


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception(request, exc):
    log.error("unhandled_exception", error=str(exc), path=str(request.url))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
