"""Simple single-admin auth: ADMIN_PASSWORD from env + signed session cookie.

All /api/* routes except /api/auth/login, /api/auth/me and /webhooks/*
require a valid session. Session cookie is HttpOnly + SameSite=Lax.
"""
import logging
import secrets

import itsdangerous
from fastapi import Cookie, Depends, HTTPException, Request, Response, status

from . import config

log = logging.getLogger("twilio-app.auth")

COOKIE_NAME = "tw_session"

_serializer: itsdangerous.URLSafeSerializer | None = None


def _get_serializer() -> itsdangerous.URLSafeSerializer:
    global _serializer
    if _serializer is None:
        secret = (config.SECRET_KEY or "").strip()
        if not secret:
            secret = secrets.token_hex(32)
            log.warning(
                "SECRET_KEY is not set -- generated an ephemeral one. "
                "Admin sessions will be invalidated on restart."
            )
        _serializer = itsdangerous.URLSafeSerializer(secret, salt="twilio-app-admin")
    return _serializer


def create_session(response: Response) -> None:
    token = _get_serializer().dumps({"admin": True})
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=(config.PUBLIC_BASE_URL or "").startswith("https://"),
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _session_valid(token: str | None) -> bool:
    if not token:
        return False
    try:
        data = _get_serializer().loads(token)
        return bool(data.get("admin"))
    except itsdangerous.BadSignature:
        return False


def session_is_valid(token: str | None) -> bool:
    """Return session state for the non-erroring UI bootstrap endpoint."""
    return _session_valid(token)


def get_current_admin(
    request: Request,
    tw_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> bool:
    """FastAPI dependency -- raises 401 unless the admin session is valid."""
    if _session_valid(tw_session):
        return True
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


def check_password(password: str) -> bool:
    """Constant-time comparison against ADMIN_PASSWORD."""
    expected = config.ADMIN_PASSWORD or ""
    if not expected:
        return False
    return secrets.compare_digest(password or "", expected)
