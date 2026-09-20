"""
SKU Intelli — catalog management, alias matching, and BOM-to-SKU mapping.
AI may recommend SKUs but NEVER invent them. Unmatched lines become exceptions.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, text
from thefuzz import fuzz

from services.auto_bid.models import (
    SKUCatalog, SKUAlias, SKUMapping, SKUMappingHistory,
    BOMLine, BOMVersion, Exception as ExceptionModel, AutoBidProject,
)


async def search_sku_catalog(
    db: AsyncSession,
    query: str = "",
    cabinet_type: str = "",
    manufacturer: str = "",
    limit: int = 50,
) -> List[SKUCatalog]:
    """Search the SKU catalog."""
    stmt = select(SKUCatalog).where(SKUCatalog.is_active == True)

    if query:
        stmt = stmt.where(
            or_(
                SKUCatalog.sku_code.ilike(f"%{query}%"),
                SKUCatalog.manufacturer.ilike(f"%{query}%"),
                SKUCatalog.product_line.ilike(f"%{query}%"),
                SKUCatalog.model.ilike(f"%{query}%"),
            )
        )
    if cabinet_type:
        stmt = stmt.where(SKUCatalog.cabinet_type.ilike(f"%{cabinet_type}%"))
    if manufacturer:
        stmt = stmt.where(SKUCatalog.manufacturer.ilike(f"%{manufacturer}%"))

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_sku_by_code(db: AsyncSession, sku_code: str) -> Optional[SKUCatalog]:
    """Get a SKU by its code."""
    result = await db.execute(
        select(SKUCatalog).where(SKUCatalog.sku_code == sku_code)
    )
    return result.scalar_one_or_none()


async def find_sku_by_alias(db: AsyncSession, alias_text: str) -> Optional[SKUCatalog]:
    """Find a SKU by an alias."""
    result = await db.execute(
        select(SKUAlias)
        .where(SKUAlias.alias.ilike(f"%{alias_text}%"))
        .limit(1)
    )
    alias = result.scalar_one_or_none()
    if alias:
        result = await db.execute(
            select(SKUCatalog).where(SKUCatalog.id == alias.sku_id)
        )
        return result.scalar_one_or_none()
    return None


async def match_bom_line_to_sku(
    db: AsyncSession,
    bom_line: BOMLine,
    auto_bid_project_id: uuid.UUID,
) -> Tuple[Optional[SKUCatalog], float, str]:
    """
    Attempt to match a BOM line to a SKU in the catalog.
    Returns (sku, confidence, match_method).

    Matching strategy (in order of preference):
    1. Exact code match
    2. Alias match
    3. Dimension + type match
    4. Fuzzy text match on cabinet_type
    """
    # Strategy 1: No SKU code on the line, skip exact
    # (In the future, if design_intent contains a SKU code, try exact match)

    # Strategy 2: Alias match — search aliases for the design_intent text
    if bom_line.design_intent:
        sku = await find_sku_by_alias(db, bom_line.design_intent[:100])
        if sku:
            return (sku, 0.90, "alias_match")

    # Strategy 3: Dimension + type match
    if bom_line.cabinet_type:
        stmt = select(SKUCatalog).where(
            SKUCatalog.is_active == True,
            SKUCatalog.cabinet_type.ilike(f"%{bom_line.cabinet_type}%"),
        )
        if bom_line.width:
            stmt = stmt.where(SKUCatalog.width == bom_line.width)
        if bom_line.height:
            stmt = stmt.where(SKUCatalog.height == bom_line.height)

        result = await db.execute(stmt.limit(5))
        candidates = list(result.scalars().all())
        if candidates:
            best = candidates[0]
            confidence = 0.75 if len(candidates) == 1 else 0.60
            return (best, confidence, "dimension_match")

    # Strategy 4: Fuzzy text match
    if bom_line.cabinet_type:
        result = await db.execute(
            select(SKUCatalog).where(
                SKUCatalog.is_active == True,
                SKUCatalog.cabinet_type.isnot(None),
            ).limit(200)
        )
        all_skus = list(result.scalars().all())

        best_sku = None
        best_score = 0
        for sku in all_skus:
            if sku.cabinet_type:
                score = fuzz.ratio(bom_line.cabinet_type.lower(), sku.cabinet_type.lower())
                if score > best_score:
                    best_score = score
                    best_sku = sku

        if best_sku and best_score >= 60:
            confidence = best_score / 100.0 * 0.5  # Low confidence for fuzzy
            return (best_sku, confidence, "ai_recommendation")  # AI recommended but uncertain

    return (None, 0.0, "no_match")


async def map_skus_for_bom(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    bom_version_id: uuid.UUID,
) -> dict:
    """
    Map all BOM lines to SKUs. Creates exceptions for unmatched lines.
    AI may recommend but NEVER invents SKUs.
    """
    # Get all BOM lines
    result = await db.execute(
        select(BOMLine)
        .where(BOMLine.bom_version_id == bom_version_id)
        .order_by(BOMLine.line_number)
    )
    lines = list(result.scalars().all())

    mapped_count = 0
    exception_count = 0

    for line in lines:
        sku, confidence, method = await match_bom_line_to_sku(
            db, line, auto_bid_project_id
        )

        if sku:
            # Create SKU mapping
            mapping = SKUMapping(
                auto_bid_project_id=auto_bid_project_id,
                bom_line_id=line.id,
                sku_id=sku.id,
                match_confidence=confidence,
                match_method=method,
                is_ai_recommendation=(method == "ai_recommendation"),
                is_human_approved=False,
            )
            db.add(mapping)

            # Update BOM line
            line.mapped_sku_id = sku.id
            line.sku_confidence = confidence
            mapped_count += 1
        else:
            # Create exception
            exc = ExceptionModel(
                auto_bid_project_id=auto_bid_project_id,
                bom_line_id=line.id,
                exception_type="no_sku_match",
                severity="WARNING",
                title=f"No SKU match for line {line.line_number}: {line.cabinet_type or 'Unknown'}",
                description=f"Could not find a matching SKU for: {line.design_intent or line.cabinet_type or 'N/A'}",
                design_intent=line.design_intent,
                cabinet_type=line.cabinet_type,
                required_dimensions={
                    "width": float(line.width) if line.width else None,
                    "height": float(line.height) if line.height else None,
                    "depth": float(line.depth) if line.depth else None,
                } if (line.width or line.height or line.depth) else None,
                required_finish=line.finish,
                status="OPEN",
            )
            db.add(exc)

            line.is_exception = True
            line.exception_id = exc.id
            exception_count += 1

    await db.flush()

    logger.info(
        f"SKU mapping complete: {mapped_count} mapped, {exception_count} exceptions"
    )
    return {
        "total_lines": len(lines),
        "mapped": mapped_count,
        "exceptions": exception_count,
    }


async def manual_map_sku(
    db: AsyncSession,
    bom_line_id: uuid.UUID,
    sku_id: uuid.UUID,
    actor: str = "mike",
    reason: str = "",
) -> SKUMapping:
    """Manually map a BOM line to a SKU (human override)."""
    # Get existing mapping
    result = await db.execute(
        select(SKUMapping).where(SKUMapping.bom_line_id == bom_line_id)
    )
    existing = result.scalar_one_or_none()

    # Get BOM line
    result = await db.execute(
        select(BOMLine).where(BOMLine.id == bom_line_id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise ValueError(f"BOM line {bom_line_id} not found")

    if existing:
        # Record history
        history = SKUMappingHistory(
            sku_mapping_id=existing.id,
            bom_line_id=bom_line_id,
            old_sku_id=existing.sku_id,
            new_sku_id=sku_id,
            old_confidence=existing.match_confidence,
            new_confidence=1.0,
            change_reason=reason,
            actor=actor,
        )
        db.add(history)

        # Update mapping
        existing.sku_id = sku_id
        existing.match_confidence = 1.0
        existing.match_method = "manual"
        existing.is_human_approved = True
        existing.approved_by = actor
        existing.approved_at = datetime.now(timezone.utc)
        mapping = existing
    else:
        mapping = SKUMapping(
            auto_bid_project_id=line.auto_bid_project_id,
            bom_line_id=bom_line_id,
            sku_id=sku_id,
            match_confidence=1.0,
            match_method="manual",
            is_ai_recommendation=False,
            is_human_approved=True,
            approved_by=actor,
            approved_at=datetime.now(timezone.utc),
            notes=reason,
        )
        db.add(mapping)

    # Update BOM line
    line.mapped_sku_id = sku_id
    line.sku_confidence = 1.0
    line.is_exception = False

    await db.flush()
    logger.info(f"Manual SKU mapping: line {bom_line_id} → SKU {sku_id} by {actor}")
    return mapping