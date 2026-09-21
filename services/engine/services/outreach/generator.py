"""
Outreach Engine
Generates personalized cabinet outreach emails using AI.

Four sequence types:
1. project_specific — We know the project, want to bid
2. gc_account — We know the GC, no specific project
3. developer_owner — Developer/owner relationship building
4. renovation_refacing — Property managers, renovation contractors

Each email is personalized with:
- Contact name, company, role
- Project details (if available)
- Vulpine capabilities matching their needs
- Specific, low-friction CTA
"""

import json
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl, GHLContact, GHLOpportunity
from services.ghl_bridge.custom_fields import CABINET_TAGS


# ── Data Classes ────────────────────────────────────────────


@dataclass
class OutreachEmail:
    subject: str
    body: str
    contact_id: str
    sequence_type: str
    step_number: int
    campaign_id: str = ""
    generated_at: str = ""


@dataclass
class SequenceStep:
    step: int
    delay_days: int
    goal: str
    tone: str


# ── Sequence Definitions ────────────────────────────────────


PROJECT_SPECIFIC_SEQUENCE = [
    SequenceStep(step=1, delay_days=0, goal="Confirm cabinet procurement contact and request bid invitation", tone="Direct, helpful, project-aware"),
    SequenceStep(step=2, delay_days=3, goal="Follow up on plans or bid list add, offer capability overview", tone="Persistent but professional"),
    SequenceStep(step=3, delay_days=7, goal="Final check-in before bid date, offer value engineering or alternates", tone="Urgent but not desperate"),
]

GC_ACCOUNT_SEQUENCE = [
    SequenceStep(step=1, delay_days=0, goal="Introduce Vulpine, request vendor onboarding and future bid lists", tone="Professional, capability-focused"),
    SequenceStep(step=2, delay_days=5, goal="Share relevant project experience and ask about active markets", tone="Confident, relationship-building"),
    SequenceStep(step=3, delay_days=10, goal="Check in, offer budget pricing or early-stage consultation", tone="Helpful, low-pressure"),
]

DEVELOPER_OWNER_SEQUENCE = [
    SequenceStep(step=1, delay_days=0, goal="Position Vulpine as preferred supplier, discuss pipeline", tone="Strategic, partnership-oriented"),
    SequenceStep(step=2, delay_days=7, goal="Share portfolio and value prop, offer value engineering", tone="Value-driven, consultative"),
    SequenceStep(step=3, delay_days=14, goal="Re-engage with market-specific capabilities", tone="Patient, persistent"),
]

RENOVATION_SEQUENCE = [
    SequenceStep(step=1, delay_days=0, goal="Identify unit-turn or renovation programs, offer supply/refacing", tone="Solution-oriented, turnaround-focused"),
    SequenceStep(step=2, delay_days=5, goal="Share renovation case studies and pricing models", tone="Practical, ROI-focused"),
    SequenceStep(step=3, delay_days=12, goal="Check on upcoming projects, offer portfolio pricing", tone="Long-term relationship building"),
]


SEQUENCES = {
    "project_specific": PROJECT_SPECIFIC_SEQUENCE,
    "gc_account": GC_ACCOUNT_SEQUENCE,
    "developer_owner": DEVELOPER_OWNER_SEQUENCE,
    "renovation_refacing": RENOVATION_SEQUENCE,
}


# ── AI Email Generation ─────────────────────────────────────


async def generate_email(
    contact: GHLContact,
    sequence_type: str,
    step: int,
    opportunity: Optional[GHLOpportunity] = None,
    project_context: Optional[dict] = None,
) -> OutreachEmail:
    """Generate a personalized outreach email for a specific sequence step."""

    seq = SEQUENCES.get(sequence_type, PROJECT_SPECIFIC_SEQUENCE)
    step_def = seq[step - 1] if step <= len(seq) else seq[-1]

    # Build context
    project_info = ""
    if project_context:
        project_info = f"""
Project: {project_context.get('project_name', 'Unknown')}
Project Type: {project_context.get('project_type', 'Unknown')}
Location: {project_context.get('location', 'Unknown')}
Unit Count: {project_context.get('unit_count', 'Unknown')}
Bid Date: {project_context.get('bid_date', 'Unknown')}
Scope: {project_context.get('cabinet_scope', 'Unknown')}
"""

    system_prompt = f"""You are an outreach specialist for Vulpine, a commercial cabinet supplier.
Vulpine supplies: multifamily cabinets, hospitality casework, senior living cabinets, student housing cabinets, commercial cabinets, and cabinet refacing.
Vulpine's value: competitive pricing, reliable lead times, supplier-agnostic sourcing, full takeoff and estimating service, nationwide delivery.

Write a personalized outreach email. Rules:
- Be specific and relevant, not generic spam
- Reference the actual project or company situation
- Keep it under 150 words
- Make exactly ONE clear ask
- Sound human, not corporate
- No exclamation points
- No "hope this finds you well"
- No "we are a leading provider"

Tone: {step_def.tone}
Goal: {step_def.goal}
"""

    user_prompt = f"""
Write step {step} of a {sequence_type} outreach sequence.

Contact: {contact.full_name}
Title: {contact.title}
Company: {contact.company_name}
Role Category: {contact.custom_fields.get('contact_role_category', 'Unknown')}
{project_info}

This is step {step} of {len(seq)}. {"This is a follow-up to a previous email." if step > 1 else "This is the first outreach."}
Goal: {step_def.goal}

Return JSON:
{{
    "subject": "Email subject line (40-60 chars, specific, no spam words)",
    "body": "Full email body with greeting and signature"
}}
"""

    messages = [
        AIMessage(role="system", content=system_prompt),
        AIMessage(role="user", content=user_prompt),
    ]

    try:
        result = await ai.complete_json(messages, task=TaskType.WRITING, model=settings.writing_model)
    except Exception as e:
        logger.error(f"Email generation failed: {e}")
        # Fallback template
        result = {
            "subject": f"Cabinet package inquiry — {contact.company_name}",
            "body": f"""Hi {contact.first_name},

I'm reaching out from Vulpine — we supply cabinet packages for {contact.custom_fields.get('project_type', 'commercial and multifamily')} projects and saw your team's work.

Could you point me to the right person handling cabinet procurement and bid invitations? We'd like to get connected and review any upcoming opportunities.

Thanks,
Daniel Cruz
Vulpine Cabinets""",
        }

    return OutreachEmail(
        subject=result["subject"],
        body=result["body"],
        contact_id=contact.id,
        sequence_type=sequence_type,
        step_number=step,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Sequence Selection ──────────────────────────────────────


async def select_sequence(contact: GHLContact, opportunity: Optional[dict] = None) -> str:
    """Determine the best outreach sequence for a contact."""

    # If we have a specific project with bid date, use project-specific
    if opportunity:
        bid_date = opportunity.get("bid_date", "")
        project_name = opportunity.get("project_name", "")
        if project_name and bid_date:
            return "project_specific"

    # Check company type
    company_type = contact.custom_fields.get("company_type", "").lower()
    role = contact.custom_fields.get("contact_role_category", "").lower()

    if any(t in company_type for t in ["developer", "owner", "operator"]):
        return "developer_owner"
    if any(t in company_type for t in ["property management", "renovation"]):
        return "renovation_refacing"
    if any(t in company_type for t in ["general contractor", "construction manager"]):
        return "gc_account"

    # Default to GC account sequence
    return "gc_account"


# ── Outreach Pipeline ───────────────────────────────────────


async def send_outreach(
    contact_id: str,
    sequence_type: Optional[str] = None,
    step: int = 1,
    campaign_id: Optional[str] = None,
) -> Optional[OutreachEmail]:
    """Generate and queue an outreach email for a contact."""

    contact = await ghl.get_contact(contact_id)
    if not contact or not contact.id:
        logger.error(f"Contact {contact_id} not found for outreach")
        return None

    # Determine sequence
    if not sequence_type:
        sequence_type = await select_sequence(contact)

    if sequence_type not in SEQUENCES:
        logger.error(f"Invalid sequence type: {sequence_type}")
        return None

    # Generate email
    email = await generate_email(contact, sequence_type, step)

    # Update contact in GHL with outreach metadata
    await ghl.update_contact(contact_id, GHLContact(
        custom_fields={
            "outreach_sequence": sequence_type,
            "last_outreach_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }
    ))

    # Add to campaign if specified
    if campaign_id:
        await ghl.add_to_campaign(contact_id, campaign_id)

    # Apply sequence tag
    tag_map = {
        "project_specific": CABINET_TAGS["seq_project"],
        "gc_account": CABINET_TAGS["seq_gc"],
        "developer_owner": CABINET_TAGS["seq_developer"],
        "renovation_refacing": CABINET_TAGS["seq_renovation"],
    }
    tag = tag_map.get(sequence_type)
    if tag:
        await ghl.add_tags(contact_id, [tag])

    logger.info(f"Outreach generated: {contact.full_name} → {sequence_type} step {step}")
    return email


async def batch_outreach(tier: str = "BID_NOW", limit: int = 50) -> dict:
    """Send outreach to all contacts in a scoring tier."""
    results = {"sent": 0, "skipped": 0, "errors": 0}

    tier_tag = {
        "BID_NOW": CABINET_TAGS["score_bid_now"],
        "HIGH_PRIORITY": CABINET_TAGS["score_high"],
        "DEVELOP": CABINET_TAGS["score_develop"],
    }.get(tier, CABINET_TAGS["score_bid_now"])

    # This is limited by GHL's search API — we'd use webhooks/bulk operations in production
    all_contacts = await ghl.search_contacts(limit=limit)

    for contact in all_contacts:
        if tier_tag not in contact.tags:
            results["skipped"] += 1
            continue

        # Skip if already in outreach
        if contact.custom_fields.get("outreach_sequence"):
            results["skipped"] += 1
            continue

        try:
            await send_outreach(contact.id)
            results["sent"] += 1
        except Exception as e:
            logger.error(f"Outreach failed for {contact.id}: {e}")
            results["errors"] += 1

    logger.info(f"Batch outreach ({tier}): {results}")
    return results
