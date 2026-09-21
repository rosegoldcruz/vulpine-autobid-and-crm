"""
Cabinet Opportunity Scoring Engine
Scores every contact 0-100 for cabinet buying likelihood.

Produces:
- cabinet_opportunity_score (0-100)
- cabinet_score_tier (BID_NOW / HIGH_PRIORITY / DEVELOP / MONITOR / ARCHIVE / DISQUALIFIED)
- Tags applied to GHL contact
"""

from dataclasses import dataclass, field
from typing import Optional

from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl, GHLContact
from services.ghl_bridge.custom_fields import CABINET_TAGS


# ── Scoring Criteria ────────────────────────────────────────


@dataclass
class ScoreBreakdown:
    """Detailed score components for auditability."""
    active_project_multifamily_hospitality_senior_student: int = 0  # +25
    cabinets_casework_explicitly_listed: int = 0                      # +25
    estimator_pm_purchasing_precon_exec_contact: int = 0              # +15
    bid_date_within_30_days: int = 0                                  # +10
    plans_or_schedules_available: int = 0                             # +10
    project_value_or_units_above_threshold: int = 0                   # +10
    existing_relationship_or_rep_intro: int = 0                       # +15
    disqualify_wrong_industry: bool = False
    disqualify_expired_bid: bool = False
    disqualify_no_relevant_scope: bool = False
    score_reduction_architect_only: int = 0                           # reduce score
    existing_house_account: bool = False
    total: int = 0
    tier: str = ""


# ── Rule-Based Scoring ──────────────────────────────────────


def compute_rule_score(contact: GHLContact, opportunity: Optional[dict] = None) -> ScoreBreakdown:
    """
    Compute cabinet opportunity score using deterministic rules.
    This runs fast and cheap — no AI needed for the base score.
    """
    bd = ScoreBreakdown()
    cf = contact.custom_fields

    # Disqualification checks
    role = cf.get("contact_role_category", "").lower()
    company_type = cf.get("company_type", "").lower()

    disqualify_keywords = ["architect only", "design only", "engineer only", "interior designer only"]
    if any(kw in role for kw in disqualify_keywords) and "estimator" not in role and "purchasing" not in role:
        bd.score_reduction_architect_only = -20

    # Wrong industry disqualification
    wrong_industry = ["retail", "restaurant", "healthcare clinic", "dental", "auto", "software", "tech"]
    if company_type in wrong_industry and "construction" not in company_type:
        bd.disqualify_wrong_industry = True

    # ── Positive Scoring ──

    # Active project in target verticals (+25)
    target_verticals = ["multifamily", "hospitality", "senior living", "student housing", "mixed-use"]
    project_type = cf.get("project_type", "").lower()
    if any(v in project_type for v in target_verticals):
        bd.active_project_multifamily_hospitality_senior_student = 25

    # Cabinets/casework explicitly in scope (+25)
    scope = cf.get("cabinet_scope", "").lower()
    cabinet_keywords = ["cabinet", "casework", "millwork", "vanity", "countertop", "finish carpentry"]
    if any(kw in scope for kw in cabinet_keywords):
        bd.cabinets_casework_explicitly_listed = 25

    # Decision-maker role (+15)
    buyer_roles = ["estimator", "project manager", "purchasing", "preconstruction", "project executive"]
    if any(br in role for br in buyer_roles):
        bd.estimator_pm_purchasing_precon_exec_contact = 15

    # Bid date within 30 days (+10)
    # (Requires opportunity data with bid_date field)
    if opportunity:
        bid_date = opportunity.get("bid_date", "")
        if bid_date:
            from datetime import datetime, timezone, timedelta
            try:
                bd_date = datetime.fromisoformat(bid_date.replace("Z", "+00:00"))
                if bd_date.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc) + timedelta(days=30):
                    bd.bid_date_within_30_days = 10
            except (ValueError, TypeError):
                pass

    # Plans available (+10)
    if cf.get("plans_received") == "true" or cf.get("plans_received") is True:
        bd.plans_or_schedules_available = 10

    # Project value above threshold (+10)
    project_value = float(cf.get("project_value", 0) or 0)
    unit_count = int(cf.get("unit_count", 0) or 0)
    if project_value > 1_000_000 or unit_count > 50:
        bd.project_value_or_units_above_threshold = 10

    # Existing relationship (+15)
    if "rep" in cf.get("lead_source", "").lower() or "existing" in cf.get("supplier_indicators", "").lower():
        bd.existing_relationship_or_rep_intro = 15

    # Compute total
    if bd.disqualify_wrong_industry or bd.disqualify_expired_bid or bd.disqualify_no_relevant_scope:
        bd.total = 0
        bd.tier = "DISQUALIFIED"
    else:
        bd.total = (
            bd.active_project_multifamily_hospitality_senior_student
            + bd.cabinets_casework_explicitly_listed
            + bd.estimator_pm_purchasing_precon_exec_contact
            + bd.bid_date_within_30_days
            + bd.plans_or_schedules_available
            + bd.project_value_or_units_above_threshold
            + bd.existing_relationship_or_rep_intro
            + bd.score_reduction_architect_only
        )
        bd.total = max(0, min(100, bd.total))
        bd.tier = classify_tier(bd.total)

    return bd


def classify_tier(score: int) -> str:
    """Map score to tier label."""
    if score >= settings.score_bid_now:
        return "BID_NOW"
    elif score >= settings.score_high_priority:
        return "HIGH_PRIORITY"
    elif score >= settings.score_develop:
        return "DEVELOP"
    elif score >= settings.score_monitor:
        return "MONITOR"
    else:
        return "ARCHIVE"


# ── AI-Enhanced Scoring ─────────────────────────────────────


async def ai_enhanced_score(contact: GHLContact, opportunity: Optional[dict] = None) -> ScoreBreakdown:
    """
    Use AI to refine the score with contextual judgement.
    Handles edge cases that rules miss — e.g., ambiguous role titles,
    unusual project types, international contacts.
    """
    base = compute_rule_score(contact, opportunity)

    # Only call AI for borderline cases or high-value potential
    if base.total > 80 or (40 <= base.total <= 60):
        prompt = f"""
Review this cabinet opportunity scoring for a construction industry contact.

Contact: {contact.full_name}, {contact.title} at {contact.company_name}
Current Score: {base.total}/100
Current Tier: {base.tier}

Score breakdown:
- Active target-vertical project: {base.active_project_multifamily_hospitality_senior_student}
- Cabinets in scope: {base.cabinets_casework_explicitly_listed}
- Decision-maker role: {base.estimator_pm_purchasing_precon_exec_contact}
- Bid within 30 days: {base.bid_date_within_30_days}
- Plans available: {base.plans_or_schedules_available}
- Value/units above threshold: {base.project_value_or_units_above_threshold}
- Existing relationship: {base.existing_relationship_or_rep_intro}
- Architect-only reduction: {base.score_reduction_architect_only}

Should the score be adjusted based on context? Return JSON:
{{
    "adjusted_score": 0-100,
    "adjusted_tier": "BID_NOW|HIGH_PRIORITY|DEVELOP|MONITOR|ARCHIVE|DISQUALIFIED",
    "reasoning": "one sentence explaining adjustment or confirming current score",
    "confidence": 0.0-1.0
}}
"""
        messages = [
            AIMessage(role="system", content="You review cabinet opportunity scores for construction industry leads. Be precise."),
            AIMessage(role="user", content=prompt),
        ]

        try:
            result = await ai.complete_json(messages, task=TaskType.CHEAP, model=settings.cheap_model)
            adjusted = result.get("adjusted_score", base.total)
            if abs(adjusted - base.total) > 15:
                logger.info(f"AI significantly adjusted score for {contact.full_name}: {base.total} → {adjusted}")
                logger.info(f"  Reason: {result.get('reasoning', 'No reason given')}")
            base.total = max(0, min(100, adjusted))
            base.tier = result.get("adjusted_tier", base.tier)
        except Exception as e:
            logger.warning(f"AI scoring failed, using rule-based: {e}")

    return base


# ── Scoring Pipeline ────────────────────────────────────────


def tier_to_tags(tier: str) -> list[str]:
    """Convert tier to GHL tags."""
    tag_map = {
        "BID_NOW": [CABINET_TAGS["score_bid_now"]],
        "HIGH_PRIORITY": [CABINET_TAGS["score_high"]],
        "DEVELOP": [CABINET_TAGS["score_develop"]],
        "MONITOR": [CABINET_TAGS["score_monitor"]],
        "ARCHIVE": [CABINET_TAGS["score_archive"]],
        "DISQUALIFIED": [CABINET_TAGS["disqualified"]],
    }
    return tag_map.get(tier, [])


async def score_contact(contact_id: str, use_ai: bool = True) -> Optional[ScoreBreakdown]:
    """Score a single contact by ID."""
    contact = await ghl.get_contact(contact_id)
    if not contact or not contact.id:
        logger.warning(f"Contact {contact_id} not found")
        return None

    breakdown = await ai_enhanced_score(contact) if use_ai else compute_rule_score(contact)

    # Update GHL contact with score and tier
    await ghl.update_contact(contact_id, GHLContact(
        custom_fields={
            "cabinet_opportunity_score": str(breakdown.total),
            "cabinet_score_tier": breakdown.tier,
        }
    ))

    # Apply tags
    tags = tier_to_tags(breakdown.tier)
    if tags:
        await ghl.add_tags(contact_id, tags)

    logger.info(f"Scored {contact.full_name}: {breakdown.total}/100 → {breakdown.tier}")
    return breakdown


async def score_all_unscored(limit: int = 500, use_ai: bool = True) -> dict:
    """
    Score all contacts that don't have a cabinet score yet.
    Processes in batches to avoid GHL rate limits.
    """
    # Search for contacts without cabinet score, excluding those already tagged
    # GHL search doesn't support "field is empty" natively, so we search all unscored
    results = {"scored": 0, "skipped": 0, "disqualified": 0, "errors": 0}

    # Get all contacts (paginated)
    all_contacts = await ghl.search_contacts(limit=limit)

    for contact in all_contacts:
        existing_score = contact.custom_fields.get("cabinet_opportunity_score", "")
        if existing_score and int(existing_score) > 0:
            results["skipped"] += 1
            continue

        try:
            breakdown = await score_contact(contact.id, use_ai=use_ai)
            if breakdown:
                if breakdown.tier == "DISQUALIFIED":
                    results["disqualified"] += 1
                else:
                    results["scored"] += 1
        except Exception as e:
            logger.error(f"Failed to score {contact.id}: {e}")
            results["errors"] += 1

    logger.info(f"Batch scoring complete: {results}")
    return results
