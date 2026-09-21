"""
Raw BOM Engine.
Creates versioned, immutable BOMs from cabinet requirements with full provenance.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from services.auto_bid.models import (
    CabinetRequirement, BOMVersion, BOMLine, AutoBidProject,
)


async def generate_bom(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    cabinet_requirements: List[CabinetRequirement],
    generated_by: str = "engine",
) -> BOMVersion:
    """
    Generate a new BOM version from cabinet requirements.
    Each BOM line links back to its cabinet requirement with provenance.
    """
    # Determine next version number
    result = await db.execute(
        select(func.max(BOMVersion.version_number))
        .where(BOMVersion.auto_bid_project_id == auto_bid_project_id)
    )
    max_version = result.scalar()
    next_version = (max_version or 0) + 1

    # Create BOM version
    bom_version = BOMVersion(
        auto_bid_project_id=auto_bid_project_id,
        version_number=next_version,
        status="DRAFT",
        total_lines=len(cabinet_requirements),
        total_cabinets=sum(r.quantity or 0 for r in cabinet_requirements),
        generated_by=generated_by,
        evidence_count=sum(len(r.evidence_ids or []) for r in cabinet_requirements),
        confidence_score=None,  # Will be calculated
    )
    db.add(bom_version)
    await db.flush()

    # Create BOM lines
    lines = []
    for idx, req in enumerate(cabinet_requirements, start=1):
        line = BOMLine(
            bom_version_id=bom_version.id,
            auto_bid_project_id=auto_bid_project_id,
            line_number=idx,
            design_intent=req.design_intent,
            room_label=req.room_label,
            unit_type=req.unit_type,
            floor_level=req.floor_level,
            cabinet_type=req.cabinet_type,
            quantity=req.quantity or 0,
            width=req.width,
            height=req.height,
            depth=req.depth,
            finish=req.finish,
            hardware=req.hardware,
            countertop_spec=req.countertop_spec,
            cabinet_requirement_id=req.id,
            evidence_ids=req.evidence_ids,
            page_numbers=req.page_numbers,
            is_exception=False,
        )
        db.add(line)
        lines.append(line)

    await db.flush()

    # Update requirement status
    for req in cabinet_requirements:
        req.status = "MAPPED"

    await db.flush()

    logger.info(
        f"Generated BOM v{next_version}: {len(lines)} lines, "
        f"{bom_version.total_cabinets} cabinets"
    )
    return bom_version


async def get_bom_lines(
    db: AsyncSession,
    bom_version_id: uuid.UUID,
) -> List[BOMLine]:
    """Get all lines for a BOM version, ordered by line number."""
    result = await db.execute(
        select(BOMLine)
        .where(BOMLine.bom_version_id == bom_version_id)
        .order_by(BOMLine.line_number)
    )
    return list(result.scalars().all())


async def approve_bom(
    db: AsyncSession,
    bom_version_id: uuid.UUID,
    approved_by: str = "mike",
) -> BOMVersion:
    """Approve a BOM version, superseding any previous approved version."""
    result = await db.execute(
        select(BOMVersion).where(BOMVersion.id == bom_version_id)
    )
    bom = result.scalar_one_or_none()
    if not bom:
        raise ValueError(f"BOM version {bom_version_id} not found")

    # Supersede previous approved versions
    prev_result = await db.execute(
        select(BOMVersion)
        .where(
            BOMVersion.auto_bid_project_id == bom.auto_bid_project_id,
            BOMVersion.status == "APPROVED",
            BOMVersion.id != bom_version_id,
        )
    )
    for prev in prev_result.scalars():
        prev.status = "SUPERSEDED"

    bom.status = "APPROVED"
    bom.approved_by = approved_by
    bom.approved_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info(f"BOM v{bom.version_number} approved by {approved_by}")
    return bom