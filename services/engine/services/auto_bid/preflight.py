"""
Document Preflight Engine.
Analyzes uploaded PDFs using PyMuPDF: page count, dimensions, text content,
vector graphics, images, bookmarks, sheet detection, cabinet keywords, OCR need.
"""

import os
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from loguru import logger

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from services.auto_bid.models import DocumentPage, PreflightResult


# Cabinet-related keywords to search for in plan documents
CABINET_KEYWORDS = [
    "cabinet", "cabinets", "casework", "millwork", "millwork work",
    "countertop", "counter top", "vanity", "vanities",
    "closet", "closets", "wardrobe", "storage cabinet",
    "base cabinet", "wall cabinet", "tall cabinet", "pantry",
    "bookcase", "shelving", "shelf", "shelves",
    "drawer", "doors", "hinges", "pulls", "knobs",
    "finish schedule", "hardware schedule", "cabinet schedule",
    "plastic laminate", "solid surface", "quartz", "granite",
    "wood veneer", "melamine", "maple", "oak", "alder", "cherry",
]

# Sheet label patterns (e.g. A-101, 1.0, S-001, E-200)
SHEET_LABEL_PATTERNS = [
    re.compile(r'^([A-Z])[-._]?(\d{1,3})\b', re.IGNORECASE),  # A-101, A.101
    re.compile(r'^(\d{1,2})[.-](\d{1,2})\b'),                   # 1.0, 01.00
]

# Sheet type classification keywords
SHEET_TYPE_KEYWORDS = {
    "floor_plan": ["floor plan", "floor plans", "plan", "level", "unit plan", "unit type"],
    "elevation": ["elevation", "elevations", "exterior elevation"],
    "schedule": ["schedule", "schedules", "finish schedule", "door schedule", "hardware schedule"],
    "finish_schedule": ["finish schedule", "finish schedule"],
    "detail": ["detail", "details", "typical detail", "cabinet detail"],
    "section": ["section", "sections", "wall section", "building section"],
    "site_plan": ["site plan", "site", "plot plan", "demolition"],
    "rendering": ["rendering", "perspective", "3d view"],
}

# Standard page size mapping (in points)
PAGE_SIZE_MAP = {
    (612, 792): "LETTER",
    (792, 612): "LETTER_LANDSCAPE",
    (612, 1008): "LEGAL",
    (864, 1296): "ARCH_C",
    (1296, 864): "ARCH_C_LANDSCAPE",
    (864, 1224): "ANSI_C",
    (1224, 864): "ANSI_C_LANDSCAPE",
    (1098, 1620): "TABLOID",
    (1116, 1728): "ARCH_D",
    (1728, 1116): "ARCH_D_LANDSCAPE",
    (1098, 1632): "ANSI_D",
    (1632, 1098): "ANSI_D_LANDSCAPE",
    (1632, 2592): "ARCH_E1",
    (2592, 1632): "ARCH_E1_LANDSCAPE",
    (1728, 2592): "ARCH_E",
    (2592, 1728): "ARCH_E_LANDSCAPE",
    (1632, 2448): "ANSI_E",
    (2448, 1632): "ANSI_E_LANDSCAPE",
}


def classify_page_size(width: float, height: float) -> str:
    """Classify a page by its dimensions."""
    # Normalize to (min, max) for portrait comparison
    w, h = round(width), round(height)
    key = (w, h)
    if key in PAGE_SIZE_MAP:
        return PAGE_SIZE_MAP[key]
    # Try landscape
    key_rev = (h, w)
    if key_rev in PAGE_SIZE_MAP:
        return PAGE_SIZE_MAP[key_rev]
    # Fallback: estimate by size
    max_dim = max(w, h)
    if max_dim >= 2400:
        return "ARCH_E" if w < h else "ARCH_E_LANDSCAPE"
    if max_dim >= 1600:
        return "ARCH_D" if w < h else "ARCH_D_LANDSCAPE"
    if max_dim >= 1200:
        return "ARCH_C" if w < h else "ARCH_C_LANDSCAPE"
    if max_dim >= 800:
        return "TABLOID" if w < h else "TABLOID_LANDSCAPE"
    return "CUSTOM"


def detect_sheet_label(text: str) -> Optional[str]:
    """Try to detect a sheet label from page text."""
    if not text:
        return None
    # Look at first few lines
    lines = text.strip().split('\n')[:10]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        for pattern in SHEET_LABEL_PATTERNS:
            m = pattern.match(line)
            if m:
                return line[:50].strip()
    return None


def classify_sheet_type(text: str) -> tuple[Optional[str], Optional[str]]:
    """Classify sheet type and extract title from text.
    Returns (sheet_type, sheet_title).
    """
    if not text:
        return ("unknown", None)

    text_lower = text.lower()

    # Check each sheet type
    best_type = "unknown"
    best_score = 0
    for sheet_type, keywords in SHEET_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_type = sheet_type

    # Try to extract sheet title from first few lines
    title = None
    lines = text.strip().split('\n')[:5]
    for line in lines:
        line = line.strip()
        if len(line) > 5 and len(line) < 200:
            # Check if this line looks like a title (not a sheet label)
            is_label = any(p.match(line) for p in SHEET_LABEL_PATTERNS)
            if not is_label and not line.isdigit():
                title = line
                break

    return (best_type if best_score > 0 else "unknown", title)


def find_cabinet_keywords(text: str) -> List[str]:
    """Find cabinet-related keywords in text."""
    if not text:
        return []
    text_lower = text.lower()
    found = []
    for kw in CABINET_KEYWORDS:
        if kw in text_lower:
            found.append(kw)
    return list(set(found))


def is_scanned_page(page) -> bool:
    """Heuristic: a page is likely scanned if it has images but no text."""
    text = page.get_text("text", sort=True)
    if text and len(text.strip()) > 50:
        return False
    # Check for images
    images = page.get_images(full=False)
    if len(images) > 0:
        return True
    # Check for large drawing fills (vector)
    drawings = page.get_drawings()
    if len(drawings) > 100 and (not text or len(text.strip()) < 20):
        return True
    return False


async def analyze_pdf(
    file_path: str,
    auto_bid_project_id,
    document_id,
    db,
) -> List[DocumentPage]:
    """
    Analyze a single PDF file and create DocumentPage records.
    Returns the list of created page records.
    """
    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not installed")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF not found: {file_path}")

    doc = fitz.open(file_path)
    pages = []

    # Extract bookmarks/TOC
    toc = doc.get_toc(simple=True) if doc.is_pdf else []
    bookmark_map = {}
    for level, title, page_num in toc:
        # page_num is 1-indexed in PyMuPDF
        if page_num and page_num <= len(doc):
            bookmark_map[page_num - 1] = title

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        rect = page.rect
        width_pts = rect.width
        height_pts = rect.height
        width_inches = round(width_pts / 72.0, 2)
        height_inches = round(height_pts / 72.0, 2)
        page_size_label = classify_page_size(width_pts, height_pts)

        # Text extraction
        text = page.get_text("text", sort=True)
        text_char_count = len(text.strip())
        has_text = text_char_count > 0
        text_preview = text.strip()[:500] if has_text else None

        # Vector graphics
        drawings = page.get_drawings()
        has_vector = len(drawings) > 0

        # Images
        images = page.get_images(full=False)
        has_images = len(images) > 0
        image_count = len(images)

        # Scanned detection
        is_scanned = is_scanned_page(page)
        needs_ocr = is_scanned and not has_text

        # Sheet detection
        sheet_label = detect_sheet_label(text) if has_text else None
        sheet_type, sheet_title = classify_sheet_type(text) if has_text else ("unknown", None)

        # Schedule detection
        is_schedule = sheet_type in ["schedule", "finish_schedule"]
        is_finish = sheet_type == "finish_schedule"

        # Cabinet keywords
        cabinet_kws = find_cabinet_keywords(text) if has_text else []
        is_cabinet_related = len(cabinet_kws) > 0

        # Bookmark
        bookmark_path = bookmark_map.get(page_idx)

        page_record = DocumentPage(
            auto_bid_project_id=auto_bid_project_id,
            document_id=document_id,
            page_number=page_idx + 1,
            width_pts=width_pts,
            height_pts=height_pts,
            width_inches=width_inches,
            height_inches=height_inches,
            page_size_label=page_size_label,
            has_text=has_text,
            text_char_count=text_char_count,
            text_preview=text_preview,
            has_vector_graphics=has_vector,
            has_images=has_images,
            image_count=image_count,
            is_likely_scanned=is_scanned,
            needs_ocr=needs_ocr,
            sheet_label=sheet_label,
            sheet_title=sheet_title,
            sheet_type=sheet_type,
            is_schedule_page=is_schedule,
            is_finish_schedule=is_finish,
            is_cabinet_related=is_cabinet_related,
            cabinet_keywords=cabinet_kws if cabinet_kws else None,
            bookmark_path=bookmark_path,
            meta={},
        )
        db.add(page_record)
        pages.append(page_record)

    await db.flush()
    doc.close()
    logger.info(f"Analyzed {len(pages)} pages from {file_path}")
    return pages


async def run_preflight(
    file_paths: List[str],
    auto_bid_project_id,
    document_ids: List,
    db,
) -> PreflightResult:
    """
    Run preflight analysis on all uploaded PDFs.
    Creates DocumentPage records and a PreflightResult summary.
    """
    import uuid as uuid_mod

    all_pages = []
    total_file_size = 0

    for i, file_path in enumerate(file_paths):
        doc_id = document_ids[i] if i < len(document_ids) else None
        pages = await analyze_pdf(file_path, auto_bid_project_id, doc_id, db)
        all_pages.extend(pages)
        total_file_size += os.path.getsize(file_path)

    # Aggregate stats
    total_pages = len(all_pages)
    total_documents = len(file_paths)

    # Page size distribution
    size_counts: Dict[str, int] = {}
    for p in all_pages:
        label = p.page_size_label or "CUSTOM"
        size_counts[label] = size_counts.get(label, 0) + 1
    page_sizes = [
        {"label": k, "count": v, "percentage": round(v / total_pages * 100, 1) if total_pages else 0}
        for k, v in sorted(size_counts.items(), key=lambda x: -x[1])
    ]

    # Schedule and cabinet stats
    schedule_pages = sum(1 for p in all_pages if p.is_schedule_page)
    cabinet_keyword_pages = sum(1 for p in all_pages if p.is_cabinet_related)
    scanned_pages = sum(1 for p in all_pages if p.is_likely_scanned)
    needs_ocr_count = sum(1 for p in all_pages if p.needs_ocr)

    # Bookmarks
    has_bookmarks = any(p.bookmark_path for p in all_pages)
    bookmark_count = sum(1 for p in all_pages if p.bookmark_path)

    # Detected sheets
    detected_sheets = [
        {
            "page_number": p.page_number,
            "sheet_label": p.sheet_label,
            "sheet_title": p.sheet_title,
            "sheet_type": p.sheet_type,
        }
        for p in all_pages if p.sheet_label or p.sheet_type != "unknown"
    ]

    # Cabinet keywords found
    cabinet_keywords_found: Dict[str, List[int]] = {}
    for p in all_pages:
        if p.cabinet_keywords:
            for kw in p.cabinet_keywords:
                if kw not in cabinet_keywords_found:
                    cabinet_keywords_found[kw] = []
                cabinet_keywords_found[kw].append(p.page_number)

    # Warnings
    warnings = []
    if needs_ocr_count > 0:
        warnings.append({
            "type": "ocr_needed",
            "message": f"{needs_ocr_count} page(s) appear to be scanned and may need OCR",
            "severity": "warning",
        })
    if total_pages == 0:
        warnings.append({
            "type": "no_pages",
            "message": "No pages were found in the uploaded documents",
            "severity": "blocker",
        })
    if cabinet_keyword_pages == 0 and total_pages > 0:
        warnings.append({
            "type": "no_cabinet_keywords",
            "message": "No cabinet-related keywords detected in any document",
            "severity": "info",
        })
    if schedule_pages == 0 and total_pages > 0:
        warnings.append({
            "type": "no_schedules",
            "message": "No schedule pages detected",
            "severity": "info",
        })

    is_ready = total_pages > 0 and not any(w["severity"] == "blocker" for w in warnings)
    extraction_notes = "Ready for extraction" if is_ready else "Resolve blockers before extraction"

    preflight = PreflightResult(
        auto_bid_project_id=auto_bid_project_id,
        total_pages=total_pages,
        total_documents=total_documents,
        page_sizes=page_sizes,
        schedule_pages_count=schedule_pages,
        cabinet_keyword_pages=cabinet_keyword_pages,
        scanned_pages_count=scanned_pages,
        needs_ocr_count=needs_ocr_count,
        has_bookmarks=has_bookmarks,
        bookmark_count=bookmark_count,
        detected_sheets=detected_sheets,
        cabinet_keywords_found=cabinet_keywords_found,
        file_sizes_bytes=total_file_size,
        warnings=warnings,
        is_ready_for_extraction=is_ready,
        extraction_notes=extraction_notes,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(preflight)
    await db.flush()

    logger.info(f"Preflight complete: {total_pages} pages, {total_documents} docs, ready={is_ready}")
    return preflight