"""Bulk SMS/MMS campaigns.

Flow: create (draft) -> preview/confirm in the UI -> launch.
The background worker (app/worker.py) throttles sends to `rate_per_sec`.
Delivery receipts arrive later via /webhooks/status-callback and update
each recipient's final status.
"""
import json
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import worker
from ..auth import get_current_admin
from ..db import get_db
from ..models import Account, Campaign, CampaignRecipient
from .settings import get_global_rate

log = logging.getLogger("twilio-app.campaigns")

router = APIRouter(
    prefix="/api/campaigns",
    tags=["campaigns"],
    dependencies=[Depends(get_current_admin)],
)


def _normalize_number(raw: str) -> str | None:
    """Keep digits (and a leading +); require 7-15 digits. Returns E.164-ish."""
    raw = raw.strip()
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not (7 <= len(digits) <= 15):
        return None
    return "+" + digits


def _parse_recipients(text: str) -> tuple[list[str], int]:
    """Split pasted/CSV text into deduped E.164 numbers. Returns (numbers, skipped)."""
    seen: set[str] = set()
    skipped = 0
    for chunk in re.split(r"[\s,;]+", text or ""):
        num = _normalize_number(chunk)
        if num is None:
            if chunk.strip():
                skipped += 1
            continue
        seen.add(num)
    return sorted(seen), skipped


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    account_id: int
    from_number: str = Field(min_length=5, max_length=32)
    message: str = Field(default="", max_length=1600)
    media_urls: list[str] = Field(default_factory=list)  # MMS attachments
    recipients_text: str = Field(default="")             # pasted list or CSV content
    rate_per_sec: float | None = None                    # override; else global default


def _campaign_dict(c: Campaign) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "account_id": c.account_id,
        "from_number": c.from_number,
        "message": c.message,
        "media_urls": json.loads(c.media_urls or "[]"),
        "rate_per_sec": c.rate_per_sec,
        "status": c.status,
        "total": c.total,
        "sent_count": c.sent_count,
        "failed_count": c.failed_count,
        "running": worker.is_running(c.id),
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "launched_at": c.launched_at.isoformat() if c.launched_at else None,
    }


@router.get("")
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(Campaign.id.desc()).all()
    return [_campaign_dict(c) for c in campaigns]


@router.post("")
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    account = db.get(Account, payload.account_id)
    if account is None:
        raise HTTPException(404, "Account not found")

    numbers, skipped = _parse_recipients(payload.recipients_text)
    if not numbers:
        raise HTTPException(400, "No valid recipient numbers found")
    if not payload.message.strip() and not payload.media_urls:
        raise HTTPException(400, "Message text or at least one media URL is required")

    media = [u.strip() for u in payload.media_urls if u.strip()]
    rate = payload.rate_per_sec or get_global_rate(db)

    campaign = Campaign(
        name=payload.name.strip(),
        account_id=account.id,
        from_number=payload.from_number.strip(),
        message=payload.message,
        media_urls=json.dumps(media),
        rate_per_sec=max(rate, 0.1),
        status="draft",
        total=len(numbers),
    )
    db.add(campaign)
    db.flush()
    db.add_all(
        CampaignRecipient(campaign_id=campaign.id, to_number=n) for n in numbers
    )
    db.commit()
    db.refresh(campaign)
    log.info("Created campaign %s (%d recipients, %d skipped)",
             campaign.id, len(numbers), skipped)
    return {**_campaign_dict(campaign), "skipped": skipped}


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    recipients = (
        db.query(CampaignRecipient)
        .filter(CampaignRecipient.campaign_id == campaign_id)
        .order_by(CampaignRecipient.id)
        .limit(2000)
        .all()
    )
    data = _campaign_dict(campaign)
    data["recipients"] = [
        {
            "id": r.id,
            "to_number": r.to_number,
            "twilio_sid": r.twilio_sid,
            "status": r.status,
            "error": r.error,
        }
        for r in recipients
    ]
    return data


@router.post("/{campaign_id}/launch")
async def launch(campaign_id: int, db: Session = Depends(get_db)):
    # NOTE: this endpoint is `async` (not sync) so asyncio.create_task()
    # inside worker.launch_campaign() has a running event loop.
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in ("draft", "interrupted", "cancelled"):
        raise HTTPException(400, f"Cannot launch a campaign with status '{campaign.status}'")
    try:
        worker.launch_campaign(campaign_id)
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc
    # Mark running only after the worker task exists; if the commit below
    # failed, the task would see status != "running" and exit immediately.
    campaign.status = "running"
    campaign.launched_at = datetime.now(timezone.utc)
    db.commit()
    log.info("Launched campaign %s", campaign_id)
    return {"ok": True}


@router.post("/{campaign_id}/cancel")
def cancel(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    worker.cancel_campaign(campaign_id)
    if campaign.status == "running":
        campaign.status = "cancelled"
        db.commit()
    return {"ok": True}


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    if worker.is_running(campaign_id):
        raise HTTPException(409, "Cancel the running campaign first")
    db.delete(campaign)
    db.commit()
    return {"ok": True}
