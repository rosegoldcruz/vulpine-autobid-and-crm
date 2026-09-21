#!/usr/bin/env python3
"""
Vulpine Daily Briefing Agent
Run every morning. Tells you everything you need to know.

Usage: python scripts/daily_briefing.py
"""

import asyncio
import sys
sys.path.insert(0, "/opt/vulpine-engine")

from datetime import datetime, timezone, timedelta
from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl


async def daily_briefing() -> str:
    """Generate the morning briefing."""

    logger.info("Generating daily briefing...")

    # Collect data from GHL
    try:
        contacts = await ghl.search_contacts(limit=500)

        # Count by tier
        tiers = {"BID_NOW": 0, "HIGH_PRIORITY": 0, "DEVELOP": 0, "MONITOR": 0, "ARCHIVE": 0, "DISQUALIFIED": 0}
        unscored = 0
        needs_attention = 0
        hot_replies = 0

        for c in contacts:
            score = c.custom_fields.get("cabinet_opportunity_score", "")
            tier = c.custom_fields.get("cabinet_score_tier", "")
            intent = c.custom_fields.get("reply_intent", "")
            seq = c.custom_fields.get("outreach_sequence", "")

            if tier in tiers:
                tiers[tier] += 1
            elif not score:
                unscored += 1

            if intent in ("send_plans", "call_me", "contact_estimator", "vendor_registration", "add_to_bid_list"):
                hot_replies += 1
            if intent in ("send_plans", "call_me", "vendor_registration", "already_have_supplier"):
                needs_attention += 1

    except Exception as e:
        logger.error(f"Failed to fetch GHL data: {e}")
        contacts = []
        tiers = {}
        unscored = 0
        needs_attention = 0
        hot_replies = 0

    # Build the briefing context
    context = f"""
VULPINE CABINET REVENUE ENGINE — DAILY BRIEFING
{datetime.now(timezone.utc).strftime('%A, %B %d, %Y')}
{'=' * 60}

PIPELINE:
- BID NOW: {tiers.get('BID_NOW', 0)} contacts
- HIGH PRIORITY: {tiers.get('HIGH_PRIORITY', 0)} contacts
- DEVELOP: {tiers.get('DEVELOP', 0)} contacts
- MONITOR: {tiers.get('MONITOR', 0)} contacts
- ARCHIVE: {tiers.get('ARCHIVE', 0)} contacts
- Unscored: {unscored} contacts
- Hot replies needing attention: {hot_replies}

REQUIRED DECISIONS TODAY:
1. Review and approve any final pricing
2. Check high-priority replies (plans received, call requests)
3. Verify bid deadlines for next 7 days
4. Review supplier pricing comparisons
5. Approve any proposals before submission
"""

    # Use AI to add intelligence
    prompt = f"""
Based on this pipeline data, generate a concise executive briefing. Include:

{context}

Add:
1. Top 3 things that need attention today
2. Any concerning trends
3. One recommended action

Keep it direct. No fluff. This is for the business owner who wants actionable intelligence.
"""
    messages = [
        AIMessage(role="system", content="You generate executive briefings for a commercial cabinet supplier. Be direct and actionable."),
        AIMessage(role="user", content=prompt),
    ]

    try:
        response = await ai.complete(messages, task=TaskType.REASONING, max_tokens=500)
        ai_insight = response.content
    except Exception as e:
        logger.error(f"AI briefing failed: {e}")
        ai_insight = "AI analysis unavailable — check API keys."

    # Assemble final briefing
    briefing = f"""
🦊 VULPINE DAILY BRIEFING
{'=' * 50}
{datetime.now().strftime('%A, %B %d, %Y — %I:%M %p MT')}
{'=' * 50}

{ai_insight}

{'─' * 50}
PIPELINE SUMMARY:
  🔴 BID NOW:          {tiers.get('BID_NOW', 0):>4}
  🟠 HIGH PRIORITY:     {tiers.get('HIGH_PRIORITY', 0):>4}
  🟡 DEVELOP:           {tiers.get('DEVELOP', 0):>4}
  🔵 MONITOR:           {tiers.get('MONITOR', 0):>4}
  ⚪ ARCHIVE:           {tiers.get('ARCHIVE', 0):>4}
  ❓ UNSCORED:          {unscored:>4}
{'─' * 50}
  📬 Hot Replies:       {hot_replies:>4}
  ⚠️  Needs Attention:  {needs_attention:>4}
{'─' * 50}

FIVE DECISIONS NEEDED:
  1. Final pricing approval (check pending)
  2. High-priority reply review
  3. Bid deadline check (next 7 days)
  4. Supplier pricing comparison review
  5. Proposal approval before submission

🤖 Engine status: Operational
"""

    return briefing


if __name__ == "__main__":
    briefing = asyncio.run(daily_briefing())
    print(briefing)
