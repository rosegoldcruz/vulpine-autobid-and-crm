"""Phone number management.

- List incoming numbers for an account (live from Twilio, merged with the
  local cache that holds is_default_sender / webhook_applied flags).
- Search available numbers by area code, buy, and release numbers.
- One-click "apply webhooks": points the number's VoiceUrl/SmsUrl at this
  app's public webhook endpoints so forwarding/voicemail/auto-reply work.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import twilio_client
from ..auth import get_current_admin
from ..db import get_db
from ..models import Account, PhoneNumberCache

log = logging.getLogger("twilio-app.numbers")

router = APIRouter(
    prefix="/api/numbers",
    tags=["numbers"],
    dependencies=[Depends(get_current_admin)],
)


def _get_account(db: Session, account_id: int) -> Account:
    acct = db.get(Account, account_id)
    if acct is None:
        raise HTTPException(404, "Account not found")
    return acct


def _sync_cache(db: Session, account: Account) -> list[dict]:
    """Pull the live number list from Twilio and upsert the local cache."""
    client = twilio_client.get_client(account)
    try:
        live = client.incoming_phone_numbers.list()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc

    seen_sids = set()
    for num in live:
        seen_sids.add(num.sid)
        caps = num.capabilities or {}
        cache = db.query(PhoneNumberCache).filter(
            PhoneNumberCache.account_id == account.id,
            PhoneNumberCache.number_sid == num.sid,
        ).first()
        if cache is None:
            cache = PhoneNumberCache(
                account_id=account.id,
                number_sid=num.sid,
                phone_number=num.phone_number,
            )
            db.add(cache)
        cache.phone_number = num.phone_number
        cache.sms_capable = bool(caps.get("sms"))
        cache.voice_capable = bool(caps.get("voice"))
        cache.synced_at = datetime.now(timezone.utc)
    # Drop cache rows for numbers no longer on the account
    stale_q = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id,
    )
    if seen_sids:
        stale_q = stale_q.filter(~PhoneNumberCache.number_sid.in_(seen_sids))
    stale_q.delete(synchronize_session=False)
    db.commit()

    rows = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id
    ).order_by(PhoneNumberCache.phone_number).all()
    return [
        {
            "id": r.id,
            "number_sid": r.number_sid,
            "phone_number": r.phone_number,
            "sms_capable": r.sms_capable,
            "voice_capable": r.voice_capable,
            "is_default_sender": r.is_default_sender,
            "webhook_applied": r.webhook_applied,
        }
        for r in rows
    ]


@router.get("")
def list_numbers(account_id: int = Query(...), db: Session = Depends(get_db)):
    account = _get_account(db, account_id)
    return _sync_cache(db, account)


class DefaultSenderIn(BaseModel):
    account_id: int
    phone_number: str = Field(min_length=5, max_length=32)


@router.post("/default")
def set_default_sender(payload: DefaultSenderIn, db: Session = Depends(get_db)):
    _get_account(db, payload.account_id)
    updated = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == payload.account_id,
        PhoneNumberCache.phone_number == payload.phone_number.strip(),
    ).first()
    if updated is None:
        raise HTTPException(404, "Number not found on this account")
    db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == payload.account_id
    ).update({"is_default_sender": False})
    updated.is_default_sender = True
    db.commit()
    return {"ok": True}


@router.get("/available")
def available_numbers(
    account_id: int = Query(...),
    area_code: str = Query(..., min_length=3, max_length=3),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    account = _get_account(db, account_id)
    client = twilio_client.get_client(account)
    try:
        results = client.available_phone_numbers("US").local.list(
            area_code=area_code, limit=limit
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    return [
        {"phone_number": r.phone_number, "friendly_name": r.friendly_name}
        for r in results
    ]


class BuyIn(BaseModel):
    account_id: int
    phone_number: str = Field(min_length=5, max_length=32)


@router.post("/buy")
def buy_number(payload: BuyIn, db: Session = Depends(get_db)):
    """Purchase a number and immediately point its webhooks at this app."""
    account = _get_account(db, payload.account_id)
    client = twilio_client.get_client(account)
    try:
        num = client.incoming_phone_numbers.create(
            phone_number=payload.phone_number.strip(),
            sms_url=twilio_client.webhook_url("/webhooks/sms"),
            sms_method="POST",
            voice_url=twilio_client.webhook_url("/webhooks/voice"),
            voice_method="POST",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    cache = PhoneNumberCache(
        account_id=account.id,
        number_sid=num.sid,
        phone_number=num.phone_number,
        sms_capable=True,
        voice_capable=True,
        webhook_applied=True,
        synced_at=datetime.now(timezone.utc),
    )
    db.add(cache)
    db.commit()
    log.info("Purchased number %s on account %s", num.phone_number, account.id)
    return {"ok": True, "phone_number": num.phone_number, "sid": num.sid}


class ReleaseIn(BaseModel):
    account_id: int


@router.post("/{number_sid}/release")
def release_number(number_sid: str, payload: ReleaseIn, db: Session = Depends(get_db)):
    account = _get_account(db, payload.account_id)
    client = twilio_client.get_client(account)
    try:
        client.incoming_phone_numbers(number_sid).delete()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id,
        PhoneNumberCache.number_sid == number_sid,
    ).delete()
    db.commit()
    log.info("Released number %s on account %s", number_sid, account.id)
    return {"ok": True}


class ApplyWebhooksIn(BaseModel):
    account_id: int
    phone_number: str = Field(min_length=5, max_length=32)


@router.post("/apply-webhooks")
def apply_webhooks(payload: ApplyWebhooksIn, db: Session = Depends(get_db)):
    """One click: set this number's VoiceUrl/SmsUrl to this app's webhooks."""
    account = _get_account(db, payload.account_id)
    cache = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id,
        PhoneNumberCache.phone_number == payload.phone_number.strip(),
    ).first()
    if cache is None:
        raise HTTPException(404, "Number not found on this account")
    client = twilio_client.get_client(account)
    try:
        client.incoming_phone_numbers(cache.number_sid).update(
            sms_url=twilio_client.webhook_url("/webhooks/sms"),
            sms_method="POST",
            voice_url=twilio_client.webhook_url("/webhooks/voice"),
            voice_method="POST",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    cache.webhook_applied = True
    db.commit()
    return {"ok": True}
