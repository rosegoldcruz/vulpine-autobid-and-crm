"""
Cabinet Extraction Pipeline.
Extracts structured CabinetRequirement records from document pages with provenance.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from services.auto_bid.models import (
    CabinetRequirement, ExtractedEvidence, DetectedSchedule,
    PlanIntelligenceObject, DocumentPage, BOMVersion, BOMLine,
)


# Patterns for extracting cabinet mentions
CABINET_TYPE_PATTERNS = [
    (re.compile(r'(\d+)\s*(?:x|by)\s*(\d+)"?\s*(base|wall|tall|pantry|vanity)\s*cabinet', re.I), "dimensioned_cabinet"),
    (re.compile(r'(\d+)"?\s*(base|wall|tall|pantry|vanity)\s*cabinet', re.I), "width_cabinet"),
    (re.compile(r'(base|wall|tall|pantry|vanity|closet|island)\s*cabinet[s]?', re.I), "type_cabinet"),
    (re.compile(r'cabinet[s]?\s*[:\-]\s*(\d+)', re.I), "count_cabinet"),
]

# Room labels
ROOM_PATTERNS = [
    re.compile(r'\b(kitchen|bath|bathroom|powder|laundry|utility|pantry|office|bedroom|closet|garage|mudroom)\b', re.I),
]

# Unit type patterns
UNIT_TYPE_PATTERNS = [
    re.compile(r'\b(unit\s*(?:type\s*)?[A-Z0-9]+|type\s*[A-Z0-9]+|model\s*[A-Z0-9]+|plan\s*[A-Z0-9]+)\b', re.I),
]

# Floor level patterns
FLOOR_PATTERNS = [
    re.compile(r'\b(level\s*\d|floor\s*\d|L\d|1st\s*floor|2nd\s*floor|3rd\s*floor|ground\s*floor|basement)\b', re.I),
]

# Dimension patterns
DIMENSION_PATTERN = re.compile(r'(\d{1,3}(?:\.\d+)?)\s*["\']?\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s*["\']?', re.I)
WIDTH_PATTERN = re.compile(r'(\d{1,3}(?:\.\d+)?)\s*["\']\s*(?:wide|width|w\.?\s*$)', re.I)


async def extract_evidence_from_pages(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    document_pages: List[DocumentPage],
) -> List[ExtractedEvidence]:
    """
    Extract evidence records from document pages.
    Each piece of evidence has full provenance (page number, raw text, source method).
    """
    evidence_records = []

    for page in document_pages:
        if not page.has_text and not page.ocr_text:
            continue

        text = page.ocr_text or page.text_preview or ""
        # For full text we'd need to re-read the PDF; text_preview is what we have
        # In production, we'd store full text on the page record

        # Extract cabinet mentions
        for pattern, evidence_subtype in CABINET_TYPE_PATTERNS:
            for match in pattern.finditer(text):
                raw_text = match.group(0)
                evidence = ExtractedEvidence(
                    auto_bid_project_id=auto_bid_project_id,
                    document_id=page.document_id,
                    page_id=page.id,
                    evidence_type="cabinet_mention",
                    raw_text=raw_text,
                    normalized_text=raw_text.lower().strip(),
                    confidence=0.85,
                    page_number=page.page_number,
                    source_method="text_extraction",
                    metadata={"subtype": evidence_subtype, "match_groups": match.groups()},
                )
                db.add(evidence)
                evidence_records.append(evidence)

        # Extract room labels
        for pattern in ROOM_PATTERNS:
            for match in pattern.finditer(text):
                raw_text = match.group(0)
                evidence = ExtractedEvidence(
                    auto_bid_project_id=auto_bid_project_id,
                    document_id=page.document_id,
                    page_id=page.id,
                    evidence_type="room_label",
                    raw_text=raw_text,
                    normalized_text=raw_text.lower().strip(),
                    confidence=0.90,
                    page_number=page.page_number,
                    source_method="text_extraction",
                    metadata={},
                )
                db.add(evidence)
                evidence_records.append(evidence)

        # Extract unit type mentions
        for pattern in UNIT_TYPE_PATTERNS:
            for match in pattern.finditer(text):
                raw_text = match.group(0)
                evidence = ExtractedEvidence(
                    auto_bid_project_id=auto_bid_project_id,
                    document_id=page.document_id,
                    page_id=page.id,
                    evidence_type="unit_type",
                    raw_text=raw_text,
                    normalized_text=raw_text.strip(),
                    confidence=0.80,
                    page_number=page.page_number,
                    source_method="text_extraction",
                    metadata={},
                )
                db.add(evidence)
                evidence_records.append(evidence)

        # Extract floor level mentions
        for pattern in FLOOR_PATTERNS:
            for match in pattern.finditer(text):
                raw_text = match.group(0)
                evidence = ExtractedEvidence(
                    auto_bid_project_id=auto_bid_project_id,
                    document_id=page.document_id,
                    page_id=page.id,
                    evidence_type="floor_level",
                    raw_text=raw_text,
                    normalized_text=raw_text.strip().lower(),
                    confidence=0.85,
                    page_number=page.page_number,
                    source_method="text_extraction",
                    metadata={},
                )
                db.add(evidence)
                evidence_records.append(evidence)

        # Extract dimensions
        for match in DIMENSION_PATTERN.finditer(text):
            raw_text = match.group(0)
            evidence = ExtractedEvidence(
                auto_bid_project_id=auto_bid_project_id,
                document_id=page.document_id,
                page_id=page.id,
                evidence_type="dimension",
                raw_text=raw_text,
                normalized_text=f"{match.group(1)}x{match.group(2)}",
                confidence=0.75,
                page_number=page.page_number,
                source_method="text_extraction",
                metadata={"width": float(match.group(1)), "height": float(match.group(2))},
            )
            db.add(evidence)
            evidence_records.append(evidence)

    await db.flush()
    logger.info(f"Extracted {len(evidence_records)} evidence records from {len(document_pages)} pages")
    return evidence_records


async def extract_schedules(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    document_pages: List[DocumentPage],
) -> List[DetectedSchedule]:
    """Extract schedule data from schedule pages."""
    schedules = []

    for page in document_pages:
        if not page.is_schedule_page:
            continue

        text = page.ocr_text or page.text_preview or ""
        if not text:
            continue

        # Parse schedule type
        schedule_type = "cabinet_schedule"
        if page.is_finish_schedule:
            schedule_type = "finish_schedule"
        elif "door schedule" in text.lower():
            schedule_type = "door_schedule"
        elif "hardware schedule" in text.lower():
            schedule_type = "hardware_schedule"

        # Try to parse tabular data (simple heuristic: lines with multiple columns)
        lines = text.strip().split('\n')
        parsed_entries = []
        for line in lines:
            # Look for lines with tab or multi-space separation
            parts = re.split(r'\t+|\s{2,}', line.strip())
            if len(parts) >= 2:
                parsed_entries.append({"raw_line": line.strip(), "columns": parts})

        schedule = DetectedSchedule(
            auto_bid_project_id=auto_bid_project_id,
            page_id=page.id,
            schedule_type=schedule_type,
            page_number=page.page_number,
            raw_text=text[:5000],  # Store first 5000 chars
            parsed_entries=parsed_entries,
            row_count=len(parsed_entries),
            confidence=0.70,
        )
        db.add(schedule)
        schedules.append(schedule)

    await db.flush()
    logger.info(f"Extracted {len(schedules)} schedules")
    return schedules


async def build_plan_intelligence(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    evidence_records: List[ExtractedEvidence],
) -> List[PlanIntelligenceObject]:
    """Build higher-level plan intelligence objects from extracted evidence."""
    objects = []

    # Group evidence by type
    by_type: Dict[str, List[ExtractedEvidence]] = {}
    for ev in evidence_records:
        by_type.setdefault(ev.evidence_type, []).append(ev)

    # Extract unit types
    unit_type_evidence = by_type.get("unit_type", [])
    seen_unit_types = set()
    for ev in unit_type_evidence:
        label = ev.normalized_text
        if label and label not in seen_unit_types:
            seen_unit_types.add(label)
            obj = PlanIntelligenceObject(
                auto_bid_project_id=auto_bid_project_id,
                object_type="unit_type",
                label=label,
                quantity=None,
                design_intent=ev.raw_text,
                evidence_ids=[ev.id],
                metadata={},
            )
            db.add(obj)
            objects.append(obj)

    # Extract room labels
    room_evidence = by_type.get("room_label", [])
    seen_rooms = set()
    for ev in room_evidence:
        label = ev.normalized_text
        if label and label not in seen_rooms:
            seen_rooms.add(label)
            obj = PlanIntelligenceObject(
                auto_bid_project_id=auto_bid_project_id,
                object_type="room",
                label=label,
                design_intent=ev.raw_text,
                evidence_ids=[ev.id],
                metadata={},
            )
            db.add(obj)
            objects.append(obj)

    # Extract floor levels
    floor_evidence = by_type.get("floor_level", [])
    seen_floors = set()
    for ev in floor_evidence:
        label = ev.normalized_text
        if label and label not in seen_floors:
            seen_floors.add(label)
            obj = PlanIntelligenceObject(
                auto_bid_project_id=auto_bid_project_id,
                object_type="floor_level",
                label=label,
                design_intent=ev.raw_text,
                evidence_ids=[ev.id],
                metadata={},
            )
            db.add(obj)
            objects.append(obj)

    await db.flush()
    logger.info(f"Built {len(objects)} plan intelligence objects")
    return objects


async def generate_cabinet_requirements(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    evidence_records: List[ExtractedEvidence],
) -> List[CabinetRequirement]:
    """
    Generate structured CabinetRequirement records from extracted evidence.
    Each requirement has provenance linking back to the evidence.
    """
    requirements = []

    # Group cabinet mentions by page and try to structure them
    cabinet_evidence = [ev for ev in evidence_records if ev.evidence_type == "cabinet_mention"]

    for ev in cabinet_evidence:
        raw = ev.raw_text or ""
        meta = ev.meta or {}

        # Try to parse cabinet type
        cabinet_type = None
        quantity = None
        width = None

        subtype = meta.get("subtype", "")
        groups = meta.get("match_groups", ())

        if subtype == "dimensioned_cabinet" and len(groups) >= 3:
            width = float(groups[0])
            # groups[1] is height dimension
            cabinet_type = groups[2].lower()
            quantity = 1
        elif subtype == "width_cabinet" and len(groups) >= 2:
            width = float(groups[0])
            cabinet_type = groups[1].lower()
            quantity = 1
        elif subtype == "type_cabinet" and len(groups) >= 1:
            cabinet_type = groups[0].lower()
            quantity = 1
        elif subtype == "count_cabinet" and len(groups) >= 1:
            quantity = int(groups[0]) if groups[0].isdigit() else None

        req = CabinetRequirement(
            auto_bid_project_id=auto_bid_project_id,
            cabinet_type=cabinet_type,
            design_intent=raw,
            quantity=quantity,
            width=width,
            evidence_ids=[ev.id],
            page_numbers=[ev.page_number] if ev.page_number else None,
            source_method=ev.source_method,
            status="EXTRACTED",
            metadata={"evidence_type": ev.evidence_type, "confidence": float(ev.confidence)},
        )
        db.add(req)
        requirements.append(req)

    await db.flush()
    logger.info(f"Generated {len(requirements)} cabinet requirements")
    return requirements