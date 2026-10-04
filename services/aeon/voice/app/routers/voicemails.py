"""Voicemail inbox.

Recording audio is proxied through the backend with the account's Twilio
credentials (HTTP basic auth) -- the raw Twilio recording URLs are never
exposed to the browser.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..crypto import decrypt_token
from ..db import get_db
from ..models import Account, Voicemail

log = logging.getLogger("twilio-app.voicemails")

router = APIRouter(
    prefix="/api/voicemails",
    tags=["voicemails"],
    dependencies=[Depends(get_current_admin)],
)


def _vm_dict(vm: Voicemail) -> dict:
    return {
        "id": vm.id,
        "number": vm.number,
        "from_number": vm.from_number,
        "recording_sid": vm.recording_sid,
        "transcription": vm.transcription,
        "listened": vm.listened,
        "received_at": vm.received_at.isoformat() if vm.received_at else None,
    }


@router.get("")
def list_voicemails(db: Session = Depends(get_db)):
    rows = db.query(Voicemail).order_by(Voicemail.id.desc()).limit(200).all()
    return [_vm_dict(v) for v in rows]


@router.get("/{vm_id}/audio")
def voicemail_audio(vm_id: int, db: Session = Depends(get_db)):
    """Stream the recording audio from Twilio (authenticated server-side)."""
    vm = db.get(Voicemail, vm_id)
    if vm is None:
        raise HTTPException(404, "Voicemail not found")
    if not vm.recording_url:
        raise HTTPException(404, "No recording URL stored")
    account = db.get(Account, vm.account_id) if vm.account_id else None
    if account is None:
        raise HTTPException(404, "Owning account not found")

    url = vm.recording_url
    # Twilio posts the .json resource URL; the .mp3 variant is the audio.
    if url.endswith(".json"):
        url = url[: -len(".json")] + ".mp3"

    async def stream():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "GET", url,
                auth=(account.account_sid, decrypt_token(account.encrypted_token)),
            ) as resp:
                if resp.status_code != 200:
                    raise HTTPException(502, f"Twilio returned {resp.status_code}")
                async for chunk in resp.aiter_bytes(65536):
                    yield chunk

    return StreamingResponse(stream(), media_type="audio/mpeg")


@router.post("/{vm_id}/listened")
def mark_listened(vm_id: int, db: Session = Depends(get_db)):
    vm = db.get(Voicemail, vm_id)
    if vm is None:
        raise HTTPException(404, "Voicemail not found")
    vm.listened = True
    db.commit()
    return {"ok": True}


@router.delete("/{vm_id}")
def delete_voicemail(vm_id: int, db: Session = Depends(get_db)):
    vm = db.get(Voicemail, vm_id)
    if vm is None:
        raise HTTPException(404, "Voicemail not found")
    # Also try to delete the recording from Twilio so it doesn't linger there.
    if vm.account_id and vm.recording_sid:
        account = db.get(Account, vm.account_id)
        if account is not None:
            try:
                from .. import twilio_client
                twilio_client.get_client(account).recordings(vm.recording_sid).delete()
            except Exception as exc:  # noqa: BLE001 -- local delete still proceeds
                log.warning("Could not delete Twilio recording %s: %s",
                            vm.recording_sid, exc)
    db.delete(vm)
    db.commit()
    return {"ok": True}
