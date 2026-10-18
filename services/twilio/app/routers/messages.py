"""Twilio message history plus one-to-one SMS/MMS sending."""
import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import twilio_client
from ..auth import get_current_admin
from ..db import get_db
from ..models import Account, InboundMessage, PhoneNumberCache

router = APIRouter(
    prefix="/api/messages",
    tags=["messages"],
    dependencies=[Depends(get_current_admin)],
)


E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def _account(db: Session, account_id: int) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Account not found")
    return account


def _iso(value):
    return value.isoformat() if value else None


@router.get("")
def list_messages(
    account_id: int | None = Query(default=None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    # No account id preserves the original local inbound-inbox API. The main
    # UI supplies an account id and receives authoritative Twilio history,
    # including both inbound and outbound messages.
    if account_id is not None:
        account = _account(db, account_id)
        try:
            rows = twilio_client.get_client(account).messages.list(limit=limit)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"Twilio API error: {exc}") from exc
        return [
            {
                "sid": message.sid,
                "from_number": message.from_,
                "to_number": message.to,
                "body": message.body or "",
                "direction": message.direction,
                "status": message.status,
                "date": _iso(message.date_sent or message.date_created),
                "error_code": message.error_code,
                "error_message": message.error_message,
                "num_media": int(message.num_media or 0),
                "price": message.price,
                "price_unit": message.price_unit,
            }
            for message in rows
        ]

    rows = (
        db.query(InboundMessage)
        .order_by(InboundMessage.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": m.id,
            "from_number": m.from_number,
            "to_number": m.to_number,
            "body": m.body,
            "replied": m.replied,
            "received_at": m.received_at.isoformat() if m.received_at else None,
        }
        for m in rows
    ]


class SendMessageIn(BaseModel):
    account_id: int
    from_number: str = Field(min_length=8, max_length=32)
    to_number: str = Field(min_length=8, max_length=32)
    body: str = Field(default="", max_length=1600)
    media_urls: list[str] = Field(default_factory=list, max_length=10)


@router.post("/send")
def send_message(payload: SendMessageIn, db: Session = Depends(get_db)):
    account = _account(db, payload.account_id)
    from_number = payload.from_number.strip()
    to_number = payload.to_number.strip()
    if not E164.fullmatch(to_number):
        raise HTTPException(400, "Destination must be an E.164 number such as +16025551234")
    sender = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id,
        PhoneNumberCache.phone_number == from_number,
        PhoneNumberCache.sms_capable.is_(True),
    ).first()
    if sender is None:
        raise HTTPException(400, "Sender is not an SMS-capable number on this account")
    media_urls = [url.strip() for url in payload.media_urls if url.strip()]
    for media_url in media_urls:
        parsed = urlparse(media_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HTTPException(400, f"Invalid media URL: {media_url[:120]}")
    if not payload.body.strip() and not media_urls:
        raise HTTPException(400, "Enter a message or at least one media URL")
    try:
        kwargs = {
            "from_": from_number,
            "to": to_number,
            "body": payload.body,
        }
        if media_urls:
            kwargs["media_url"] = media_urls
        message = twilio_client.get_client(account).messages.create(**kwargs)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio send failed: {exc}") from exc
    return {
        "ok": True,
        "sid": message.sid,
        "status": message.status,
        "from_number": message.from_,
        "to_number": message.to,
    }


@router.delete("/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db)):
    msg = db.get(InboundMessage, message_id)
    if msg is None:
        raise HTTPException(404, "Message not found")
    db.delete(msg)
    db.commit()
    return {"ok": True}
