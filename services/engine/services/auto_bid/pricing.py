"""
Deterministic Pricing Engine.
Code-driven, NOT LLM. Versioned. Missing cost = BLOCKER.
LLMs must NEVER perform pricing arithmetic — all math is done here in Python.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from services.auto_bid.models import (
    PricingVersion, PricingLine, BOMVersion, BOMLine,
    SKUCatalog, SKUMapping, AutoBidProject,
)
from shared.config import settings


def quantize(value, places: int = 2) -> Decimal:
    """Quantize a value to the specified decimal places."""
    d = Decimal(str(value))
    return d.quantize(Decimal(f'0.{"0" * places}'), rounding=ROUND_HALF_UP)


def calculate_line_pricing(
    quantity: int,
    unit_cost: Optional[float],
    freight_per_unit: float = 0,
    duties_percent: float = 0,
    tax_percent: float = 0,
    storage_per_unit: float = 0,
    delivery_per_unit: float = 0,
    installation_per_unit: float = 0,
    contingency_percent: float = 3.0,
    other_per_unit: float = 0,
) -> dict:
    """
    Calculate pricing for a single line item.
    All arithmetic is deterministic — no LLM involved.

    Returns a dict with all cost components.
    """
    qty = Decimal(str(quantity))

    # If no cost, everything is zero and it's a blocker
    if unit_cost is None or unit_cost == 0:
        return {
            "unit_cost": Decimal("0"),
            "extended_product_cost": Decimal("0"),
            "freight": Decimal("0"),
            "duties_tariffs": Decimal("0"),
            "tax": Decimal("0"),
            "storage": Decimal("0"),
            "delivery": Decimal("0"),
            "installation": Decimal("0"),
            "contingency": Decimal("0"),
            "other_costs": Decimal("0"),
            "line_landed_cost": Decimal("0"),
            "has_cost": False,
        }

    uc = Decimal(str(unit_cost))

    # Product cost
    extended_product_cost = (uc * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Freight
    freight = (Decimal(str(freight_per_unit)) * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Duties (% of product cost)
    duties_tariffs = (extended_product_cost * Decimal(str(duties_percent)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Tax (% of product cost)
    tax = (extended_product_cost * Decimal(str(tax_percent)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Storage
    storage = (Decimal(str(storage_per_unit)) * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Delivery
    delivery = (Decimal(str(delivery_per_unit)) * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Installation
    installation = (Decimal(str(installation_per_unit)) * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Contingency (% of subtotal)
    subtotal = extended_product_cost + freight + duties_tariffs + tax + storage + delivery + installation
    contingency = (subtotal * Decimal(str(contingency_percent)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Other
    other_costs = (Decimal(str(other_per_unit)) * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Landed cost
    line_landed_cost = (subtotal + contingency + other_costs).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return {
        "unit_cost": uc,
        "extended_product_cost": extended_product_cost,
        "freight": freight,
        "duties_tariffs": duties_tariffs,
        "tax": tax,
        "storage": storage,
        "delivery": delivery,
        "installation": installation,
        "contingency": contingency,
        "other_costs": other_costs,
        "line_landed_cost": line_landed_cost,
        "has_cost": True,
    }


def calculate_version_pricing(
    line_results: List[dict],
    desired_margin_percent: float = 18.0,
    rep_commission_percent: float = 0.0,
) -> dict:
    """
    Calculate version-level pricing from line results.
    Determines sell price from landed cost + desired margin.

    Formula:
        sell_price = landed_cost / (1 - margin_percent/100)
        gross_profit = sell_price - landed_cost
        gross_margin = gross_profit / sell_price * 100
        rep_commission = sell_price * commission_percent / 100
        vulpine_retained = gross_profit - rep_commission
    """
    # Sum all line costs
    totals = {
        "total_product_cost": Decimal("0"),
        "total_freight": Decimal("0"),
        "total_duties_tariffs": Decimal("0"),
        "total_tax": Decimal("0"),
        "total_storage": Decimal("0"),
        "total_delivery": Decimal("0"),
        "total_installation": Decimal("0"),
        "total_contingency": Decimal("0"),
        "total_other_costs": Decimal("0"),
    }

    for lr in line_results:
        for key in totals:
            if key.replace("total_", "") in lr:
                totals[key] += lr[key.replace("total_", "")]

    # Quantize totals
    for key in totals:
        totals[key] = totals[key].quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    landed_cost = sum(totals.values()).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Sell price calculation
    margin = Decimal(str(desired_margin_percent))
    if margin >= 100:
        margin = Decimal("99")  # Cap at 99%

    sell_price = (landed_cost / (Decimal("1") - margin / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gross_profit = (sell_price - landed_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gross_margin = ((gross_profit / sell_price * Decimal("100")) if sell_price > 0 else Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Commission
    comm_percent = Decimal(str(rep_commission_percent))
    rep_commission = (sell_price * comm_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    vulpine_retained = (gross_profit - rep_commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Guardrail checks
    min_margin = Decimal(str(settings.min_gross_margin_percent))
    min_comm_profit = Decimal(str(settings.min_commissionable_profit))

    meets_margin_floor = gross_margin >= min_margin
    meets_commission_floor = vulpine_retained >= min_comm_profit

    # Risk flags
    risk_flags = []
    block_reasons = []
    is_blocked = False

    # Check for missing costs
    missing_cost_lines = sum(1 for lr in line_results if not lr.get("has_cost", False))
    if missing_cost_lines > 0:
        risk_flags.append(f"missing_cost_on_{missing_cost_lines}_lines")
        block_reasons.append(f"{missing_cost_lines} line(s) have no cost data — pricing is blocked")
        is_blocked = True

    # Check margin floor
    if not meets_margin_floor and not is_blocked:
        risk_flags.append(f"margin_below_floor_{gross_margin}%_vs_{min_margin}%")

    # Check commission floor
    if not meets_commission_floor and not is_blocked:
        risk_flags.append(f"commission_profit_below_floor")

    if landed_cost == 0:
        block_reasons.append("Total landed cost is zero — no pricing data available")
        is_blocked = True

    return {
        **totals,
        "landed_cost": landed_cost,
        "desired_margin_percent": margin,
        "suggested_sell_price": sell_price,
        "gross_profit": gross_profit,
        "gross_margin_percent": gross_margin,
        "rep_commission_percent": comm_percent,
        "rep_commission_amount": rep_commission,
        "vulpine_retained_profit": vulpine_retained,
        "meets_margin_floor": meets_margin_floor,
        "meets_commission_floor": meets_commission_floor,
        "risk_flags": risk_flags,
        "is_blocked": is_blocked,
        "block_reasons": block_reasons,
    }


async def generate_pricing(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    bom_version_id: uuid.UUID,
    desired_margin_percent: float = 18.0,
    rep_commission_percent: float = 0.0,
    contingency_percent: float = 3.0,
) -> PricingVersion:
    """
    Generate a pricing version from a BOM version.
    Looks up SKU costs, calculates line and version totals.
    Missing cost data = BLOCKER (line and version level).
    """
    # Get BOM lines
    result = await db.execute(
        select(BOMLine)
        .where(BOMLine.bom_version_id == bom_version_id)
        .order_by(BOMLine.line_number)
    )
    lines = list(result.scalars().all())

    if not lines:
        # Create empty pricing version
        version_calc = calculate_version_pricing([], desired_margin_percent, rep_commission_percent)
    else:
        # Get SKU costs for all mapped lines
        sku_ids = [line.mapped_sku_id for line in lines if line.mapped_sku_id]
        skus = {}
        if sku_ids:
            result = await db.execute(
                select(SKUCatalog).where(SKUCatalog.id.in_(sku_ids))
            )
            for sku in result.scalars():
                skus[sku.id] = sku

        # Calculate line pricing
        line_results = []
        for line in lines:
            sku = skus.get(line.mapped_sku_id) if line.mapped_sku_id else None
            unit_cost = float(sku.unit_cost) if sku and sku.unit_cost else None

            lr = calculate_line_pricing(
                quantity=line.quantity,
                unit_cost=unit_cost,
                contingency_percent=contingency_percent,
            )
            lr["bom_line_id"] = line.id
            lr["sku_id"] = sku.id if sku else None
            lr["sku_code"] = sku.sku_code if sku else None
            lr["cabinet_type"] = line.cabinet_type
            line_results.append(lr)

        # Calculate version totals
        version_calc = calculate_version_pricing(
            line_results, desired_margin_percent, rep_commission_percent
        )

    # Determine next version number
    result = await db.execute(
        select(func.max(PricingVersion.version_number))
        .where(PricingVersion.auto_bid_project_id == auto_bid_project_id)
    )
    max_version = result.scalar()
    next_version = (max_version or 0) + 1

    # Create pricing version
    pricing_version = PricingVersion(
        auto_bid_project_id=auto_bid_project_id,
        bom_version_id=bom_version_id,
        version_number=next_version,
        status="DRAFT",
        total_product_cost=float(version_calc["total_product_cost"]),
        total_freight=float(version_calc["total_freight"]),
        total_duties_tariffs=float(version_calc["total_duties_tariffs"]),
        total_tax=float(version_calc["total_tax"]),
        total_storage=float(version_calc["total_storage"]),
        total_delivery=float(version_calc["total_delivery"]),
        total_installation=float(version_calc["total_installation"]),
        total_contingency=float(version_calc["total_contingency"]),
        total_other_costs=float(version_calc["total_other_costs"]),
        landed_cost=float(version_calc["landed_cost"]),
        desired_margin_percent=float(version_calc["desired_margin_percent"]),
        suggested_sell_price=float(version_calc["suggested_sell_price"]),
        gross_profit=float(version_calc["gross_profit"]),
        gross_margin_percent=float(version_calc["gross_margin_percent"]),
        rep_commission_percent=float(version_calc["rep_commission_percent"]),
        rep_commission_amount=float(version_calc["rep_commission_amount"]),
        vulpine_retained_profit=float(version_calc["vulpine_retained_profit"]),
        risk_flags=version_calc["risk_flags"],
        is_blocked=version_calc["is_blocked"],
        block_reasons=version_calc["block_reasons"],
        meets_margin_floor=version_calc["meets_margin_floor"],
        meets_commission_floor=version_calc["meets_commission_floor"],
    )
    db.add(pricing_version)
    await db.flush()

    # Create pricing lines
    for lr in line_results:
        pl = PricingLine(
            pricing_version_id=pricing_version.id,
            bom_line_id=lr["bom_line_id"],
            auto_bid_project_id=auto_bid_project_id,
            line_number=lines[[l.id for l in lines].index(lr["bom_line_id"])].line_number,
            sku_id=lr.get("sku_id"),
            sku_code=lr.get("sku_code"),
            cabinet_type=lr.get("cabinet_type"),
            quantity=lines[[l.id for l in lines].index(lr["bom_line_id"])].quantity,
            unit_cost=float(lr["unit_cost"]),
            extended_product_cost=float(lr["extended_product_cost"]),
            freight=float(lr["freight"]),
            duties_tariffs=float(lr["duties_tariffs"]),
            tax=float(lr["tax"]),
            storage=float(lr["storage"]),
            delivery=float(lr["delivery"]),
            installation=float(lr["installation"]),
            contingency=float(lr["contingency"]),
            other_costs=float(lr["other_costs"]),
            line_landed_cost=float(lr["line_landed_cost"]),
            has_cost=lr["has_cost"],
            is_blocked=not lr["has_cost"],
            block_reason="No cost data available for this SKU" if not lr["has_cost"] else None,
        )
        db.add(pl)

    await db.flush()

    logger.info(
        f"Generated pricing v{next_version}: landed={pricing_version.landed_cost}, "
        f"sell={pricing_version.suggested_sell_price}, blocked={pricing_version.is_blocked}"
    )
    return pricing_version


async def approve_pricing(
    db: AsyncSession,
    pricing_version_id: uuid.UUID,
    approved_by: str = "mike",
) -> PricingVersion:
    """Approve a pricing version."""
    result = await db.execute(
        select(PricingVersion).where(PricingVersion.id == pricing_version_id)
    )
    pv = result.scalar_one_or_none()
    if not pv:
        raise ValueError(f"Pricing version {pricing_version_id} not found")

    if pv.is_blocked:
        raise ValueError("Cannot approve a blocked pricing version — resolve blockers first")

    pv.status = "APPROVED"
    pv.approved_by = approved_by
    pv.approved_at = datetime.now(timezone.utc)

    await db.flush()
    logger.info(f"Pricing v{pv.version_number} approved by {approved_by}")
    return pv