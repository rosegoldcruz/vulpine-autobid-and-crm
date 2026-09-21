"""
Audit System.
Records actor, timestamp, action, entity, old/new values, reason for every action.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from services.auto_bid.models import AuditEvent


async def record_event(
    db: AsyncSession,
    auto_bid_project_id: Optional[uuid.UUID],
    actor: str,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    old_values: dict = None,
    new_values: dict = None,
    reason: str = "",
    meta: dict = None,
) -> AuditEvent:
    """Record an audit event."""
    event = AuditEvent(
        auto_bid_project_id=auto_bid_project_id,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        reason=reason,
        meta=meta or {},
    )
    db.add(event)
    await db.flush()
    logger.debug(f"Audit: {actor} {action} {entity_type} {entity_id}")
    return event


async def get_audit_trail(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditEvent]:
    """Get audit trail for a project."""
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.auto_bid_project_id == auto_bid_project_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())