"""Call recordings browser (per account, live from Twilio).

Audio is proxied through the backend with account auth -- raw Twilio media
URLs are never exposed to the browser.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import twilio_client
from ..auth import get_current_admin
from ..crypto import decrypt_token
from ..db import get_db
from ..models import Account

log = logging.getLogger("twilio-app.recordings")

router = APIRouter(
    prefix="/api/recordings",
    tags=["recordings"],
    dependencies=[Depends(get_current_admin)],
)


def _get_account(db: Session, account_id: int) -> Account:
    acct = db.get(Account, account_id)
    if acct is None:
        raise HTTPException(404, "Account not found")
    return acct


def _media_url(account_sid: str, recording_sid: str) -> str:
    return (f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
            f"/Recordings/{recording_sid}.mp3")


@router.get("")
def list_recordings(
    account_id: int = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    account = _get_account(db, account_id)
    client = twilio_client.get_client(account)
    try:
        recs = client.recordings.list(limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    return [
        {
            "sid": r.sid,
            "call_sid": r.call_sid,
            "duration": r.duration,
            "date_created": r.date_created.isoformat() if r.date_created else None,
        }
        for r in recs
    ]


@router.get("/{recording_sid}/audio")
def recording_audio(recording_sid: str, account_id: int = Query(...),
                    db: Session = Depends(get_db)):
    account = _get_account(db, account_id)

    async def stream():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "GET", _media_url(account.account_sid, recording_sid),
                auth=(account.account_sid, decrypt_token(account.encrypted_token)),
            ) as resp:
                if resp.status_code != 200:
                    raise HTTPException(502, f"Twilio returned {resp.status_code}")
                async for chunk in resp.aiter_bytes(65536):
                    yield chunk

    return StreamingResponse(stream(), media_type="audio/mpeg")


@router.delete("/{recording_sid}")
def delete_recording(recording_sid: str, account_id: int = Query(...),
                     db: Session = Depends(get_db)):
    account = _get_account(db, account_id)
    try:
        twilio_client.get_client(account).recordings(recording_sid).delete()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Twilio API error: {exc}") from exc
    return {"ok": True}
