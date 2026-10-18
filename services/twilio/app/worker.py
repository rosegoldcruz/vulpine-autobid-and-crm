"""Background worker that sends campaign messages at a throttled rate.

Campaigns are launched via POST /api/campaigns/{id}/launch, which spawns an
asyncio task here. The task walks the campaign's pending recipients and
sends at most `rate_per_sec` messages per second, spacing sends evenly.

Delivery results keep arriving asynchronously through Twilio status callbacks
(/webhooks/status-callback), which update each recipient's final status.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from . import twilio_client
from .db import SessionLocal
from .models import Account, Campaign, CampaignRecipient

log = logging.getLogger("twilio-app.worker")

# campaign_id -> asyncio.Task for currently running campaigns
_tasks: dict[int, asyncio.Task] = {}


def is_running(campaign_id: int) -> bool:
    task = _tasks.get(campaign_id)
    return task is not None and not task.done()


def launch_campaign(campaign_id: int) -> None:
    """Spawn (or re-spawn) the background send task for a campaign."""
    if is_running(campaign_id):
        raise RuntimeError("Campaign is already running")
    task = asyncio.create_task(_run_campaign(campaign_id), name=f"campaign-{campaign_id}")
    _tasks[campaign_id] = task
    task.add_done_callback(lambda t: _tasks.pop(campaign_id, None))


def cancel_campaign(campaign_id: int) -> bool:
    task = _tasks.get(campaign_id)
    if task and not task.done():
        task.cancel()
        return True
    return False


def _send_one(account: Account, from_number: str, to_number: str,
              body: str, media_urls: list[str], status_callback: str):
    """Blocking Twilio send -- always called from a worker thread."""
    client = twilio_client.get_client(account)
    kwargs = {
        "to": to_number,
        "from_": from_number,
        "body": body or "",
        "status_callback": status_callback,
    }
    if media_urls:
        kwargs["media_url"] = media_urls
    return client.messages.create(**kwargs)


async def _run_campaign(campaign_id: int) -> None:
    db = SessionLocal()
    try:
        campaign = db.get(Campaign, campaign_id)
        if campaign is None or campaign.status != "running":
            return
        account = db.get(Account, campaign.account_id)
        if account is None:
            campaign.status = "interrupted"
            db.commit()
            return

        media_urls = json.loads(campaign.media_urls or "[]")
        rate = max(float(campaign.rate_per_sec or 1.0), 0.1)
        delay = 1.0 / rate
        callback = twilio_client.webhook_url("/webhooks/status-callback")

        recipients = (
            db.query(CampaignRecipient)
            .filter(
                CampaignRecipient.campaign_id == campaign_id,
                CampaignRecipient.status == "pending",
            )
            .order_by(CampaignRecipient.id)
            .all()
        )
        log.info("Campaign %s: sending to %d recipients at %.2f msg/s",
                 campaign_id, len(recipients), rate)

        for recipient in recipients:
            # Re-check status so a cancel/restart doesn't double-send.
            db.refresh(campaign)
            if campaign.status != "running":
                log.info("Campaign %s stopped (status=%s)", campaign_id, campaign.status)
                break
            try:
                msg = await asyncio.to_thread(
                    _send_one, account, campaign.from_number,
                    recipient.to_number, campaign.message, media_urls, callback,
                )
                recipient.twilio_sid = msg.sid
                recipient.status = "queued"
                campaign.sent_count += 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 -- per-recipient failure is non-fatal
                # Never log the auth token; the exception text comes from Twilio.
                recipient.status = "failed"
                recipient.error = str(exc)[:500]
                campaign.failed_count += 1
                log.warning("Campaign %s: send to %s failed: %s",
                            campaign_id, recipient.to_number, exc)
            recipient.updated_at = datetime.now(timezone.utc)
            db.commit()
            await asyncio.sleep(delay)

        db.refresh(campaign)
        if campaign.status == "running":
            campaign.status = "done"
            db.commit()
            log.info("Campaign %s finished: %d sent, %d failed",
                     campaign_id, campaign.sent_count, campaign.failed_count)
    except asyncio.CancelledError:
        db.rollback()
        campaign = db.get(Campaign, campaign_id)
        if campaign is not None and campaign.status == "running":
            campaign.status = "cancelled"
            db.commit()
        log.info("Campaign %s cancelled", campaign_id)
        raise
    finally:
        db.close()
