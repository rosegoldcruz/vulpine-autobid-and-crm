"""Browser softphone provisioning, token minting, and Twilio call history."""
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant

from .. import config, twilio_client
from ..auth import get_current_admin
from ..crypto import decrypt_token, encrypt_token
from ..db import get_db
from ..models import Account, PhoneNumberCache

log = logging.getLogger("twilio-app.voice")

router = APIRouter(
    prefix="/api/voice",
    tags=["voice"],
    dependencies=[Depends(get_current_admin)],
)

E164 = re.compile(r"^\+[1-9]\d{7,14}$")
DEFAULT_IDENTITY = "backoffice"


def _account(db: Session, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Account not found")
    return account


def _iso(value):
    return value.isoformat() if value else None


def _voice_numbers(db: Session, account_id: int) -> list[str]:
    return [
        row.phone_number
        for row in db.query(PhoneNumberCache).filter(
            PhoneNumberCache.account_id == account_id,
            PhoneNumberCache.voice_capable.is_(True),
        ).order_by(PhoneNumberCache.phone_number).all()
    ]


@router.get("/status")
def voice_status(account_id: int = Query(...), db: Session = Depends(get_db)):
    account = _account(db, account_id)
    return {
        "configured": bool(
            account.api_key_sid
            and account.encrypted_api_secret
            and account.twiml_app_sid
        ),
        "public_url_configured": bool(config.PUBLIC_BASE_URL),
        "identity": account.voice_identity or DEFAULT_IDENTITY,
        "caller_numbers": _voice_numbers(db, account.id),
    }


class ProvisionIn(BaseModel):
    account_id: int


@router.post("/provision")
def provision_voice(payload: ProvisionIn, db: Session = Depends(get_db)):
    """Create/update the account's TwiML App and create an API key if needed.

    The API-key secret is returned by Twilio exactly once and is encrypted
    immediately. It is never included in this endpoint's response.
    """
    account = _account(db, payload.account_id)
    if not config.PUBLIC_BASE_URL:
        raise HTTPException(400, "Set PUBLIC_BASE_URL before enabling browser calling")
    if not config.PUBLIC_BASE_URL.startswith("https://"):
        raise HTTPException(400, "Browser calling requires a public HTTPS URL")

    client = twilio_client.get_client(account)
    voice_url = twilio_client.webhook_url("/webhooks/browser-voice")
    created_application = None
    try:
        if account.twiml_app_sid:
            client.applications(account.twiml_app_sid).update(
                friendly_name="Vulpine Browser Phone",
                voice_url=voice_url,
                voice_method="POST",
            )
        else:
            created_application = client.applications.create(
                friendly_name="Vulpine Browser Phone",
                voice_url=voice_url,
                voice_method="POST",
            )
            account.twiml_app_sid = created_application.sid

        if not account.api_key_sid or not account.encrypted_api_secret:
            key = client.iam.v1.new_api_key.create(
                account_sid=account.account_sid,
                friendly_name="Vulpine Browser Phone",
            )
            account.api_key_sid = key.sid
            account.encrypted_api_secret = encrypt_token(key.secret)

        account.voice_identity = account.voice_identity or DEFAULT_IDENTITY
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        if created_application is not None:
            try:
                client.applications(created_application.sid).delete()
            except Exception:  # noqa: BLE001
                log.warning("Could not roll back TwiML App %s", created_application.sid)
        log.warning("Voice provisioning failed for account %s: %s", account.id, exc)
        raise HTTPException(502, f"Twilio voice setup failed: {str(exc)[:500]}") from exc

    return {
        "ok": True,
        "configured": True,
        "identity": account.voice_identity,
        "caller_numbers": _voice_numbers(db, account.id),
    }


class TokenIn(BaseModel):
    account_id: int


@router.post("/token")
def voice_token(payload: TokenIn, db: Session = Depends(get_db)):
    account = _account(db, payload.account_id)
    if not account.api_key_sid or not account.encrypted_api_secret or not account.twiml_app_sid:
        raise HTTPException(409, "Browser calling is not configured for this account")
    try:
        api_secret = decrypt_token(account.encrypted_api_secret)
        token = AccessToken(
            account.account_sid,
            account.api_key_sid,
            api_secret,
            identity=account.voice_identity or DEFAULT_IDENTITY,
            ttl=3600,
        )
        token.add_grant(VoiceGrant(
            outgoing_application_sid=account.twiml_app_sid,
            incoming_allow=True,
        ))
        jwt = token.to_jwt()
        if isinstance(jwt, bytes):
            jwt = jwt.decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        log.warning("Voice token generation failed for account %s: %s", account.id, exc)
        raise HTTPException(500, "Could not create browser voice token") from exc
    return {
        "token": jwt,
        "identity": account.voice_identity or DEFAULT_IDENTITY,
        "caller_numbers": _voice_numbers(db, account.id),
        "expires_in": 3600,
    }


@router.get("/calls")
def call_history(
    account_id: int = Query(...),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    account = _account(db, account_id)
    try:
        calls = twilio_client.get_client(account).calls.list(limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    return [
        {
            "sid": call.sid,
            "parent_call_sid": call.parent_call_sid,
            "from_number": call.from_,
            "to_number": call.to,
            "direction": call.direction,
            "status": call.status,
            "duration": call.duration,
            "start_time": _iso(call.start_time),
            "end_time": _iso(call.end_time),
            "price": call.price,
            "price_unit": call.price_unit,
            "answered_by": call.answered_by,
        }
        for call in calls
    ]
