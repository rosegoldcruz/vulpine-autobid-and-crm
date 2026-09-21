"""
FastAPI Routes for Vulpine Engine.
Exposes all Phase 1-3 services as REST endpoints for n8n orchestration.
"""

from fastapi import APIRouter, HTTPException, Body, Query, BackgroundTasks
from typing import Optional
from loguru import logger

from services.ghl_bridge.client import ghl, GHLContact
from services.discovery.importer import parse_csv, import_leads, RawLead
from services.scoring.engine import score_contact, score_all_unscored
from services.outreach.generator import send_outreach, batch_outreach
from services.reply.classifier import process_reply
from services.voice.vapi_agent import voice_outreach_to_tier

router = APIRouter(prefix="/api/v1")


# ── Health ──────────────────────────────────────────────────

@router.get("/ping")
async def ping():
    return {"status": "ok", "engine": "vulpine"}


# ── Discovery ───────────────────────────────────────────────

@router.post("/leads/import/csv")
async def import_csv_leads(
    csv_content: str = Body(..., description="Raw CSV file content"),
    classify: bool = Body(True),
):
    """Import leads from CSV content (Seamless, ZoomInfo exports, etc.)."""
    raw_leads = parse_csv(csv_content)
    if not raw_leads:
        raise HTTPException(400, "No valid leads found in CSV")

    result = await import_leads(raw_leads, classify=classify)
    return {
        "status": "complete",
        "total": result.total,
        "created": result.created,
        "updated": result.updated,
        "skipped_duplicate": result.skipped_duplicate,
        "skipped_invalid": result.skipped_invalid,
        "errors": result.errors[:20],  # First 20 errors
    }


@router.post("/leads/import/single")
async def import_single_lead(lead: dict = Body(...)):
    """Import a single lead from JSON."""
    raw = RawLead(
        first_name=lead.get("first_name", ""),
        last_name=lead.get("last_name", ""),
        email=lead.get("email", ""),
        phone=lead.get("phone", ""),
        company_name=lead.get("company_name", ""),
        title=lead.get("title", ""),
        source=lead.get("source", "manual"),
    )
    results = await import_leads([raw])
    return {"status": "complete", "created": results.created, "errors": results.errors}


# ── Scoring ─────────────────────────────────────────────────

@router.post("/scoring/contact/{contact_id}")
async def score_single_contact(contact_id: str, use_ai: bool = True):
    """Score a single contact for cabinet opportunity."""
    result = await score_contact(contact_id, use_ai=use_ai)
    if not result:
        raise HTTPException(404, "Contact not found")
    return {
        "contact_id": contact_id,
        "score": result.total,
        "tier": result.tier,
        "breakdown": {
            "active_project": result.active_project_multifamily_hospitality_senior_student,
            "cabinets_in_scope": result.cabinets_casework_explicitly_listed,
            "decision_maker_role": result.estimator_pm_purchasing_precon_exec_contact,
            "bid_within_30_days": result.bid_date_within_30_days,
            "plans_available": result.plans_or_schedules_available,
            "project_value_threshold": result.project_value_or_units_above_threshold,
            "existing_relationship": result.existing_relationship_or_rep_intro,
            "disqualified": result.tier == "DISQUALIFIED",
        },
    }


@router.post("/scoring/batch")
async def score_batch(limit: int = 500, use_ai: bool = True, background: BackgroundTasks = None):
    """Score all unscored contacts."""
    background.add_task(score_all_unscored, limit, use_ai)
    return {"status": "started", "message": f"Scoring up to {limit} contacts in background"}


# ── Outreach ────────────────────────────────────────────────

@router.post("/outreach/send/{contact_id}")
async def outreach_single(
    contact_id: str,
    sequence_type: Optional[str] = None,
    step: int = 1,
    campaign_id: Optional[str] = None,
):
    """Generate and send outreach for a single contact."""
    email = await send_outreach(contact_id, sequence_type, step, campaign_id)
    if not email:
        raise HTTPException(404, "Contact not found")
    return {
        "contact_id": contact_id,
        "subject": email.subject,
        "body_preview": email.body[:200],
        "sequence_type": email.sequence_type,
        "step": email.step_number,
    }


@router.post("/outreach/batch")
async def outreach_batch(
    tier: str = "BID_NOW",
    limit: int = 50,
    background: BackgroundTasks = None,
):
    """Send outreach to all contacts in a scoring tier."""
    background.add_task(batch_outreach, tier, limit)
    return {"status": "started", "message": f"Outreach to {tier} contacts (max {limit}) running in background"}


# ── Replies ─────────────────────────────────────────────────

@router.post("/replies/process")
async def process_inbound_reply(
    contact_id: str = Body(...),
    email_body: str = Body(...),
):
    """Process an inbound reply from GHL webhook."""
    result = await process_reply(contact_id, email_body)
    return result


# ── Voice ───────────────────────────────────────────────────

@router.post("/voice/campaign")
async def voice_campaign(
    tier: str = "BID_NOW",
    max_calls: int = 10,
    background: BackgroundTasks = None,
):
    """Launch outbound voice campaign via Vapi."""
    background.add_task(voice_outreach_to_tier, tier, max_calls)
    return {
        "status": "started",
        "message": f"Voice campaign to {tier} contacts (max {max_calls} calls) running in background",
    }


# ── GHL Webhooks ────────────────────────────────────────────

@router.post("/webhooks/ghl/contact-created")
async def ghl_contact_created(payload: dict = Body(...)):
    """Handle GHL webhook: contact created → auto-score."""
    contact_id = payload.get("contact", {}).get("id", "")
    if contact_id:
        logger.info(f"GHL webhook: contact created {contact_id}")
        # Auto-score in background
        try:
            await score_contact(contact_id, use_ai=True)
        except Exception as e:
            logger.error(f"Auto-score failed for {contact_id}: {e}")
    return {"status": "received"}


@router.post("/webhooks/ghl/reply-received")
async def ghl_reply_received(payload: dict = Body(...)):
    """Handle GHL webhook: email reply received."""
    contact_id = payload.get("contact", {}).get("id", "")
    body = payload.get("email", {}).get("body", "")
    if contact_id and body:
        logger.info(f"GHL webhook: reply from {contact_id}")
        result = await process_reply(contact_id, body)
        return result
    return {"status": "received", "note": "Missing contact_id or email body"}


# ── Vapi Webhook ────────────────────────────────────────────

@router.post("/webhooks/vapi/call-completed")
async def vapi_call_completed(payload: dict = Body(...)):
    """Handle Vapi webhook: call completed."""
    from services.voice.vapi_agent import analyze_call_transcript

    call_data = payload.get("call", {})
    transcript = call_data.get("transcript", "")
    customer_number = call_data.get("customer", {}).get("number", "")

    if not transcript:
        return {"status": "received", "note": "No transcript"}

    # Find contact by phone
    contacts = await ghl.search_contacts(phone=customer_number)
    if not contacts:
        logger.warning(f"No contact found for phone: {customer_number}")
        return {"status": "received", "note": "Contact not found"}

    contact = contacts[0]
    analysis = await analyze_call_transcript(transcript, contact)

    # Update GHL
    await ghl.update_contact(contact.id, GHLContact(
        custom_fields={
            "last_outreach_date": "",
            "reply_intent": analysis.get("call_outcome", "unknown"),
        }
    ))

    logger.info(f"Call analysis for {contact.full_name}: {analysis.get('call_outcome')}")
    return {"status": "analyzed", "contact_id": contact.id, "analysis": analysis}


# ── Pipeline Overview ───────────────────────────────────────

@router.get("/pipeline/summary")
async def pipeline_summary():
    """Get a high-level pipeline summary."""
    # Count by tier
    tiers = {}
    for tier in ["BID_NOW", "HIGH_PRIORITY", "DEVELOP", "MONITOR", "ARCHIVE"]:
        # Search by tag (simplified — in production, use proper aggregations)
        tag = {
            "BID_NOW": "CABINET_BID_NOW",
            "HIGH_PRIORITY": "CABINET_HIGH_PRIORITY",
            "DEVELOP": "CABINET_DEVELOP",
            "MONITOR": "CABINET_MONITOR",
            "ARCHIVE": "CABINET_ARCHIVE",
        }.get(tier, "")
        contacts = await ghl.search_contacts(limit=1)  # Placeholder
        tiers[tier] = len(contacts)  # This will be approximate

    return {
        "pipeline_by_tier": tiers,
        "total_contacts": sum(tiers.values()),
        "note": "Full pipeline analytics coming in Phase 2",
    }
