"""Helpers for talking to Twilio.

- get_client(account): builds a Twilio REST client, decrypting the stored
  auth token in memory only. The token is never logged or returned.
- webhook_url(path): absolute public URL for a webhook endpoint.
"""
import logging

from twilio.request_validator import RequestValidator
from twilio.rest import Client

from . import config
from .crypto import decrypt_token
from .models import Account

log = logging.getLogger("twilio-app.twilio")


def get_client(account: Account) -> Client:
    """Build a Twilio REST client for an account (decrypts token in memory)."""
    token = decrypt_token(account.encrypted_token)
    return Client(account.account_sid, token)


def webhook_url(path: str) -> str:
    """Absolute public URL for a webhook path, e.g. '/webhooks/sms'."""
    base = (config.PUBLIC_BASE_URL or "").rstrip("/")
    if not base:
        raise RuntimeError(
            "PUBLIC_BASE_URL is not configured -- inbound webhooks cannot work. "
            "Set it in your .env to the public HTTPS URL of this app."
        )
    return f"{base}{path}"


def validate_signature(full_url: str, params: dict, signature: str, auth_token: str) -> bool:
    """Validate Twilio's X-Twilio-Signature header for an incoming request."""
    if not signature:
        return False
    validator = RequestValidator(auth_token)
    return validator.validate(full_url, params or {}, signature)
