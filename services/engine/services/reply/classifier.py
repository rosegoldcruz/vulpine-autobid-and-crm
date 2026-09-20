"""
Reply Classification and Auto-Response Engine

Handles inbound email replies from GHL webhooks:
1. Classifies intent (send plans, not interested, call me, etc.)
2. Takes automatic action where appropriate
3. Escalates hot replies for human attention
4. Updates GHL contact/opportunity with reply metadata
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional
from datetime import datetime, timezone

from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl, GHLContact
from services.ghl_bridge.custom_fields import CABINET_TAGS


# ── Intent Classification ───────────────────────────────────


class ReplyIntent(str, Enum):
    SEND_PLANS = "send_plans"
    ADD_TO_BID_LIST = "add_to_bid_list"
    CONTACT_ESTIMATOR = "contact_estimator"         # Redirect to different person
    BID_DATE_CONFIRMED = "bid_date_confirmed"
    ALREADY_HAVE_SUPPLIER = "already_have_supplier"
    NOT_INTERESTED = "not_interested"
    WRONG_PERSON = "wrong_person"
    CALL_ME = "call_me"
    FUTURE_PROJECTS = "future_projects"
    VENDOR_REGISTRATION = "vendor_registration"
    OUT_OF_OFFICE = "out_of_office"
    UNSUBSCRIBE = "unsubscribe"
    OTHER = "other"


@dataclass
class ClassifiedReply:
    intent: ReplyIntent
    confidence: float
    summary: str                    # One-line summary
    extracted_info: dict            # Email, phone, date, name extracted from reply
    requires_human: bool
    recommended_action: str


# ── AI Classification ───────────────────────────────────────


async def classify_reply(email_body: str, contact_context: str = "") -> ClassifiedReply:
    """Classify the intent of an inbound reply email."""

    system_prompt = """You classify inbound email replies for a commercial cabinet supplier (Vulpine).
Analyze the reply and determine the sender's intent.

Intent categories:
- send_plans: They want to send or share plans/specs/drawings
- add_to_bid_list: They want to add Vulpine to a bidder list
- contact_estimator: They're redirecting to a different person (usually an estimator)
- bid_date_confirmed: They're confirming or sharing bid date/deadline
- already_have_supplier: They already have a cabinet supplier
- not_interested: Clear rejection or not interested
- wrong_person: This person doesn't handle cabinets/procurement
- call_me: They want a phone call
- future_projects: No current project but open to future
- vendor_registration: They require vendor registration/onboarding first
- out_of_office: Automated out-of-office reply
- unsubscribe: Opt-out request
- other: None of the above

Return JSON:
{
    "intent": "one of the categories above",
    "confidence": 0.0-1.0,
    "summary": "one sentence summarizing the reply",
    "extracted_info": {
        "contact_name": "if a new person is mentioned",
        "contact_email": "if a new email is mentioned",
        "phone_number": "if a phone number is mentioned",
        "bid_date": "if a date is mentioned",
        "project_name": "if a project is referenced"
    },
    "recommended_action": "one sentence describing what to do"
}"""

    user_prompt = f"""
Contact context: {contact_context if contact_context else "Unknown construction industry contact"}

Email body:
---
{email_body}
---

Classify this reply intent.
"""

    messages = [
        AIMessage(role="system", content=system_prompt),
        AIMessage(role="user", content=user_prompt),
    ]

    try:
        result = await ai.complete_json(messages, task=TaskType.CHEAP, model=settings.cheap_model)
        return ClassifiedReply(
            intent=ReplyIntent(result.get("intent", "other")),
            confidence=result.get("confidence", 0.5),
            summary=result.get("summary", ""),
            extracted_info=result.get("extracted_info", {}),
            requires_human=_requires_human(result.get("intent", "other")),
            recommended_action=result.get("recommended_action", ""),
        )
    except Exception as e:
        logger.error(f"Reply classification failed: {e}")
        return ClassifiedReply(
            intent=ReplyIntent.OTHER,
            confidence=0.0,
            summary="Classification failed",
            extracted_info={},
            requires_human=True,
            recommended_action="Manual review required",
        )


def _requires_human(intent: str) -> bool:
    """Determine if this reply needs human attention."""
    human_intents = {
        "call_me",
        "contact_estimator",   # Need to hand off properly
        "send_plans",           # Human reviews plans first
        "vendor_registration",  # May need documents
        "already_have_supplier", # Strategic decision
        "not_interested",       # May be worth a follow-up call
    }
    auto_intents = {
        "out_of_office",
        "unsubscribe",
        "wrong_person",
        "bid_date_confirmed",
        "future_projects",
        "add_to_bid_list",
    }
    if intent in human_intents:
        return True
    if intent in auto_intents:
        return False
    return True  # Default to human for unknown


# ── Auto-Response Actions ───────────────────────────────────


async def handle_auto_response(contact: GHLContact, reply: ClassifiedReply) -> str:
    """Execute automatic actions based on reply intent. Returns action description."""

    intent = reply.intent

    if intent == ReplyIntent.OUT_OF_OFFICE:
        await ghl.add_tags(contact.id, [CABINET_TAGS["reply_out_of_office"]])
        await ghl.update_contact(contact.id, GHLContact(
            custom_fields={"reply_intent": "out_of_office"}
        ))
        return "Tagged as out-of-office. Sequence paused."

    elif intent == ReplyIntent.UNSUBSCRIBE:
        await ghl.add_tags(contact.id, [CABINET_TAGS["reply_unsubscribe"]])
        await ghl.update_contact(contact.id, GHLContact(
            custom_fields={"reply_intent": "unsubscribe"}
        ))
        return "Tagged as unsubscribed. Removed from all sequences."

    elif intent == ReplyIntent.WRONG_PERSON:
        # Check if they redirected us to someone else
        new_email = reply.extracted_info.get("contact_email", "")
        new_name = reply.extracted_info.get("contact_name", "")
        if new_email:
            # Create the new contact and link
            new_contact = GHLContact(
                email=new_email,
                first_name=new_name.split()[0] if new_name else "",
                last_name=" ".join(new_name.split()[1:]) if new_name and len(new_name.split()) > 1 else "",
                source="reply_redirect",
                custom_fields={"lead_source": "reply_redirect"},
            )
            created = await ghl.create_contact(new_contact)
            logger.info(f"Created redirected contact: {created.id} → {new_email}")
            await ghl.update_contact(contact.id, GHLContact(
                custom_fields={"reply_intent": "wrong_person"}
            ))
            return f"Created new contact {new_email} from redirect."
        else:
            await ghl.update_contact(contact.id, GHLContact(
                custom_fields={"reply_intent": "wrong_person"}
            ))
            return "Marked as wrong person. No redirect provided."

    elif intent == ReplyIntent.BID_DATE_CONFIRMED:
        bid_date = reply.extracted_info.get("bid_date", "")
        await ghl.update_contact(contact.id, GHLContact(
            custom_fields={
                "reply_intent": "bid_date_confirmed",
                # bid_date stored at opportunity level
            }
        ))
        await ghl.add_tags(contact.id, [CABINET_TAGS["reply_hot"]])
        return f"Bid date confirmed{f': {bid_date}' if bid_date else ''}. Opportunity updated."

    elif intent == ReplyIntent.FUTURE_PROJECTS:
        await ghl.update_contact(contact.id, GHLContact(
            custom_fields={"reply_intent": "future_projects"}
        ))
        return "Marked for future project nurture. Will re-engage in 60-90 days."

    elif intent == ReplyIntent.ADD_TO_BID_LIST:
        await ghl.add_tags(contact.id, [CABINET_TAGS["reply_hot"]])
        await ghl.update_contact(contact.id, GHLContact(
            custom_fields={"reply_intent": "add_to_bid_list"}
        ))
        return "Added to bid list request noted. Escalating for follow-up."

    else:
        return f"Intent '{intent.value}' requires human handling."


async def handle_human_escalation(contact: GHLContact, reply: ClassifiedReply) -> str:
    """Create tasks and tags for replies needing human attention."""

    intent = reply.intent

    await ghl.add_tags(contact.id, [CABINET_TAGS["reply_needs_attention"]])
    await ghl.update_contact(contact.id, GHLContact(
        custom_fields={
            "reply_intent": intent.value,
            "last_reply_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }
    ))

    actions = {
        ReplyIntent.SEND_PLANS: "Plans request received. Review plans, create opportunity, launch estimating workflow.",
        ReplyIntent.CALL_ME: "Contact requested a call. Schedule immediately and prepare project brief.",
        ReplyIntent.CONTACT_ESTIMATOR: f"Redirect to {reply.extracted_info.get('contact_name', 'new estimator')}. Send handoff email and close old contact task.",
        ReplyIntent.VENDOR_REGISTRATION: "Vendor registration required. Gather documents and complete registration.",
        ReplyIntent.ALREADY_HAVE_SUPPLIER: "Existing supplier objection. Strategic decision — may still be worth relationship building.",
        ReplyIntent.NOT_INTERESTED: "Contact not interested. Review for possible re-engagement in 90 days.",
    }

    action = actions.get(intent, f"Manual review: {reply.summary}")
    logger.info(f"ESCALATED: {contact.full_name} — {intent.value} — {action}")
    return action


# ── Main Reply Handler ──────────────────────────────────────


async def process_reply(contact_id: str, email_body: str) -> dict:
    """Full reply processing pipeline. Called from GHL webhook."""

    contact = await ghl.get_contact(contact_id)
    if not contact or not contact.id:
        return {"error": "Contact not found", "contact_id": contact_id}

    # Build context for better classification
    context = f"""
Contact: {contact.full_name}
Title: {contact.title}
Company: {contact.company_name}
Role: {contact.custom_fields.get('contact_role_category', 'Unknown')}
Score: {contact.custom_fields.get('cabinet_opportunity_score', 'Unscored')}
Sequence: {contact.custom_fields.get('outreach_sequence', 'None')}
Previous intent: {contact.custom_fields.get('reply_intent', 'None')}
"""

    # Classify
    reply = await classify_reply(email_body, context)
    logger.info(f"Reply from {contact.full_name}: {reply.intent.value} ({reply.confidence:.0%}) — {reply.summary}")

    # Route to auto or human
    if reply.requires_human:
        action = await handle_human_escalation(contact, reply)
    else:
        action = await handle_auto_response(contact, reply)

    return {
        "contact_id": contact_id,
        "intent": reply.intent.value,
        "confidence": reply.confidence,
        "requires_human": reply.requires_human,
        "summary": reply.summary,
        "action_taken": action,
        "extracted_info": reply.extracted_info,
    }
