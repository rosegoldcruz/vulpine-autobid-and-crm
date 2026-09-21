"""
QA Engine.
Rule-based checks that produce Blocker / Warning / Info findings.
Proposals are blocked while any unresolved Blocker findings remain.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from services.auto_bid.models import (
    QARun, QAFinding, PricingVersion, PricingLine,
    BOMVersion, BOMLine, Exception as ExceptionModel,
    AutoBidProject, SKUMapping,
)


class Severity:
    BLOCKER = "BLOCKER"
    WARNING = "WARNING"
    INFO = "INFO"


class QACheckResult:
    def __init__(self, check_name: str, severity: str, message: str,
                 entity_type: str = None, entity_id: uuid.UUID = None,
                 expected_value=None, actual_value=None):
        self.check_name = check_name
        self.severity = severity
        self.message = message
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.expected_value = expected_value
        self.actual_value = actual_value


# ── QA Checks ───────────────────────────────────────────────────────────────────

def check_pricing_blocked(pricing_version: PricingVersion) -> QACheckResult:
    """Check if pricing version is blocked."""
    if pricing_version.is_blocked:
        reasons = pricing_version.block_reasons or []
        return QACheckResult(
            check_name="pricing_not_blocked",
            severity=Severity.BLOCKER,
            message=f"Pricing is blocked: {'; '.join(reasons)}",
            entity_type="pricing_version",
            entity_id=pricing_version.id,
            actual_value={"block_reasons": reasons},
        )
    return QACheckResult(
        check_name="pricing_not_blocked",
        severity=Severity.INFO,
        message="Pricing version is not blocked",
        entity_type="pricing_version",
        entity_id=pricing_version.id,
    )


def check_margin_floor(pricing_version: PricingVersion, min_margin: float = 18.0) -> QACheckResult:
    """Check that gross margin meets the floor."""
    margin = float(pricing_version.gross_margin_percent or 0)
    if margin < min_margin:
        return QACheckResult(
            check_name="margin_meets_floor",
            severity=Severity.BLOCKER,
            message=f"Gross margin {margin}% is below the minimum floor of {min_margin}%",
            entity_type="pricing_version",
            entity_id=pricing_version.id,
            expected_value={"min_margin_percent": min_margin},
            actual_value={"gross_margin_percent": margin},
        )
    return QACheckResult(
        check_name="margin_meets_floor",
        severity=Severity.INFO,
        message=f"Gross margin {margin}% meets the floor of {min_margin}%",
        entity_type="pricing_version",
        entity_id=pricing_version.id,
    )


def check_missing_costs(pricing_lines: List[PricingLine]) -> List[QACheckResult]:
    """Check for pricing lines with missing cost data."""
    results = []
    for pl in pricing_lines:
        if not pl.has_cost:
            results.append(QACheckResult(
                check_name="line_has_cost",
                severity=Severity.BLOCKER,
                message=f"Line {pl.line_number}: No cost data for SKU '{pl.sku_code or 'N/A'}'",
                entity_type="pricing_line",
                entity_id=pl.id,
                actual_value={"has_cost": False},
            ))
    return results


def check_unresolved_exceptions(exceptions: List[ExceptionModel]) -> List[QACheckResult]:
    """Check for unresolved blocker exceptions."""
    results = []
    for exc in exceptions:
        if exc.status in ("OPEN", "IN_REVIEW") and exc.severity == "BLOCKER":
            results.append(QACheckResult(
                check_name="exception_resolved",
                severity=Severity.BLOCKER,
                message=f"Unresolved blocker exception: {exc.title}",
                entity_type="exception",
                entity_id=exc.id,
                actual_value={"status": exc.status, "severity": exc.severity},
            ))
        elif exc.status in ("OPEN", "IN_REVIEW") and exc.severity == "WARNING":
            results.append(QACheckResult(
                check_name="exception_resolved",
                severity=Severity.WARNING,
                message=f"Unresolved warning exception: {exc.title}",
                entity_type="exception",
                entity_id=exc.id,
                actual_value={"status": exc.status, "severity": exc.severity},
            ))
    return results


def check_bom_approved(bom_version: BOMVersion) -> QACheckResult:
    """Check that the BOM is approved."""
    if bom_version.status != "APPROVED":
        return QACheckResult(
            check_name="bom_approved",
            severity=Severity.BLOCKER,
            message=f"BOM v{bom_version.version_number} is not approved (status: {bom_version.status})",
            entity_type="bom_version",
            entity_id=bom_version.id,
            expected_value={"status": "APPROVED"},
            actual_value={"status": bom_version.status},
        )
    return QACheckResult(
        check_name="bom_approved",
        severity=Severity.INFO,
        message=f"BOM v{bom_version.version_number} is approved",
    )


def check_all_lines_mapped(bom_lines: List[BOMLine]) -> List[QACheckResult]:
    """Check that all BOM lines have SKU mappings."""
    results = []
    for line in bom_lines:
        if not line.mapped_sku_id:
            results.append(QACheckResult(
                check_name="line_sku_mapped",
                severity=Severity.WARNING,
                message=f"BOM line {line.line_number}: No SKU mapped",
                entity_type="bom_line",
                entity_id=line.id,
            ))
    return results


def check_pricing_approved(pricing_version: PricingVersion) -> QACheckResult:
    """Check that pricing is approved."""
    if pricing_version.status != "APPROVED":
        return QACheckResult(
            check_name="pricing_approved",
            severity=Severity.BLOCKER,
            message=f"Pricing v{pricing_version.version_number} is not approved (status: {pricing_version.status})",
            entity_type="pricing_version",
            entity_id=pricing_version.id,
            expected_value={"status": "APPROVED"},
            actual_value={"status": pricing_version.status},
        )
    return QACheckResult(
        check_name="pricing_approved",
        severity=Severity.INFO,
        message=f"Pricing v{pricing_version.version_number} is approved",
    )


def check_zero_pricing(pricing_version: PricingVersion) -> Optional[QACheckResult]:
    """Check for zero-dollar pricing (indicates no data)."""
    if float(pricing_version.landed_cost or 0) == 0:
        return QACheckResult(
            check_name="non_zero_pricing",
            severity=Severity.BLOCKER,
            message="Total landed cost is zero — no pricing data available",
            entity_type="pricing_version",
            entity_id=pricing_version.id,
            actual_value={"landed_cost": 0},
        )
    return None


def check_quantity_positive(bom_lines: List[BOMLine]) -> List[QACheckResult]:
    """Check that all BOM line quantities are positive."""
    results = []
    for line in bom_lines:
        if line.quantity <= 0:
            results.append(QACheckResult(
                check_name="quantity_positive",
                severity=Severity.WARNING,
                message=f"BOM line {line.line_number}: Quantity is {line.quantity}",
                entity_type="bom_line",
                entity_id=line.id,
            ))
    return results


async def run_qa(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    pricing_version_id: Optional[uuid.UUID] = None,
    bom_version_id: Optional[uuid.UUID] = None,
) -> QARun:
    """
    Run all QA checks and create a QA run with findings.
    Proposal is blocked while any BLOCKER findings remain unresolved.
    """
    all_checks = []

    # Get pricing version
    pricing_version = None
    if pricing_version_id:
        result = await db.execute(
            select(PricingVersion).where(PricingVersion.id == pricing_version_id)
        )
        pricing_version = result.scalar_one_or_none()

    # Get BOM version
    bom_version = None
    if bom_version_id:
        result = await db.execute(
            select(BOMVersion).where(BOMVersion.id == bom_version_id)
        )
        bom_version = result.scalar_one_or_none()

    # Run checks
    if pricing_version:
        all_checks.append(check_pricing_blocked(pricing_version))
        all_checks.append(check_margin_floor(pricing_version))
        all_checks.append(check_pricing_approved(pricing_version))
        zero_check = check_zero_pricing(pricing_version)
        if zero_check:
            all_checks.append(zero_check)

        # Get pricing lines
        result = await db.execute(
            select(PricingLine)
            .where(PricingLine.pricing_version_id == pricing_version.id)
            .order_by(PricingLine.line_number)
        )
        pricing_lines = list(result.scalars().all())
        all_checks.extend(check_missing_costs(pricing_lines))

    if bom_version:
        all_checks.append(check_bom_approved(bom_version))

        result = await db.execute(
            select(BOMLine)
            .where(BOMLine.bom_version_id == bom_version.id)
            .order_by(BOMLine.line_number)
        )
        bom_lines = list(result.scalars().all())
        all_checks.extend(check_all_lines_mapped(bom_lines))
        all_checks.extend(check_quantity_positive(bom_lines))

    # Check exceptions
    result = await db.execute(
        select(ExceptionModel)
        .where(
            ExceptionModel.auto_bid_project_id == auto_bid_project_id,
            ExceptionModel.status.in_(["OPEN", "IN_REVIEW"]),
        )
    )
    exceptions = list(result.scalars().all())
    all_checks.extend(check_unresolved_exceptions(exceptions))

    # Determine next run number
    result = await db.execute(
        select(func.max(QARun.run_number))
        .where(QARun.auto_bid_project_id == auto_bid_project_id)
    )
    max_run = result.scalar()
    next_run = (max_run or 0) + 1

    # Count by severity
    blockers = sum(1 for c in all_checks if c.severity == Severity.BLOCKER)
    warnings = sum(1 for c in all_checks if c.severity == Severity.WARNING)
    infos = sum(1 for c in all_checks if c.severity == Severity.INFO)

    if blockers > 0:
        status = "BLOCKED"
        is_proposal_blocked = True
    elif warnings > 0:
        status = "PASSED_WITH_WARNINGS"
        is_proposal_blocked = False
    else:
        status = "PASSED"
        is_proposal_blocked = False

    # Create QA run
    qa_run = QARun(
        auto_bid_project_id=auto_bid_project_id,
        pricing_version_id=pricing_version_id,
        bom_version_id=bom_version_id,
        run_number=next_run,
        status=status,
        total_checks=len(all_checks),
        blockers_count=blockers,
        warnings_count=warnings,
        info_count=infos,
        is_proposal_blocked=is_proposal_blocked,
    )
    db.add(qa_run)
    await db.flush()

    # Create findings
    for check in all_checks:
        finding = QAFinding(
            qa_run_id=qa_run.id,
            auto_bid_project_id=auto_bid_project_id,
            check_name=check.check_name,
            severity=check.severity,
            message=check.message,
            entity_type=check.entity_type,
            entity_id=check.entity_id,
            expected_value=check.expected_value,
            actual_value=check.actual_value,
        )
        db.add(finding)

    await db.flush()

    logger.info(
        f"QA run {next_run}: {status} — {blockers} blockers, {warnings} warnings, {infos} info"
    )
    return qa_run


async def can_generate_proposal(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
) -> bool:
    """Check if a proposal can be generated (no unresolved blockers)."""
    # Get latest QA run
    result = await db.execute(
        select(QARun)
        .where(QARun.auto_bid_project_id == auto_bid_project_id)
        .order_by(QARun.run_number.desc())
        .limit(1)
    )
    latest_qa = result.scalar_one_or_none()

    if not latest_qa:
        return False

    if latest_qa.is_proposal_blocked:
        return False

    # Check for unresolved blocker findings
    result = await db.execute(
        select(func.count(QAFinding.id))
        .where(
            QAFinding.qa_run_id == latest_qa.id,
            QAFinding.severity == Severity.BLOCKER,
            QAFinding.is_resolved == False,
        )
    )
    unresolved_blockers = result.scalar()

    return unresolved_blockers == 0