"""FastAPI application server for Vulpine Engine."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from shared.config import settings
from shared.database import check_db_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info(f"Vulpine Engine starting in {settings.app_env} mode")

    # Verify database
    db_ok = await check_db_connection()
    if not db_ok:
        logger.error("Database unavailable — some services will fail")

    # Create upload dir
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    yield

    logger.info("Vulpine Engine shutting down")


app = FastAPI(
    title="Vulpine Autonomous Cabinet Revenue Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_allowed_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"engine": "Vulpine", "status": "operational", "version": "0.1.0"}


# Register API routes
from shared.routes import router as api_router
app.include_router(api_router)

# Register Auto Bid routes
from services.auto_bid.routes import router as auto_bid_router
app.include_router(auto_bid_router)


@app.get("/health")
async def health():
    db_ok = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
    }
