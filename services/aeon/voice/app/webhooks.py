"""Public Twilio webhook endpoints (no login).

Every request is validated with Twilio's X-Twilio-Signature header against
the matching account's auth token. Requests with a missing/invalid signature
are rejected with 403 -- this is the only auth these endpoints have, so it
is enforced strictly.

Requires PUBLIC_BASE_URL to be set correctly, since signature validation
reconstructs the exact URL Twilio called.
"""
import logging
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from twilio.twiml.messaging_response import MessagingResponse
from twilio.twiml.voice_response import VoiceResponse

from . import config, twilio_client
from .crypto import decrypt_token
from .db import get_db
from .models import (
    Account,
    Campaign,
    CampaignRecipient,
    InboundMessage,
    NumberSettings,
    PhoneNumberCache,
    Voicemail,
)

log = logging.getLogger("twilio-app.webhooks")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Twilio message statuses we treat as terminal failures for campaign stats.
_FAILED = {"failed", "undelivered"}
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def _full_url(request: Request) -> str:
    base = (config.PUBLIC_BASE_URL or "").rstrip("/")
    if not base:
        raise HTTPException(503, "PUBLIC_BASE_URL is not configured")
    query = request.url.query
    return f"{base}{request.url.path}" + (f"?{query}" if query else "")


def _account_for_number(db: Session, e164: str) -> Account | None:
    cache = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.phone_number == e164
    ).first()
    if cache:
        return db.get(Account, cache.account_id)
    return None


def _settings_for(db: Session, e164: str) -> NumberSettings:
    settings = db.query(NumberSettings).filter(
        NumberSettings.phone_number == e164
    ).first()
    if settings is None:
        settings = NumberSettings(phone_number=e164)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _voicemail_or_unavailable(settings: NumberSettings, to_number: str) -> VoiceResponse:
    """Build the shared voicemail/hangup response used after browser fallback."""
    resp = VoiceResponse()
    if settings.voicemail_enabled:
        greeting = settings.voicemail_greeting.strip() or "Please leave a message."
        vm_cb = (twilio_client.webhook_url("/webhooks/voicemail-done")
                 + f"?to={quote(to_number, safe='')}")
        resp.say(greeting)
        resp.record(
            transcribe=True,
            action=vm_cb,
            method="POST",
            max_length=180,
            play_beep=True,
        )
    else:
        resp.say("Sorry, this number is not available. Goodbye.")
        resp.hangup()
    return resp


async def _verified_form(request: Request, db: Session, to_number: str | None,
                         account: Account | None = None):
    """Read form params and validate the Twilio signature. Returns (form, account)."""
    form = await request.form()
    params = {k: v for k, v in form.items() if isinstance(v, str)}
    if account is None:
        account = _account_for_number(db, to_number or "")
    if account is None:
        raise HTTPException(403, "Unknown destination number")
    signature = request.headers.get("X-Twilio-Signature", "")
    token = decrypt_token(account.encrypted_token)
    if not twilio_client.validate_signature(_full_url(request), params, signature, token):
        log.warning("Rejected webhook with invalid signature for %s", to_number)
        raise HTTPException(403, "Invalid Twilio signature")
    return params, account


@router.post("/sms")
async def sms_webhook(request: Request, db: Session = Depends(get_db)):
    """Inbound SMS: log it, and auto-reply if enabled for the To number."""
    raw_form = await request.form()
    to_number = str(raw_form.get("To", ""))
    params, account = await _verified_form(request, db, to_number)

    from_number = params.get("From", "")
    body = params.get("Body", "")

    settings = _settings_for(db, to_number)
    replied = False
    resp = MessagingResponse()

    inbound = InboundMessage(
        account_id=account.id,
        from_number=from_number,
        to_number=to_number,
        body=body,
    )
    if settings.auto_reply_enabled and settings.auto_reply_text.strip():
        resp.message(settings.auto_reply_text)
        inbound.replied = True
        replied = True
    db.add(inbound)
    db.commit()
    log.info("Inbound SMS %s -> %s (auto-replied=%s)", from_number, to_number, replied)
    return Response(content=str(resp), media_type="application/xml")


@router.post("/voice")
async def voice_webhook(request: Request, db: Session = Depends(get_db)):
    """Inbound call: forward, voicemail, or polite hangup -- per number settings."""
    raw_form = await request.form()
    to_number = str(raw_form.get("To", ""))
    params, account = await _verified_form(request, db, to_number)

    settings = _settings_for(db, to_number)
    resp = VoiceResponse()

    if settings.browser_ringing_enabled and account.api_key_sid and account.twiml_app_sid:
        fallback_cb = (twilio_client.webhook_url("/webhooks/browser-fallback")
                       + f"?to={quote(to_number, safe='')}")
        dial_kwargs = {"action": fallback_cb, "method": "POST", "timeout": 25}
        if settings.record_calls:
            dial_kwargs["record"] = "record-from-answer-dual"
        dial = resp.dial(**dial_kwargs)
        dial.client(account.voice_identity or "backoffice")
        log.info("Ringing browser client for %s", to_number)
    elif settings.forwarding_enabled and settings.forward_to.strip():
        target = settings.forward_to.strip()
        status_cb = (twilio_client.webhook_url("/webhooks/call-status")
                     + f"?to={quote(to_number, safe='')}")
        dial_kwargs = {"action": status_cb, "method": "POST", "timeout": 25}
        if settings.record_calls:
            dial_kwargs["record"] = "record-from-answer"
        resp.dial(target, **dial_kwargs)
        log.info("Forwarding call to %s -> %s", to_number, target)
    else:
        resp = _voicemail_or_unavailable(settings, to_number)
        if settings.voicemail_enabled:
            log.info("Sending call on %s to voicemail", to_number)

    return Response(content=str(resp), media_type="application/xml")


@router.post("/browser-voice")
async def browser_voice_webhook(request: Request, db: Session = Depends(get_db)):
    """TwiML App webhook for an outbound call from the browser Voice SDK."""
    raw_form = await request.form()
    account_sid = str(raw_form.get("AccountSid", ""))
    account = db.query(Account).filter(Account.account_sid == account_sid).first()
    if account is None:
        raise HTTPException(403, "Unknown Twilio account")
    params, account = await _verified_form(request, db, None, account=account)

    destination = params.get("To", "").strip()
    requested_caller = params.get("FromNumber", "").strip()
    if not _E164.fullmatch(destination):
        resp = VoiceResponse()
        resp.say("The destination number is invalid.")
        resp.hangup()
        return Response(content=str(resp), media_type="application/xml")

    caller_query = db.query(PhoneNumberCache).filter(
        PhoneNumberCache.account_id == account.id,
        PhoneNumberCache.voice_capable.is_(True),
    )
    caller = None
    if requested_caller:
        caller = caller_query.filter(
            PhoneNumberCache.phone_number == requested_caller
        ).first()
    if caller is None:
        caller = caller_query.order_by(
            PhoneNumberCache.is_default_sender.desc(),
            PhoneNumberCache.id,
        ).first()
    if caller is None:
        raise HTTPException(409, "No voice-capable caller ID is synced for this account")

    dial_kwargs = {
        "caller_id": caller.phone_number,
        "answer_on_bridge": True,
        "timeout": 30,
    }
    if params.get("Record", "").lower() == "true":
        dial_kwargs["record"] = "record-from-answer-dual"
    resp = VoiceResponse()
    dial = resp.dial(**dial_kwargs)
    dial.number(destination)
    log.info("Browser call %s -> %s", caller.phone_number, destination)
    return Response(content=str(resp), media_type="application/xml")


@router.post("/browser-fallback")
async def browser_fallback_webhook(request: Request, db: Session = Depends(get_db)):
    """Route an unanswered browser call to voicemail (or a polite hangup)."""
    to_number = request.query_params.get("to", "")
    params, _account = await _verified_form(request, db, to_number or None)
    if params.get("DialCallStatus") == "completed":
        return Response(content=str(VoiceResponse()), media_type="application/xml")
    settings = _settings_for(db, to_number)
    return Response(
        content=str(_voicemail_or_unavailable(settings, to_number)),
        media_type="application/xml",
    )


@router.post("/call-status")
async def call_status_webhook(request: Request, db: Session = Depends(get_db)):
    """Twilio <Dial> action callback. Sends a missed-call SMS alert when the
    forwarded leg didn't connect and alerts are enabled for the number."""
    to_number = request.query_params.get("to", "")
    params, account = await _verified_form(request, db, to_number or None)

    dial_status = params.get("DialCallStatus", "")
    caller = params.get("From", params.get("Caller", ""))
    log.info("Call status for %s: dial=%s caller=%s", to_number, dial_status, caller)

    if dial_status in ("no-answer", "busy", "failed", "canceled") and to_number:
        settings = _settings_for(db, to_number)
        notify = (settings.alert_notify_number or "").strip()
        if settings.missed_call_alert and notify:
            try:
                client = twilio_client.get_client(account)
                client.messages.create(
                    to=notify,
                    from_=to_number,
                    body=f"Missed call from {caller} to your number {to_number} ({dial_status}).",
                )
                log.info("Sent missed-call alert to %s", notify)
            except Exception as exc:  # noqa: BLE001
                log.warning("Missed-call alert send failed: %s", exc)

    return Response(content=str(VoiceResponse()), media_type="application/xml")


@router.post("/voicemail-done")
async def voicemail_done_webhook(request: Request, db: Session = Depends(get_db)):
    """Twilio <Record> action callback: store the voicemail + transcription."""
    to_number = request.query_params.get("to", "")
    params, account = await _verified_form(request, db, to_number or None)

    vm = Voicemail(
        account_id=account.id,
        number=to_number,
        from_number=params.get("From", params.get("Caller", "")),
        recording_url=params.get("RecordingUrl", ""),
        recording_sid=params.get("RecordingSid", ""),
        transcription=params.get("TranscriptionText", ""),
    )
    db.add(vm)
    db.commit()
    log.info("Voicemail stored for %s from %s", to_number, vm.from_number)

    resp = VoiceResponse()
    resp.say("Thank you. Goodbye.")
    resp.hangup()
    return Response(content=str(resp), media_type="application/xml")


@router.post("/status-callback")
async def status_callback_webhook(request: Request, db: Session = Depends(get_db)):
    """Delivery receipts for campaign messages. Updates per-recipient status.

    The campaign worker passes the recipient id via the StatusCallback URL
    query string (?rid=<id>); we also fall back to matching on MessageSid.
    """
    form = await request.form()
    params = {k: v for k, v in form.items() if isinstance(v, str)}
    message_sid = params.get("MessageSid", "")
    msg_status = params.get("MessageStatus", "")
    rid = request.query_params.get("rid")

    recipient: CampaignRecipient | None = None
    if rid and rid.isdigit():
        recipient = db.get(CampaignRecipient, int(rid))
    if recipient is None and message_sid:
        recipient = db.query(CampaignRecipient).filter(
            CampaignRecipient.twilio_sid == message_sid
        ).first()
    if recipient is None:
        # Still validate the signature against *some* account so random
        # posts can't probe this endpoint: use the default account.
        default_acct = db.query(Account).filter(Account.is_default.is_(True)).first()
        if default_acct is None:
            default_acct = db.query(Account).first()
        if default_acct is None:
            raise HTTPException(403, "No accounts configured")
        await _verified_form(request, db, None, account=default_acct)
        return Response(content="ok")

    account = db.get(Account, recipient.campaign.account_id)
    await _verified_form(request, db, None, account=account)

    if message_sid and not recipient.twilio_sid:
        recipient.twilio_sid = message_sid
    if msg_status:
        recipient.status = msg_status
        campaign = recipient.campaign
        if msg_status in _FAILED:
            campaign.failed_count += 1
        db.commit()
        log.info("Recipient %s -> %s (%s)", recipient.id, recipient.to_number, msg_status)
    return Response(content="ok")
