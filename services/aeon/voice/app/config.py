"""Central configuration, loaded from environment variables / .env file.

No real credentials are stored here -- only the *names* of the variables.
See .env.example for a template.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'twilio_app.db'}")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
SECRET_KEY = os.getenv("SECRET_KEY", "")

# Public HTTPS URL where Twilio can reach this app, e.g. https://sms.example.com
# (no trailing slash). Required for inbound webhooks + signature validation.
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

PORT = int(os.getenv("PORT", "8080"))
