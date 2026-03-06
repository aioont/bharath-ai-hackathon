from __future__ import annotations
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.routes import translate, chat, crop_health, weather, market, forum, news, auth, crops
from app.api.routes import plan, market_analyzer, mock_iot, evaluation, insurance, admin

# ---------------------------------------------------------------------------
# Logging — configure stdlib logging so every logger in every route works
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# Also quieten noisy third-party libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("psycopg2").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=== AgriSaarthi starting (v%s) ===", settings.APP_VERSION)
    yield
    log.info("=== AgriSaarthi shutting down ===")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AgriSaarthi",
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
# Request logging middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    level = logging.WARNING if response.status_code >= 400 else logging.INFO
    log.log(
        level,
        "%-6s %-50s  %s  %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

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
app.include_router(news.router)
app.include_router(auth.router)
app.include_router(crops.router)
app.include_router(plan.router)
app.include_router(market_analyzer.router)
app.include_router(mock_iot.router)
app.include_router(evaluation.router)
app.include_router(insurance.router)
app.include_router(admin.router)  # Cache statistics & management


# ---------------------------------------------------------------------------
# Root / Health
# ---------------------------------------------------------------------------
@app.get("/", tags=["Meta"])
async def root():
    return {
        "app": "AgriSaarthi",
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
async def unhandled_exception(request: Request, exc: Exception):
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
