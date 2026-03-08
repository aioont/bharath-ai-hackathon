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
from app.api.routes import plan, market_analyzer, mock_iot, evaluation, insurance, admin, alerts, reminders

# ---------------------------------------------------------------------------
# Logging — configure stdlib logging so every logger in every route works
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# Also quieten noisy third-party libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("psycopg2").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("primp").setLevel(logging.WARNING)
logging.getLogger("primp.connect").setLevel(logging.WARNING)
logging.getLogger("hyper_util").setLevel(logging.WARNING)
logging.getLogger("hyper_util.client.legacy.connect").setLevel(logging.WARNING)
logging.getLogger("hyper_util.client.legacy.connect.http").setLevel(logging.WARNING)
logging.getLogger("cookie_store").setLevel(logging.WARNING)

# ---------------------------------------------------------------------------
# Structlog — bind to stdlib logging so structlog events respect the same
# INFO/DEBUG level set above.  Without this, structlog uses its own defaults.
# ---------------------------------------------------------------------------
import structlog
_log_level = logging.INFO if settings.DEBUG else logging.INFO
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(_log_level),
    processors=[
        structlog.stdlib.add_log_level,
        # add_logger_name requires a stdlib LoggerFactory (.name attribute);
        # PrintLogger has no .name — removed to avoid AttributeError.
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
        structlog.dev.ConsoleRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=== AgriSaarthi starting (v%s) ===", settings.APP_VERSION)

    # ── Autonomous Alert Agent (APScheduler) ─────────────────────────────────
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from app.services.alert_service import run_weather_alert_scan, run_price_alert_scan

        scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
        # Weather scan every 6 hours
        scheduler.add_job(
            run_weather_alert_scan,
            trigger="interval",
            hours=6,
            id="weather_alert_scan",
            max_instances=1,
            misfire_grace_time=300,
        )
        # Price scan every 2 hours
        scheduler.add_job(
            run_price_alert_scan,
            trigger="interval",
            hours=2,
            id="price_alert_scan",
            max_instances=1,
            misfire_grace_time=300,
        )
        # ── Reminder dispatch every minute ───────────────────────────────
        from app.services.reminder_service import dispatch_due_reminders, check_market_price_alerts

        scheduler.add_job(
            dispatch_due_reminders,
            trigger="interval",
            minutes=1,
            id="reminder_dispatch",
            max_instances=1,
            misfire_grace_time=30,
        )
        # Market-price reminder check every 2 hours (alongside price scan)
        scheduler.add_job(
            check_market_price_alerts,
            trigger="interval",
            hours=2,
            id="market_price_alert_check",
            max_instances=1,
            misfire_grace_time=300,
        )
        # ── Rekognition idle-stop every 5 minutes ────────────────────────────────
        async def _rekognition_idle_check():
            from app.core.aws_client import get_rekognition_client
            client = get_rekognition_client()
            if client:
                client.check_idle_stop()

        scheduler.add_job(
            _rekognition_idle_check,
            trigger="interval",
            minutes=5,
            id="rekognition_idle_check",
            max_instances=1,
            misfire_grace_time=60,
        )
        scheduler.start()
        log.info("alert_scheduler_started jobs=weather(6h),price(2h),reminders(1m),market_alerts(2h)")
    except ImportError:
        log.warning("apscheduler not installed — alert scheduler disabled. "
                    "Run: pip install apscheduler")
        scheduler = None
    except Exception as exc:
        log.error("alert_scheduler_start_failed: %s", exc)
        scheduler = None

    yield

    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("alert_scheduler_stopped")
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
app.include_router(alerts.router) # Autonomous alert preferences & triggers
app.include_router(reminders.router)  # Agent-driven reminder scheduling


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
