"""
Vapi Voice Agent Integration
Outbound AI-powered phone calls for high-priority cabinet opportunities.

Uses Vapi's API to:
- Trigger outbound calls to BID_NOW and HIGH_PRIORITY contacts
- AI agent handles the conversation naturally
- Post-call: extract intent, update GHL, create tasks
"""

import httpx
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl, GHLContact
from services.ghl_bridge.custom_fields import CABINET_TAGS


# ── Data Classes ────────────────────────────────────────────


@dataclass
class CallResult:
    call_id: str
    contact_id: str
    status: str                     # completed, no_answer, busy, failed
    duration_seconds: int
    summary: str
    intent: str
    action_items: list[str]
    recording_url: str
    cost: float


# ── Vapi Agent Definition ───────────────────────────────────


VULPINE_VOICE_AGENT_SYSTEM_PROMPT = """You are an outreach specialist calling on behalf of Vulpine, a commercial cabinet supplier.

Your name is Alex. You sound professional, direct, and helpful — not salesy.

CONTEXT ABOUT VULPINE:
- We supply cabinet packages for multifamily, hospitality, senior living, student housing, and commercial projects
- We provide full estimating and takeoff services
- We're supplier-agnostic — we find the best pricing from multiple manufacturers
- We deliver nationwide

YOUR GOAL FOR THIS CALL:
1. Confirm you're speaking with the right person for cabinet procurement
2. Mention the specific project or company context if you have it
3. Ask ONE clear question: are they accepting cabinet pricing for any current or upcoming projects?
4. If yes: get the best email to send plans/capabilities and the bid date
5. If no: ask if they're open to staying connected for future opportunities
6. Keep the call under 3 minutes

RULES:
- Never pressure or hard-sell
- If they say no, thank them and end the call gracefully
- If they redirect you to someone else, get that person's name and contact info
- Take detailed notes on everything they say
- If they mention a specific project, note the name, location, unit count, bid date
- Be conversational, not scripted

At the end of the call, summarize what was discussed and the next step."""


async def create_vapi_agent() -> str:
    """Create or get the Vulpine voice agent in Vapi. Returns agent ID."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Check if agent already exists
        resp = await client.get(
            "https://api.vapi.ai/assistant",
            headers={"Authorization": f"Bearer {settings.vapi_private_api_key}"},
        )
        if resp.status_code == 200:
            assistants = resp.json()
            for a in assistants if isinstance(assistants, list) else []:
                if a.get("name") == "Vulpine Outreach Agent":
                    logger.info(f"Vapi agent already exists: {a['id']}")
                    return a["id"]

        # Create new agent
        payload = {
            "name": "Vulpine Outreach Agent",
            "model": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": VULPINE_VOICE_AGENT_SYSTEM_PROMPT}
                ],
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "21m00Tcm4TlvDq8ikWAM",  # Professional voice
            },
            "firstMessage": "Hi, this is Alex with Vulpine. Is this {{contact.first_name}}?",
            "maxDurationSeconds": 300,
            "endCallMessage": "Thanks for your time. I'll follow up via email with the information we discussed.",
            "transcriber": {
                "provider": "deepgram",
                "language": "en-US",
            },
        }

        resp = await client.post(
            "https://api.vapi.ai/assistant",
            headers={
                "Authorization": f"Bearer {settings.vapi_private_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        agent_id = resp.json()["id"]
        logger.info(f"Created Vapi agent: {agent_id}")
        return agent_id


# ── Outbound Call ───────────────────────────────────────────


async def make_outbound_call(
    contact: GHLContact,
    agent_id: str,
    project_context: Optional[dict] = None,
) -> CallResult:
    """Initiate an outbound call via Vapi."""

    if not contact.phone:
        return CallResult(
            call_id="",
            contact_id=contact.id,
            status="failed",
            duration_seconds=0,
            summary="No phone number",
            intent="",
            action_items=[],
            recording_url="",
            cost=0,
        )

    # Build dynamic context for the agent
    dynamic_vars = {
        "contact.first_name": contact.first_name or "there",
        "contact.company": contact.company_name,
        "contact.role": contact.title,
    }

    if project_context:
        dynamic_vars["project.name"] = project_context.get("project_name", "")
        dynamic_vars["project.type"] = project_context.get("project_type", "")
        dynamic_vars["project.bid_date"] = project_context.get("bid_date", "")

    payload = {
        "assistantId": agent_id,
        "customer": {
            "number": contact.phone,
            "name": contact.full_name,
        },
        "phoneNumberId": settings.vapi_phone_number_id,
        "assistantOverrides": {
            "variableValues": dynamic_vars,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.vapi.ai/call",
            headers={
                "Authorization": f"Bearer {settings.vapi_private_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        if resp.status_code >= 400:
            logger.error(f"Vapi call failed: {resp.status_code} {resp.text}")
            return CallResult(
                call_id="",
                contact_id=contact.id,
                status="failed",
                duration_seconds=0,
                summary=f"API error: {resp.status_code}",
                intent="",
                action_items=[],
                recording_url="",
                cost=0,
            )

        data = resp.json()
        return CallResult(
            call_id=data.get("id", ""),
            contact_id=contact.id,
            status="initiated",
            duration_seconds=0,
            summary="",
            intent="",
            action_items=[],
            recording_url="",
            cost=0,
        )


# ── Post-Call Analysis ──────────────────────────────────────


async def analyze_call_transcript(transcript: str, contact: GHLContact) -> dict:
    """Analyze a completed call transcript to extract intent and actions."""

    prompt = f"""
Analyze this outbound sales call transcript for a cabinet supplier (Vulpine).

Contact: {contact.full_name}, {contact.title} at {contact.company_name}

Transcript:
---
{transcript}
---

Return JSON:
{{
    "call_outcome": "interested|not_interested|redirected|voicemail|no_answer|follow_up",
    "contact_confirmed": true/false,
    "procurement_contact": "name if mentioned",
    "procurement_email": "email if mentioned",
    "project_mentioned": "project name if any",
    "project_details": {{
        "name": "",
        "type": "",
        "unit_count": 0,
        "bid_date": "",
        "cabinet_scope": ""
    }},
    "next_step": "what should happen next",
    "urgency": "high|medium|low",
    "sentiment": "positive|neutral|negative"
}}
"""
    messages = [
        AIMessage(role="system", content="You analyze sales call transcripts. Be precise. Extract only what was actually said."),
        AIMessage(role="user", content=prompt),
    ]

    try:
        return await ai.complete_json(messages, task=TaskType.CHEAP, model=settings.cheap_model)
    except Exception as e:
        logger.error(f"Call transcript analysis failed: {e}")
        return {"call_outcome": "unknown", "next_step": "Manual review required"}


# ── Voice Outreach Campaign ─────────────────────────────────


async def voice_outreach_to_tier(tier: str = "BID_NOW", max_calls: int = 10) -> dict:
    """Make outbound calls to contacts in a scoring tier."""

    agent_id = await create_vapi_agent()

    tier_tag = CABINET_TAGS.get(
        {"BID_NOW": "score_bid_now", "HIGH_PRIORITY": "score_high"}.get(tier, "score_bid_now"),
        CABINET_TAGS["score_bid_now"],
    )

    contacts = await ghl.search_contacts(limit=max_calls * 2)
    results = {"calls_initiated": 0, "skipped_no_phone": 0, "skipped_tagged": 0, "failed": 0}

    for contact in contacts:
        if results["calls_initiated"] >= max_calls:
            break

        if tier_tag not in contact.tags:
            continue

        if not contact.phone:
            results["skipped_no_phone"] += 1
            continue

        try:
            call_result = await make_outbound_call(contact, agent_id)
            if call_result.status == "initiated":
                results["calls_initiated"] += 1
                await ghl.add_tags(contact.id, ["VOICE_OUTREACH_SENT"])
                logger.info(f"Voice call initiated: {contact.full_name} → {contact.phone}")
            else:
                results["failed"] += 1
        except Exception as e:
            logger.error(f"Voice call failed for {contact.id}: {e}")
            results["failed"] += 1

    logger.info(f"Voice campaign ({tier}): {results}")
    return results
