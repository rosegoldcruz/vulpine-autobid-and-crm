"""
Human Value Engineering — Mike's review workspace.
Persistent decisions with before/after history.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from services.auto_bid.models import (
    ValueEngineeringDecision, BOMLine, CabinetRequirement,
    PricingLine, SKUCatalog,
)


async def create_ve_decision(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    title: str,
    description: str,
    ve_type: str = "substitution",
    bom_line_id: uuid.UUID = None,
    cabinet_requirement_id: uuid.UUID = None,
    before_description: str = None,
    before_sku_id: uuid.UUID = None,
    before_quantity: int = None,
    before_cost: float = None,
    after_description: str = None,
    after_sku_id: uuid.UUID = None,
    after_quantity: int = None,
    after_cost: float = None,
    rationale: str = None,
) -> ValueEngineeringDecision:
    """Create a new value engineering decision."""
    cost_savings = None
    if before_cost is not None and after_cost is not None:
        cost_savings = float(before_cost) - float(after_cost)

    ve = ValueEngineeringDecision(
        auto_bid_project_id=auto_bid_project_id,
        bom_line_id=bom_line_id,
        cabinet_requirement_id=cabinet_requirement_id,
        title=title,
        description=description,
        ve_type=ve_type,
        before_description=before_description,
        before_sku_id=before_sku_id,
        before_quantity=before_quantity,
        before_cost=before_cost,
        after_description=after_description,
        after_sku_id=after_sku_id,
        after_quantity=after_quantity,
        after_cost=after_cost,
        cost_savings=cost_savings,
        rationale=rationale,
        status="PROPOSED",
    )
    db.add(ve)
    await db.flush()
    logger.info(f"Created VE decision: {title}")
    return ve


async def approve_ve_decision(
    db: AsyncSession,
    ve_id: uuid.UUID,
    decided_by: str = "mike",
    decision_notes: str = "",
) -> ValueEngineeringDecision:
    """Approve a VE decision."""
    result = await db.execute(
        select(ValueEngineeringDecision).where(ValueEngineeringDecision.id == ve_id)
    )
    ve = result.scalar_one_or_none()
    if not ve:
        raise ValueError(f"VE decision {ve_id} not found")

    ve.status = "APPROVED"
    ve.decided_by = decided_by
    ve.decided_at = datetime.now(timezone.utc)
    ve.decision_notes = decision_notes

    # Apply the VE change to the BOM line if applicable
    if ve.bom_line_id and ve.after_sku_id:
        result = await db.execute(
            select(BOMLine).where(BOMLine.id == ve.bom_line_id)
        )
        line = result.scalar_one_or_none()
        if line:
            line.mapped_sku_id = ve.after_sku_id
            if ve.after_quantity:
                line.quantity = ve.after_quantity

    await db.flush()
    logger.info(f"VE decision approved: {ve.title} by {decided_by}")
    return ve


async def reject_ve_decision(
    db: AsyncSession,
    ve_id: uuid.UUID,
    decided_by: str = "mike",
    decision_notes: str = "",
) -> ValueEngineeringDecision:
    """Reject a VE decision."""
    result = await db.execute(
        select(ValueEngineeringDecision).where(ValueEngineeringDecision.id == ve_id)
    )
    ve = result.scalar_one_or_none()
    if not ve:
        raise ValueError(f"VE decision {ve_id} not found")

    ve.status = "REJECTED"
    ve.decided_by = decided_by
    ve.decided_at = datetime.now(timezone.utc)
    ve.decision_notes = decision_notes

    await db.flush()
    return ve


async def get_ve_decisions(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
) -> List[ValueEngineeringDecision]:
    """Get all VE decisions for a project."""
    result = await db.execute(
        select(ValueEngineeringDecision)
        .where(ValueEngineeringDecision.auto_bid_project_id == auto_bid_project_id)
        .order_by(ValueEngineeringDecision.created_at.desc())
    )
    return list(result.scalars().all())