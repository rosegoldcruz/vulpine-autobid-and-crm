"""Settings: global messaging defaults + per-number behavior.

Per-number settings drive the webhook responses (auto-reply text, call
forwarding target, recording, missed-call alerts, voicemail greeting).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..db import get_db
from ..models import AppSetting, NumberSettings

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_admin)],
)

DEFAULT_SMS_PER_SEC = "default_sms_per_sec"


def get_global_rate(db: Session) -> float:
    row = db.get(AppSetting, DEFAULT_SMS_PER_SEC)
    try:
        return float(row.value) if row else 1.0
    except ValueError:
        return 1.0


class GlobalSettingsIn(BaseModel):
    default_sms_per_sec: float = Field(ge=0.1, le=100)


@router.get("/global")
def get_global(db: Session = Depends(get_db)):
    return {"default_sms_per_sec": get_global_rate(db)}


@router.put("/global")
def put_global(payload: GlobalSettingsIn, db: Session = Depends(get_db)):
    row = db.get(AppSetting, DEFAULT_SMS_PER_SEC)
    if row is None:
        row = AppSetting(key=DEFAULT_SMS_PER_SEC)
        db.add(row)
    row.value = str(payload.default_sms_per_sec)
    db.commit()
    return {"ok": True, "default_sms_per_sec": payload.default_sms_per_sec}


class NumberSettingsIn(BaseModel):
    phone_number: str = Field(min_length=5, max_length=32)
    auto_reply_enabled: bool = False
    auto_reply_text: str = ""
    forwarding_enabled: bool = False
    forward_to: str = ""
    record_calls: bool = False
    browser_ringing_enabled: bool = False
    missed_call_alert: bool = False
    alert_notify_number: str = ""
    voicemail_enabled: bool = False
    voicemail_greeting: str = ""


def _settings_dict(s: NumberSettings) -> dict:
    return {
        "phone_number": s.phone_number,
        "auto_reply_enabled": s.auto_reply_enabled,
        "auto_reply_text": s.auto_reply_text,
        "forwarding_enabled": s.forwarding_enabled,
        "forward_to": s.forward_to,
        "record_calls": s.record_calls,
        "browser_ringing_enabled": s.browser_ringing_enabled,
        "missed_call_alert": s.missed_call_alert,
        "alert_notify_number": s.alert_notify_number,
        "voicemail_enabled": s.voicemail_enabled,
        "voicemail_greeting": s.voicemail_greeting,
    }


@router.get("/number")
def get_number_settings(phone_number: str = Query(...), db: Session = Depends(get_db)):
    s = db.query(NumberSettings).filter(
        NumberSettings.phone_number == phone_number.strip()
    ).first()
    if s is None:
        s = NumberSettings(phone_number=phone_number.strip())
        db.add(s)
        db.commit()
        db.refresh(s)
    return _settings_dict(s)


@router.put("/number")
def put_number_settings(payload: NumberSettingsIn, db: Session = Depends(get_db)):
    if payload.forwarding_enabled and not payload.forward_to.strip():
        raise HTTPException(400, "Forwarding is enabled but no target number is set")
    if payload.missed_call_alert and not payload.alert_notify_number.strip():
        raise HTTPException(400, "Missed-call alert is on but no notify number is set")
    s = db.query(NumberSettings).filter(
        NumberSettings.phone_number == payload.phone_number.strip()
    ).first()
    if s is None:
        s = NumberSettings(phone_number=payload.phone_number.strip())
        db.add(s)
    s.auto_reply_enabled = payload.auto_reply_enabled
    s.auto_reply_text = payload.auto_reply_text or ""
    s.forwarding_enabled = payload.forwarding_enabled
    s.forward_to = payload.forward_to.strip()
    s.record_calls = payload.record_calls
    s.browser_ringing_enabled = payload.browser_ringing_enabled
    s.missed_call_alert = payload.missed_call_alert
    s.alert_notify_number = payload.alert_notify_number.strip()
    s.voicemail_enabled = payload.voicemail_enabled
    s.voicemail_greeting = payload.voicemail_greeting or ""
    db.commit()
    db.refresh(s)
    return _settings_dict(s)
