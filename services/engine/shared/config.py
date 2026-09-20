"""Vulpine Engine configuration. All settings loaded from environment variables."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # ── Database ───────────────────────────────────────────
    database_url: str
    redis_url: str

    # ── GoHighLevel ────────────────────────────────────────
    ghl_access_token: str = ""
    ghl_private_integration_key: str = ""
    ghl_location_id: str = ""
    ghl_api_base: str = "https://services.leadconnectorhq.com"

    # ── ZoomInfo ───────────────────────────────────────────
    zoom_info_client_id: str = ""
    zoom_info_private_key: str = ""

    # ── AI ─────────────────────────────────────────────────
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""
    mistral_api_key: str = ""
    xai_api_key: str = ""
    elevenlabs_api_key: str = ""

    # Default AI model selections
    reasoning_model: str = "claude-sonnet-4-20250514"      # Claude for scoring, classification
    writing_model: str = "claude-sonnet-4-20250514"        # Claude for email generation
    cheap_model: str = "gpt-4o-mini"                        # GPT-4o-mini for simple tasks
    embedding_model: str = "text-embedding-3-small"         # OpenAI embeddings

    # ── Vapi (Voice AI) ────────────────────────────────────
    vapi_api_key: str = ""
    vapi_private_api_key: str = ""
    vapi_phone_number_id: str = ""
    vapi_webhook_secret: str = ""

    # ── Twilio ─────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # ── Application ────────────────────────────────────────
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    upload_dir: Path = PROJECT_ROOT / "uploads"
    default_timezone: str = "America/Phoenix"
    cors_allowed_origins: str = ""

    # ── Scoring Thresholds ─────────────────────────────────
    score_bid_now: int = 90
    score_high_priority: int = 70
    score_develop: int = 50
    score_monitor: int = 30

    # ── Pricing Guardrails ─────────────────────────────────
    min_gross_margin_percent: float = 18.0
    min_commissionable_profit: float = 500.0
    default_contingency_percent: float = 3.0

    class Config:
        env_file = PROJECT_ROOT / ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Silently ignore env vars not in the model


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
