"""FastAPI application entrypoint.

Routes:
  /api/auth/*        admin login / session
  /api/accounts      Twilio account CRUD + connection test
  /api/numbers       number list / buy / release / apply webhooks
  /api/settings      global + per-number settings
  /api/campaigns     bulk SMS/MMS campaigns
  /api/messages      inbound SMS inbox
  /api/voicemails    voicemail inbox (+ audio proxy)
  /api/recordings    call recordings browser (+ audio proxy)
  /webhooks/*        public Twilio webhooks (signature-validated, no login)
  /                  the single-page web UI (static/)
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, db
from .auth import COOKIE_NAME, check_password, clear_session, create_session, session_is_valid
from .models import Campaign
from .routers import accounts, campaigns, messages, numbers, recordings, settings, voice, voicemails
from . import webhooks

log = logging.getLogger("twilio-app")


def _initialize_app() -> None:
    db.init_db()
    # Campaigns left "running" by a previous process can never finish --
    # mark them interrupted so they can be relaunched cleanly.
    session = db.SessionLocal()
    try:
        stale = session.query(Campaign).filter(Campaign.status == "running").all()
        for campaign in stale:
            campaign.status = "interrupted"
        if stale:
            log.warning("Marked %d stale campaign(s) as interrupted", len(stale))
        session.commit()
    finally:
        session.close()

    if not config.ADMIN_PASSWORD:
        log.warning("ADMIN_PASSWORD is not set -- admin login is DISABLED until it is set.")
    if not config.PUBLIC_BASE_URL:
        log.warning("PUBLIC_BASE_URL is not set -- inbound webhooks will not work.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _initialize_app()
    yield


app = FastAPI(title="Twilio SMS/Voice App", version="1.0.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Auth endpoints (mounted before the protected routers)
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    password: str


@app.post("/api/auth/login")
def login(payload: LoginIn):
    if not check_password(payload.password):
        return JSONResponse({"ok": False, "error": "Invalid password"}, status_code=401)
    resp = JSONResponse({"ok": True})
    create_session(resp)
    return resp


@app.post("/api/auth/logout")
def logout():
    resp = JSONResponse({"ok": True})
    clear_session(resp)
    return resp


@app.get("/api/auth/me")
def me(tw_session: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    # Session discovery is deliberately a 200 response so a normal signed-out
    # page load does not pollute the browser console with a failed request.
    return {"ok": session_is_valid(tw_session)}


# ---------------------------------------------------------------------------
# Protected API routers + public webhooks
# ---------------------------------------------------------------------------
app.include_router(accounts.router)
app.include_router(numbers.router)
app.include_router(settings.router)
app.include_router(campaigns.router)
app.include_router(messages.router)
app.include_router(voicemails.router)
app.include_router(recordings.router)
app.include_router(voice.router)
app.include_router(webhooks.router)


# ---------------------------------------------------------------------------
# Single-page UI (must be mounted LAST so /api/* and /webhooks/* win)
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


@app.middleware("http")
async def no_token_logging(request: Request, call_next):
    # Defense in depth: never log Authorization headers or raw webhook bodies
    # (which can contain message content). Only method + path are logged.
    log.debug("%s %s", request.method, request.url.path)
    return await call_next(request)
