"""
FastAPI Routes for Auto Bid.
Complete REST API at /api/v1/auto-bid/*.
"""

import uuid
import os
from datetime import datetime, date, timezone
from typing import Optional, List
from loguru import logger
from fastapi import APIRouter, HTTPException, Body, Query, UploadFile, File, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, update

from shared.database import get_db
from services.auto_bid.models import (
    AutoBidProject, DocumentPage, PreflightResult, Sheet,
    ExtractedEvidence, DetectedSchedule, PlanIntelligenceObject,
    CabinetRequirement, BOMVersion, BOMLine,
    SKUCatalog, SKUAlias, SKUMapping, SKUMappingHistory,
    Exception as ExceptionModel, ReviewDecision,
    ValueEngineeringDecision, PricingVersion, PricingLine,
    QARun, QAFinding, ProposalVersion, AuditEvent,
)
from services.auto_bid.state_machine import (
    ProjectStatus, WorkflowStage, STAGE_ORDER, STATUS_TO_STAGE,
    transition_status, advance_stage, get_stage_progress, can_transition,
    TransitionError,
)
from services.auto_bid.audit import record_event, get_audit_trail

router = APIRouter(prefix="/api/v1/auto-bid", tags=["auto-bid"])


# ── Pydantic Schemas ────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    project_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    status: str
    current_stage: str
    stage_progress: dict
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    error_message: Optional[str] = None
    failed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StageTransitionRequest(BaseModel):
    target_status: str
    actor: str = "system"
    reason: str = ""

class ExceptionResolveRequest(BaseModel):
    resolution: str
    resolution_type: str = "sku_substituted"
    resolved_by: str = "mike"
    new_sku_id: Optional[str] = None

class SKUMappingRequest(BaseModel):
    sku_id: str
    actor: str = "mike"
    reason: str = ""

class SKUCatalogCreate(BaseModel):
    sku_code: str
    manufacturer: Optional[str] = None
    product_line: Optional[str] = None
    series: Optional[str] = None
    model: Optional[str] = None
    cabinet_type: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    finish: Optional[str] = None
    hardware_included: bool = False
    unit_cost: Optional[float] = None
    lead_time_days: Optional[int] = None
    freight_class: Optional[str] = None
    notes: Optional[str] = None

class VEDecisionCreate(BaseModel):
    title: str
    description: str
    ve_type: str = "substitution"
    bom_line_id: Optional[str] = None
    cabinet_requirement_id: Optional[str] = None
    before_description: Optional[str] = None
    before_sku_id: Optional[str] = None
    before_quantity: Optional[int] = None
    before_cost: Optional[float] = None
    after_description: Optional[str] = None
    after_sku_id: Optional[str] = None
    after_quantity: Optional[int] = None
    after_cost: Optional[float] = None
    rationale: Optional[str] = None

class VEDecisionAction(BaseModel):
    decided_by: str = "mike"
    decision_notes: str = ""

class PricingGenerateRequest(BaseModel):
    bom_version_id: str
    desired_margin_percent: float = 18.0
    rep_commission_percent: float = 0.0
    contingency_percent: float = 3.0

class ProposalGenerateRequest(BaseModel):
    pricing_version_id: str
    bom_version_id: str
    qa_run_id: Optional[str] = None
    template_name: str = "default"

class AuditEventResponse(BaseModel):
    id: str
    actor: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helper ──────────────────────────────────────────────────────────────────────

def serialize_project(project: AutoBidProject) -> dict:
    """Serialize a project with stage progress."""
    stage = WorkflowStage(project.current_stage)
    progress = get_stage_progress(stage)
    return {
        "id": str(project.id),
        "name": project.name,
        "status": project.status,
        "current_stage": project.current_stage,
        "stage_progress": progress,
        "assigned_to": project.assigned_to,
        "due_date": project.due_date.isoformat() if project.due_date else None,
        "notes": project.notes,
        "error_message": project.error_message,
        "failed_at": project.failed_at.isoformat() if project.failed_at else None,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "stage_history": project.stage_history or [],
    }


# ── Projects ────────────────────────────────────────────────────────────────────

@router.get("/projects")
async def list_projects(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all Auto Bid projects."""
    stmt = select(AutoBidProject).order_by(AutoBidProject.created_at.desc())
    if status:
        stmt = stmt.where(AutoBidProject.status == status)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return {
        "projects": [serialize_project(p) for p in projects],
        "count": len(projects),
    }


@router.post("/projects")
async def create_project(
    req: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new Auto Bid project."""
    project = AutoBidProject(
        name=req.name,
        project_id=uuid.UUID(req.project_id) if req.project_id else None,
        opportunity_id=uuid.UUID(req.opportunity_id) if req.opportunity_id else None,
        assigned_to=req.assigned_to,
        due_date=req.due_date,
        notes=req.notes,
        status="CREATED",
        current_stage="UPLOAD",
        stage_history=[],
    )
    db.add(project)
    await db.flush()

    # Record audit
    await record_event(
        db, project.id, "system", "create", "auto_bid_project", project.id,
        new_values={"name": req.name, "status": "CREATED"},
    )
    await db.commit()

    return serialize_project(project)


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single Auto Bid project with full details."""
    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    data = serialize_project(project)

    # Get summary counts
    counts = {}
    for model, key in [
        (DocumentPage, "document_pages"),
        (ExtractedEvidence, "evidence"),
        (CabinetRequirement, "cabinet_requirements"),
        (BOMVersion, "bom_versions"),
        (PricingVersion, "pricing_versions"),
        (QARun, "qa_runs"),
        (ProposalVersion, "proposal_versions"),
        (ExceptionModel, "exceptions"),
        (ValueEngineeringDecision, "ve_decisions"),
        (AuditEvent, "audit_events"),
    ]:
        result = await db.execute(
            select(func.count(model.id))
            .where(model.auto_bid_project_id == project.id)
        )
        counts[key] = result.scalar()

    data["counts"] = counts
    return data


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a project's metadata."""
    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    old_values = {}
    if req.name is not None:
        old_values["name"] = project.name
        project.name = req.name
    if req.assigned_to is not None:
        old_values["assigned_to"] = project.assigned_to
        project.assigned_to = req.assigned_to
    if req.due_date is not None:
        old_values["due_date"] = project.due_date
        project.due_date = req.due_date
    if req.notes is not None:
        old_values["notes"] = project.notes
        project.notes = req.notes

    await record_event(
        db, project.id, "system", "update", "auto_bid_project", project.id,
        old_values=old_values,
    )
    await db.commit()

    return serialize_project(project)


@router.post("/projects/{project_id}/transition")
async def transition_project(
    project_id: str,
    req: StageTransitionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Transition a project to a new status."""
    try:
        new_status = ProjectStatus(req.target_status)
    except ValueError:
        raise HTTPException(400, f"Invalid status: {req.target_status}")

    try:
        project = await transition_status(
            db, uuid.UUID(project_id), new_status, req.actor, req.reason
        )
        await db.commit()
        return serialize_project(project)
    except TransitionError as e:
        raise HTTPException(409, str(e))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/projects/{project_id}/advance")
async def advance_project(
    project_id: str,
    actor: str = "system",
    reason: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Advance a project to the next stage."""
    try:
        project = await advance_stage(db, uuid.UUID(project_id), actor, reason)
        await db.commit()
        return serialize_project(project)
    except TransitionError as e:
        raise HTTPException(409, str(e))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/projects/{project_id}/audit-trail")
async def get_project_audit(
    project_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Get audit trail for a project."""
    events = await get_audit_trail(db, uuid.UUID(project_id), limit, offset)
    return {
        "events": [
            {
                "id": str(e.id),
                "actor": e.actor,
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id) if e.entity_id else None,
                "old_values": e.old_values,
                "new_values": e.new_values,
                "reason": e.reason,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
        "count": len(events),
    }


# ── Document Upload ─────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/documents/upload")
async def upload_documents(
    project_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload PDF documents for a project.
    Files are saved to the upload directory and registered in the documents table.
    """
    from shared.config import settings

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    upload_dir = settings.upload_dir / "auto_bid" / project_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_docs = []
    for file in files:
        if not file.filename:
            continue

        file_path = upload_dir / file.filename
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        # Create document record
        from sqlalchemy import text as sql_text
        doc_id = uuid.uuid4()
        await db.execute(
            sql_text("""
                INSERT INTO documents (id, project_id, filename, file_path, file_type, file_size_bytes, uploaded_at)
                VALUES (:id, :project_id, :filename, :file_path, :file_type, :file_size, NOW())
            """),
            {
                "id": str(doc_id),
                "project_id": str(project.project_id) if project.project_id else None,
                "filename": file.filename,
                "file_path": str(file_path),
                "file_type": "plan",
                "file_size": len(content),
            }
        )

        saved_docs.append({
            "id": str(doc_id),
            "filename": file.filename,
            "file_path": str(file_path),
            "file_size": len(content),
        })

        await record_event(
            db, project.id, "system", "upload", "document", doc_id,
            new_values={"filename": file.filename, "file_size": len(content)},
        )

    # Transition to WAITING_FOR_DOCUMENTS or PREFLIGHT if we have files
    if saved_docs and project.status == "CREATED":
        await transition_status(
            db, project.id, ProjectStatus.WAITING_FOR_DOCUMENTS, "system", "Documents uploaded"
        )

    await db.commit()

    return {
        "uploaded": saved_docs,
        "count": len(saved_docs),
    }


# ── Preflight ───────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/preflight")
async def run_preflight(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Run preflight analysis on uploaded documents.
    Analyzes all PDFs in the project's upload directory.
    """
    from shared.config import settings
    from services.auto_bid.preflight import run_preflight as do_preflight
    import os

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Find uploaded files
    upload_dir = settings.upload_dir / "auto_bid" / project_id
    if not upload_dir.exists():
        return {
            "status": "no_documents",
            "message": "No documents uploaded yet",
            "preflight": None,
        }

    file_paths = []
    for f in os.listdir(upload_dir):
        if f.lower().endswith('.pdf'):
            file_paths.append(str(upload_dir / f))

    if not file_paths:
        return {
            "status": "no_documents",
            "message": "No PDF documents found in upload directory",
            "preflight": None,
        }

    # Transition to PREFLIGHT
    if project.status in ("CREATED", "WAITING_FOR_DOCUMENTS"):
        await transition_status(db, project.id, ProjectStatus.PREFLIGHT, "system", "Starting preflight")

    # Run preflight
    preflight = await do_preflight(file_paths, project.id, [], db)

    await record_event(
        db, project.id, "system", "preflight_complete", "preflight_result", preflight.id,
        new_values={"total_pages": preflight.total_pages, "is_ready": preflight.is_ready_for_extraction},
    )
    await db.commit()

    return {
        "status": "complete",
        "preflight": {
            "id": str(preflight.id),
            "total_pages": preflight.total_pages,
            "total_documents": preflight.total_documents,
            "page_sizes": preflight.page_sizes,
            "schedule_pages_count": preflight.schedule_pages_count,
            "cabinet_keyword_pages": preflight.cabinet_keyword_pages,
            "scanned_pages_count": preflight.scanned_pages_count,
            "needs_ocr_count": preflight.needs_ocr_count,
            "has_bookmarks": preflight.has_bookmarks,
            "bookmark_count": preflight.bookmark_count,
            "detected_sheets": preflight.detected_sheets,
            "cabinet_keywords_found": preflight.cabinet_keywords_found,
            "warnings": preflight.warnings,
            "is_ready_for_extraction": preflight.is_ready_for_extraction,
            "extraction_notes": preflight.extraction_notes,
            "completed_at": preflight.completed_at.isoformat() if preflight.completed_at else None,
        },
    }


@router.get("/projects/{project_id}/preflight")
async def get_preflight(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get the latest preflight results for a project."""
    result = await db.execute(
        select(PreflightResult)
        .where(PreflightResult.auto_bid_project_id == uuid.UUID(project_id))
        .order_by(PreflightResult.created_at.desc())
        .limit(1)
    )
    preflight = result.scalar_one_or_none()
    if not preflight:
        return {"preflight": None, "message": "No preflight has been run yet"}

    # Also get document pages
    result = await db.execute(
        select(DocumentPage)
        .where(DocumentPage.auto_bid_project_id == uuid.UUID(project_id))
        .order_by(DocumentPage.page_number)
    )
    pages = result.scalars().all()

    return {
        "preflight": {
            "id": str(preflight.id),
            "total_pages": preflight.total_pages,
            "total_documents": preflight.total_documents,
            "page_sizes": preflight.page_sizes,
            "schedule_pages_count": preflight.schedule_pages_count,
            "cabinet_keyword_pages": preflight.cabinet_keyword_pages,
            "scanned_pages_count": preflight.scanned_pages_count,
            "needs_ocr_count": preflight.needs_ocr_count,
            "has_bookmarks": preflight.has_bookmarks,
            "bookmark_count": preflight.bookmark_count,
            "detected_sheets": preflight.detected_sheets,
            "cabinet_keywords_found": preflight.cabinet_keywords_found,
            "warnings": preflight.warnings,
            "is_ready_for_extraction": preflight.is_ready_for_extraction,
            "extraction_notes": preflight.extraction_notes,
            "completed_at": preflight.completed_at.isoformat() if preflight.completed_at else None,
        },
        "pages": [
            {
                "id": str(p.id),
                "page_number": p.page_number,
                "page_size_label": p.page_size_label,
                "width_inches": float(p.width_inches) if p.width_inches else None,
                "height_inches": float(p.height_inches) if p.height_inches else None,
                "has_text": p.has_text,
                "text_char_count": p.text_char_count,
                "text_preview": p.text_preview,
                "has_vector_graphics": p.has_vector_graphics,
                "has_images": p.has_images,
                "is_likely_scanned": p.is_likely_scanned,
                "needs_ocr": p.needs_ocr,
                "sheet_label": p.sheet_label,
                "sheet_title": p.sheet_title,
                "sheet_type": p.sheet_type,
                "is_schedule_page": p.is_schedule_page,
                "is_cabinet_related": p.is_cabinet_related,
                "cabinet_keywords": p.cabinet_keywords,
                "bookmark_path": p.bookmark_path,
            }
            for p in pages
        ],
    }


# ── Extraction ──────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/extract")
async def run_extraction(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Run the cabinet extraction pipeline on the project's document pages.
    Extracts evidence, schedules, plan intelligence, and cabinet requirements.
    """
    from services.auto_bid.extraction import (
        extract_evidence_from_pages, extract_schedules,
        build_plan_intelligence, generate_cabinet_requirements,
    )

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Get document pages
    result = await db.execute(
        select(DocumentPage)
        .where(DocumentPage.auto_bid_project_id == project.id)
        .order_by(DocumentPage.page_number)
    )
    pages = list(result.scalars().all())

    if not pages:
        return {
            "status": "no_pages",
            "message": "No document pages found. Run preflight first.",
            "evidence_count": 0,
            "cabinet_requirements_count": 0,
        }

    # Transition to EXTRACTING
    if project.status in ("PREFLIGHT", "WAITING_FOR_DOCUMENTS"):
        await transition_status(db, project.id, ProjectStatus.EXTRACTING, "system", "Starting extraction")

    # Run extraction pipeline
    evidence = await extract_evidence_from_pages(db, project.id, pages)
    schedules = await extract_schedules(db, project.id, pages)
    intelligence = await build_plan_intelligence(db, project.id, evidence)
    requirements = await generate_cabinet_requirements(db, project.id, evidence)

    await record_event(
        db, project.id, "system", "extract_complete", "auto_bid_project", project.id,
        new_values={
            "evidence_count": len(evidence),
            "schedules_count": len(schedules),
            "intelligence_count": len(intelligence),
            "requirements_count": len(requirements),
        },
    )
    await db.commit()

    return {
        "status": "complete",
        "evidence_count": len(evidence),
        "schedules_count": len(schedules),
        "intelligence_count": len(intelligence),
        "cabinet_requirements_count": len(requirements),
    }


@router.get("/projects/{project_id}/evidence")
async def list_evidence(
    project_id: str,
    evidence_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List extracted evidence for a project."""
    stmt = select(ExtractedEvidence).where(
        ExtractedEvidence.auto_bid_project_id == uuid.UUID(project_id)
    )
    if evidence_type:
        stmt = stmt.where(ExtractedEvidence.evidence_type == evidence_type)
    stmt = stmt.order_by(ExtractedEvidence.page_number, ExtractedEvidence.created_at)
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    evidence = result.scalars().all()

    return {
        "evidence": [
            {
                "id": str(e.id),
                "evidence_type": e.evidence_type,
                "raw_text": e.raw_text,
                "normalized_text": e.normalized_text,
                "confidence": float(e.confidence) if e.confidence else None,
                "page_number": e.page_number,
                "source_method": e.source_method,
                "meta": e.meta,
            }
            for e in evidence
        ],
        "count": len(evidence),
    }


@router.get("/projects/{project_id}/cabinet-requirements")
async def list_cabinet_requirements(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List cabinet requirements for a project."""
    result = await db.execute(
        select(CabinetRequirement)
        .where(CabinetRequirement.auto_bid_project_id == uuid.UUID(project_id))
        .order_by(CabinetRequirement.created_at)
    )
    reqs = result.scalars().all()

    return {
        "requirements": [
            {
                "id": str(r.id),
                "room_label": r.room_label,
                "unit_type": r.unit_type,
                "floor_level": r.floor_level,
                "cabinet_type": r.cabinet_type,
                "design_intent": r.design_intent,
                "quantity": r.quantity,
                "width": float(r.width) if r.width else None,
                "height": float(r.height) if r.height else None,
                "depth": float(r.depth) if r.depth else None,
                "finish": r.finish,
                "hardware": r.hardware,
                "countertop_spec": r.countertop_spec,
                "evidence_ids": [str(e) for e in (r.evidence_ids or [])],
                "page_numbers": r.page_numbers,
                "status": r.status,
            }
            for r in reqs
        ],
        "count": len(reqs),
    }


# ── BOM ─────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/bom/generate")
async def generate_bom(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Generate a BOM from extracted cabinet requirements."""
    from services.auto_bid.bom import generate_bom as do_generate_bom

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Get cabinet requirements
    result = await db.execute(
        select(CabinetRequirement)
        .where(CabinetRequirement.auto_bid_project_id == project.id)
        .order_by(CabinetRequirement.created_at)
    )
    reqs = list(result.scalars().all())

    if not reqs:
        return {
            "status": "no_requirements",
            "message": "No cabinet requirements found. Run extraction first.",
            "bom": None,
        }

    bom = await do_generate_bom(db, project.id, reqs)

    # Transition to BOM_GENERATED
    if project.status == "EXTRACTING":
        await transition_status(db, project.id, ProjectStatus.BOM_GENERATED, "system", "BOM generated")

    await record_event(
        db, project.id, "system", "bom_generate", "bom_version", bom.id,
        new_values={"version": bom.version_number, "lines": bom.total_lines},
    )
    await db.commit()

    return {
        "status": "complete",
        "bom": {
            "id": str(bom.id),
            "version_number": bom.version_number,
            "status": bom.status,
            "total_lines": bom.total_lines,
            "total_cabinets": bom.total_cabinets,
            "evidence_count": bom.evidence_count,
        },
    }


@router.get("/projects/{project_id}/bom")
async def get_bom(
    project_id: str,
    version: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get BOM versions for a project."""
    stmt = select(BOMVersion).where(
        BOMVersion.auto_bid_project_id == uuid.UUID(project_id)
    ).order_by(BOMVersion.version_number.desc())

    if version:
        stmt = stmt.where(BOMVersion.version_number == version).limit(1)
    else:
        stmt = stmt.limit(1)

    result = await db.execute(stmt)
    bom = result.scalar_one_or_none()
    if not bom:
        return {"bom": None, "lines": [], "message": "No BOM generated yet"}

    # Get lines
    result = await db.execute(
        select(BOMLine)
        .where(BOMLine.bom_version_id == bom.id)
        .order_by(BOMLine.line_number)
    )
    lines = result.scalars().all()

    return {
        "bom": {
            "id": str(bom.id),
            "version_number": bom.version_number,
            "status": bom.status,
            "total_lines": bom.total_lines,
            "total_cabinets": bom.total_cabinets,
            "generated_by": bom.generated_by,
            "evidence_count": bom.evidence_count,
            "approved_by": bom.approved_by,
            "approved_at": bom.approved_at.isoformat() if bom.approved_at else None,
            "created_at": bom.created_at.isoformat() if bom.created_at else None,
        },
        "lines": [
            {
                "id": str(l.id),
                "line_number": l.line_number,
                "design_intent": l.design_intent,
                "room_label": l.room_label,
                "unit_type": l.unit_type,
                "cabinet_type": l.cabinet_type,
                "quantity": l.quantity,
                "width": float(l.width) if l.width else None,
                "height": float(l.height) if l.height else None,
                "depth": float(l.depth) if l.depth else None,
                "finish": l.finish,
                "hardware": l.hardware,
                "countertop_spec": l.countertop_spec,
                "mapped_sku_id": str(l.mapped_sku_id) if l.mapped_sku_id else None,
                "sku_confidence": float(l.sku_confidence) if l.sku_confidence else None,
                "is_exception": l.is_exception,
                "exception_id": str(l.exception_id) if l.exception_id else None,
                "page_numbers": l.page_numbers,
            }
            for l in lines
        ],
    }


@router.post("/projects/{project_id}/bom/{bom_id}/approve")
async def approve_bom(
    project_id: str,
    bom_id: str,
    approved_by: str = "mike",
    db: AsyncSession = Depends(get_db),
):
    """Approve a BOM version."""
    from services.auto_bid.bom import approve_bom as do_approve_bom

    try:
        bom = await do_approve_bom(db, uuid.UUID(bom_id), approved_by)
        await record_event(
            db, uuid.UUID(project_id), approved_by, "approve", "bom_version", bom.id,
            new_values={"status": "APPROVED"},
        )
        await db.commit()
        return {
            "status": "approved",
            "bom_id": str(bom.id),
            "version": bom.version_number,
        }
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── SKU Catalog ─────────────────────────────────────────────────────────────────

@router.get("/sku-catalog")
async def list_sku_catalog(
    query: str = "",
    cabinet_type: str = "",
    manufacturer: str = "",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Search the SKU catalog."""
    from services.auto_bid.sku_intelli import search_sku_catalog as do_search

    skus = await do_search(db, query, cabinet_type, manufacturer, limit)
    return {
        "skus": [
            {
                "id": str(s.id),
                "sku_code": s.sku_code,
                "manufacturer": s.manufacturer,
                "product_line": s.product_line,
                "model": s.model,
                "cabinet_type": s.cabinet_type,
                "width": float(s.width) if s.width else None,
                "height": float(s.height) if s.height else None,
                "depth": float(s.depth) if s.depth else None,
                "finish": s.finish,
                "unit_cost": float(s.unit_cost) if s.unit_cost else None,
                "lead_time_days": s.lead_time_days,
                "is_active": s.is_active,
            }
            for s in skus
        ],
        "count": len(skus),
    }


@router.post("/sku-catalog")
async def create_sku(
    req: SKUCatalogCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a SKU to the catalog."""
    sku = SKUCatalog(
        sku_code=req.sku_code,
        manufacturer=req.manufacturer,
        product_line=req.product_line,
        series=req.series,
        model=req.model,
        cabinet_type=req.cabinet_type,
        width=req.width,
        height=req.height,
        depth=req.depth,
        finish=req.finish,
        hardware_included=req.hardware_included,
        unit_cost=req.unit_cost,
        lead_time_days=req.lead_time_days,
        freight_class=req.freight_class,
        notes=req.notes,
        cost_updated_at=datetime.now(timezone.utc) if req.unit_cost else None,
    )
    db.add(sku)
    await db.flush()
    await db.commit()

    return {
        "id": str(sku.id),
        "sku_code": sku.sku_code,
        "status": "created",
    }


# ── SKU Mapping ─────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/sku-mapping/run")
async def run_sku_mapping(
    project_id: str,
    bom_version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Run automatic SKU mapping for a BOM version."""
    from services.auto_bid.sku_intelli import map_skus_for_bom

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    mapping_result = await map_skus_for_bom(db, project.id, uuid.UUID(bom_version_id))

    # Transition to SKU_MAPPING
    if project.status == "BOM_GENERATED":
        await transition_status(db, project.id, ProjectStatus.SKU_MAPPING, "system", "SKU mapping started")

    await record_event(
        db, project.id, "system", "sku_mapping_complete", "bom_version", uuid.UUID(bom_version_id),
        new_values=mapping_result,
    )
    await db.commit()

    return {
        "status": "complete",
        **mapping_result,
    }


@router.post("/projects/{project_id}/bom-lines/{bom_line_id}/map-sku")
async def manual_map_sku(
    project_id: str,
    bom_line_id: str,
    req: SKUMappingRequest,
    db: AsyncSession = Depends(get_db),
):
    """Manually map a BOM line to a SKU."""
    from services.auto_bid.sku_intelli import manual_map_sku as do_map

    try:
        mapping = await do_map(db, uuid.UUID(bom_line_id), uuid.UUID(req.sku_id), req.actor, req.reason)
        await record_event(
            db, uuid.UUID(project_id), req.actor, "map_sku", "bom_line", uuid.UUID(bom_line_id),
            new_values={"sku_id": req.sku_id},
            reason=req.reason,
        )
        await db.commit()
        return {
            "status": "mapped",
            "mapping_id": str(mapping.id),
        }
    except ValueError as e:
        raise HTTPException(404, str(e))


# ── Exceptions ──────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/exceptions")
async def list_exceptions(
    project_id: str,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List exceptions for a project."""
    stmt = select(ExceptionModel).where(
        ExceptionModel.auto_bid_project_id == uuid.UUID(project_id)
    )
    if status:
        stmt = stmt.where(ExceptionModel.status == status)
    if severity:
        stmt = stmt.where(ExceptionModel.severity == severity)
    stmt = stmt.order_by(ExceptionModel.created_at.desc())

    result = await db.execute(stmt)
    exceptions = result.scalars().all()

    return {
        "exceptions": [
            {
                "id": str(e.id),
                "exception_type": e.exception_type,
                "severity": e.severity,
                "title": e.title,
                "description": e.description,
                "design_intent": e.design_intent,
                "cabinet_type": e.cabinet_type,
                "required_dimensions": e.required_dimensions,
                "required_finish": e.required_finish,
                "status": e.status,
                "resolution": e.resolution,
                "resolution_type": e.resolution_type,
                "resolved_by": e.resolved_by,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "bom_line_id": str(e.bom_line_id) if e.bom_line_id else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exceptions
        ],
        "count": len(exceptions),
    }


@router.post("/projects/{project_id}/exceptions/{exception_id}/resolve")
async def resolve_exception(
    project_id: str,
    exception_id: str,
    req: ExceptionResolveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Resolve an exception."""
    result = await db.execute(
        select(ExceptionModel).where(ExceptionModel.id == uuid.UUID(exception_id))
    )
    exc = result.scalar_one_or_none()
    if not exc:
        raise HTTPException(404, "Exception not found")

    exc.status = "RESOLVED"
    exc.resolution = req.resolution
    exc.resolution_type = req.resolution_type
    exc.resolved_by = req.resolved_by
    exc.resolved_at = datetime.now(timezone.utc)

    # If a new SKU is provided, update the BOM line
    if req.new_sku_id and exc.bom_line_id:
        from services.auto_bid.sku_intelli import manual_map_sku as do_map
        await do_map(db, exc.bom_line_id, uuid.UUID(req.new_sku_id), req.resolved_by, req.resolution)

    # Clear exception flag on BOM line
    if exc.bom_line_id:
        result = await db.execute(
            select(BOMLine).where(BOMLine.id == exc.bom_line_id)
        )
        line = result.scalar_one_or_none()
        if line:
            line.is_exception = False

    await record_event(
        db, uuid.UUID(project_id), req.resolved_by, "resolve_exception",
        "exception", exc.id,
        new_values={"status": "RESOLVED", "resolution_type": req.resolution_type},
        reason=req.resolution,
    )
    await db.commit()

    return {"status": "resolved", "exception_id": str(exc.id)}


# ── Value Engineering ──────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/ve-decisions")
async def list_ve_decisions(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List value engineering decisions for a project."""
    from services.auto_bid.value_engineering import get_ve_decisions

    decisions = await get_ve_decisions(db, uuid.UUID(project_id))
    return {
        "decisions": [
            {
                "id": str(d.id),
                "title": d.title,
                "description": d.description,
                "ve_type": d.ve_type,
                "before_description": d.before_description,
                "before_cost": float(d.before_cost) if d.before_cost else None,
                "after_description": d.after_description,
                "after_cost": float(d.after_cost) if d.after_cost else None,
                "cost_savings": float(d.cost_savings) if d.cost_savings else None,
                "rationale": d.rationale,
                "status": d.status,
                "decided_by": d.decided_by,
                "decided_at": d.decided_at.isoformat() if d.decided_at else None,
                "decision_notes": d.decision_notes,
            }
            for d in decisions
        ],
        "count": len(decisions),
    }


@router.post("/projects/{project_id}/ve-decisions")
async def create_ve(
    project_id: str,
    req: VEDecisionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a value engineering decision."""
    from services.auto_bid.value_engineering import create_ve_decision

    ve = await create_ve_decision(
        db, uuid.UUID(project_id),
        title=req.title,
        description=req.description,
        ve_type=req.ve_type,
        bom_line_id=uuid.UUID(req.bom_line_id) if req.bom_line_id else None,
        cabinet_requirement_id=uuid.UUID(req.cabinet_requirement_id) if req.cabinet_requirement_id else None,
        before_description=req.before_description,
        before_sku_id=uuid.UUID(req.before_sku_id) if req.before_sku_id else None,
        before_quantity=req.before_quantity,
        before_cost=req.before_cost,
        after_description=req.after_description,
        after_sku_id=uuid.UUID(req.after_sku_id) if req.after_sku_id else None,
        after_quantity=req.after_quantity,
        after_cost=req.after_cost,
        rationale=req.rationale,
    )
    await record_event(
        db, uuid.UUID(project_id), "mike", "ve_create", "value_engineering_decision", ve.id,
        new_values={"title": req.title, "ve_type": req.ve_type},
    )
    await db.commit()

    return {"id": str(ve.id), "status": "created"}


@router.post("/projects/{project_id}/ve-decisions/{ve_id}/approve")
async def approve_ve(
    project_id: str,
    ve_id: str,
    req: VEDecisionAction,
    db: AsyncSession = Depends(get_db),
):
    """Approve a VE decision."""
    from services.auto_bid.value_engineering import approve_ve_decision

    ve = await approve_ve_decision(db, uuid.UUID(ve_id), req.decided_by, req.decision_notes)
    await record_event(
        db, uuid.UUID(project_id), req.decided_by, "ve_approve", "value_engineering_decision", ve.id,
        new_values={"status": "APPROVED"},
    )
    await db.commit()
    return {"status": "approved", "ve_id": str(ve.id)}


@router.post("/projects/{project_id}/ve-decisions/{ve_id}/reject")
async def reject_ve(
    project_id: str,
    ve_id: str,
    req: VEDecisionAction,
    db: AsyncSession = Depends(get_db),
):
    """Reject a VE decision."""
    from services.auto_bid.value_engineering import reject_ve_decision

    ve = await reject_ve_decision(db, uuid.UUID(ve_id), req.decided_by, req.decision_notes)
    await record_event(
        db, uuid.UUID(project_id), req.decided_by, "ve_reject", "value_engineering_decision", ve.id,
        new_values={"status": "REJECTED"},
    )
    await db.commit()
    return {"status": "rejected", "ve_id": str(ve.id)}


# ── Pricing ─────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/pricing/generate")
async def generate_pricing(
    project_id: str,
    req: PricingGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a pricing version from a BOM."""
    from services.auto_bid.pricing import generate_pricing as do_pricing

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    pricing = await do_pricing(
        db, project.id, uuid.UUID(req.bom_version_id),
        desired_margin_percent=req.desired_margin_percent,
        rep_commission_percent=req.rep_commission_percent,
        contingency_percent=req.contingency_percent,
    )

    # Transition to PRICING
    if project.status in ("SKU_MAPPING", "EXCEPTIONS_REVIEW", "BOM_GENERATED"):
        await transition_status(db, project.id, ProjectStatus.PRICING, "system", "Pricing generated")

    await record_event(
        db, project.id, "system", "pricing_generate", "pricing_version", pricing.id,
        new_values={
            "version": pricing.version_number,
            "landed_cost": float(pricing.landed_cost),
            "is_blocked": pricing.is_blocked,
        },
    )
    await db.commit()

    return {
        "status": "complete",
        "pricing": {
            "id": str(pricing.id),
            "version_number": pricing.version_number,
            "status": pricing.status,
            "landed_cost": float(pricing.landed_cost),
            "suggested_sell_price": float(pricing.suggested_sell_price),
            "gross_profit": float(pricing.gross_profit),
            "gross_margin_percent": float(pricing.gross_margin_percent),
            "is_blocked": pricing.is_blocked,
            "block_reasons": pricing.block_reasons,
            "risk_flags": pricing.risk_flags,
            "meets_margin_floor": pricing.meets_margin_floor,
            "meets_commission_floor": pricing.meets_commission_floor,
        },
    }


@router.get("/projects/{project_id}/pricing")
async def get_pricing(
    project_id: str,
    version: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get pricing version for a project."""
    stmt = select(PricingVersion).where(
        PricingVersion.auto_bid_project_id == uuid.UUID(project_id)
    ).order_by(PricingVersion.version_number.desc())

    if version:
        stmt = stmt.where(PricingVersion.version_number == version).limit(1)
    else:
        stmt = stmt.limit(1)

    result = await db.execute(stmt)
    pricing = result.scalar_one_or_none()
    if not pricing:
        return {"pricing": None, "lines": [], "message": "No pricing generated yet"}

    # Get lines
    result = await db.execute(
        select(PricingLine)
        .where(PricingLine.pricing_version_id == pricing.id)
        .order_by(PricingLine.line_number)
    )
    lines = result.scalars().all()

    return {
        "pricing": {
            "id": str(pricing.id),
            "version_number": pricing.version_number,
            "status": pricing.status,
            "total_product_cost": float(pricing.total_product_cost),
            "total_freight": float(pricing.total_freight),
            "total_duties_tariffs": float(pricing.total_duties_tariffs),
            "total_tax": float(pricing.total_tax),
            "total_storage": float(pricing.total_storage),
            "total_delivery": float(pricing.total_delivery),
            "total_installation": float(pricing.total_installation),
            "total_contingency": float(pricing.total_contingency),
            "total_other_costs": float(pricing.total_other_costs),
            "landed_cost": float(pricing.landed_cost),
            "desired_margin_percent": float(pricing.desired_margin_percent),
            "suggested_sell_price": float(pricing.suggested_sell_price),
            "gross_profit": float(pricing.gross_profit),
            "gross_margin_percent": float(pricing.gross_margin_percent),
            "rep_commission_percent": float(pricing.rep_commission_percent) if pricing.rep_commission_percent else None,
            "rep_commission_amount": float(pricing.rep_commission_amount) if pricing.rep_commission_amount else None,
            "vulpine_retained_profit": float(pricing.vulpine_retained_profit) if pricing.vulpine_retained_profit else None,
            "is_blocked": pricing.is_blocked,
            "block_reasons": pricing.block_reasons,
            "risk_flags": pricing.risk_flags,
            "meets_margin_floor": pricing.meets_margin_floor,
            "meets_commission_floor": pricing.meets_commission_floor,
            "approved_by": pricing.approved_by,
            "approved_at": pricing.approved_at.isoformat() if pricing.approved_at else None,
        },
        "lines": [
            {
                "id": str(l.id),
                "line_number": l.line_number,
                "sku_code": l.sku_code,
                "cabinet_type": l.cabinet_type,
                "quantity": l.quantity,
                "unit_cost": float(l.unit_cost) if l.unit_cost else None,
                "extended_product_cost": float(l.extended_product_cost),
                "line_landed_cost": float(l.line_landed_cost),
                "has_cost": l.has_cost,
                "is_blocked": l.is_blocked,
                "block_reason": l.block_reason,
            }
            for l in lines
        ],
    }


@router.post("/projects/{project_id}/pricing/{pricing_id}/approve")
async def approve_pricing(
    project_id: str,
    pricing_id: str,
    approved_by: str = "mike",
    db: AsyncSession = Depends(get_db),
):
    """Approve a pricing version."""
    from services.auto_bid.pricing import approve_pricing as do_approve

    try:
        pricing = await do_approve(db, uuid.UUID(pricing_id), approved_by)
        await record_event(
            db, uuid.UUID(project_id), approved_by, "approve", "pricing_version", pricing.id,
            new_values={"status": "APPROVED"},
        )
        await db.commit()
        return {"status": "approved", "pricing_id": str(pricing.id)}
    except ValueError as e:
        raise HTTPException(409, str(e))


# ── QA ──────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/qa/run")
async def run_qa(
    project_id: str,
    pricing_version_id: Optional[str] = None,
    bom_version_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Run QA checks."""
    from services.auto_bid.qa import run_qa as do_qa

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Auto-detect latest pricing/bom if not specified
    if not pricing_version_id:
        result = await db.execute(
            select(PricingVersion)
            .where(PricingVersion.auto_bid_project_id == project.id)
            .order_by(PricingVersion.version_number.desc())
            .limit(1)
        )
        pv = result.scalar_one_or_none()
        pricing_version_id = str(pv.id) if pv else None

    if not bom_version_id:
        result = await db.execute(
            select(BOMVersion)
            .where(BOMVersion.auto_bid_project_id == project.id)
            .order_by(BOMVersion.version_number.desc())
            .limit(1)
        )
        bv = result.scalar_one_or_none()
        bom_version_id = str(bv.id) if bv else None

    qa_run = await do_qa(
        db, project.id,
        uuid.UUID(pricing_version_id) if pricing_version_id else None,
        uuid.UUID(bom_version_id) if bom_version_id else None,
    )

    # Transition to QA
    if project.status == "PRICING":
        await transition_status(db, project.id, ProjectStatus.QA, "system", "QA run started")

    # Get findings
    result = await db.execute(
        select(QAFinding).where(QAFinding.qa_run_id == qa_run.id)
    )
    findings = result.scalars().all()

    await record_event(
        db, project.id, "system", "qa_run", "qa_run", qa_run.id,
        new_values={
            "status": qa_run.status,
            "blockers": qa_run.blockers_count,
            "warnings": qa_run.warnings_count,
        },
    )
    await db.commit()

    return {
        "qa_run": {
            "id": str(qa_run.id),
            "run_number": qa_run.run_number,
            "status": qa_run.status,
            "total_checks": qa_run.total_checks,
            "blockers_count": qa_run.blockers_count,
            "warnings_count": qa_run.warnings_count,
            "info_count": qa_run.info_count,
            "is_proposal_blocked": qa_run.is_proposal_blocked,
        },
        "findings": [
            {
                "id": str(f.id),
                "check_name": f.check_name,
                "severity": f.severity,
                "message": f.message,
                "entity_type": f.entity_type,
                "entity_id": str(f.entity_id) if f.entity_id else None,
                "expected_value": f.expected_value,
                "actual_value": f.actual_value,
                "is_resolved": f.is_resolved,
            }
            for f in findings
        ],
    }


@router.get("/projects/{project_id}/qa")
async def get_qa(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get latest QA run for a project."""
    result = await db.execute(
        select(QARun)
        .where(QARun.auto_bid_project_id == uuid.UUID(project_id))
        .order_by(QARun.run_number.desc())
        .limit(1)
    )
    qa_run = result.scalar_one_or_none()
    if not qa_run:
        return {"qa_run": None, "findings": [], "message": "No QA runs yet"}

    result = await db.execute(
        select(QAFinding).where(QAFinding.qa_run_id == qa_run.id)
    )
    findings = result.scalars().all()

    return {
        "qa_run": {
            "id": str(qa_run.id),
            "run_number": qa_run.run_number,
            "status": qa_run.status,
            "total_checks": qa_run.total_checks,
            "blockers_count": qa_run.blockers_count,
            "warnings_count": qa_run.warnings_count,
            "info_count": qa_run.info_count,
            "is_proposal_blocked": qa_run.is_proposal_blocked,
            "created_at": qa_run.created_at.isoformat() if qa_run.created_at else None,
        },
        "findings": [
            {
                "id": str(f.id),
                "check_name": f.check_name,
                "severity": f.severity,
                "message": f.message,
                "entity_type": f.entity_type,
                "entity_id": str(f.entity_id) if f.entity_id else None,
                "is_resolved": f.is_resolved,
                "resolution": f.resolution,
            }
            for f in findings
        ],
    }


# ── Proposal ────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/proposal/generate")
async def generate_proposal(
    project_id: str,
    req: ProposalGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a proposal from approved BOM + pricing."""
    from services.auto_bid.proposal import generate_proposal as do_proposal
    from services.auto_bid.qa import can_generate_proposal

    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == uuid.UUID(project_id))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    # Check if proposal can be generated
    can_generate = await can_generate_proposal(db, project.id)
    if not can_generate:
        raise HTTPException(
            409,
            "Cannot generate proposal — resolve all QA blockers first"
        )

    proposal = await do_proposal(
        db, project.id,
        uuid.UUID(req.pricing_version_id),
        uuid.UUID(req.bom_version_id),
        uuid.UUID(req.qa_run_id) if req.qa_run_id else None,
        req.template_name,
    )

    # Transition to PROPOSAL_GENERATED
    if project.status == "QA":
        await transition_status(db, project.id, ProjectStatus.PROPOSAL_GENERATED, "system", "Proposal generated")

    await record_event(
        db, project.id, "system", "proposal_generate", "proposal_version", proposal.id,
        new_values={"version": proposal.version_number, "proposal_number": proposal.proposal_number},
    )
    await db.commit()

    return {
        "status": "complete",
        "proposal": {
            "id": str(proposal.id),
            "version_number": proposal.version_number,
            "proposal_number": proposal.proposal_number,
            "title": proposal.title,
            "proposal_date": proposal.proposal_date.isoformat() if proposal.proposal_date else None,
            "valid_until": proposal.valid_until.isoformat() if proposal.valid_until else None,
            "total_price": float(proposal.total_price) if proposal.total_price else None,
            "total_cabinets": proposal.total_cabinets,
            "status": proposal.status,
            "html_file_path": proposal.html_file_path,
            "pdf_file_path": proposal.pdf_file_path,
        },
    }


@router.get("/projects/{project_id}/proposal")
async def get_proposal(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get latest proposal for a project."""
    result = await db.execute(
        select(ProposalVersion)
        .where(ProposalVersion.auto_bid_project_id == uuid.UUID(project_id))
        .order_by(ProposalVersion.version_number.desc())
        .limit(1)
    )
    proposal = result.scalar_one_or_none()
    if not proposal:
        return {"proposal": None, "message": "No proposals generated yet"}

    return {
        "proposal": {
            "id": str(proposal.id),
            "version_number": proposal.version_number,
            "proposal_number": proposal.proposal_number,
            "title": proposal.title,
            "proposal_date": proposal.proposal_date.isoformat() if proposal.proposal_date else None,
            "valid_until": proposal.valid_until.isoformat() if proposal.valid_until else None,
            "executive_summary": proposal.executive_summary,
            "scope_summary": proposal.scope_summary,
            "total_price": float(proposal.total_price) if proposal.total_price else None,
            "total_cabinets": proposal.total_cabinets,
            "estimated_lead_time": proposal.estimated_lead_time,
            "warranty_terms": proposal.warranty_terms,
            "payment_terms": proposal.payment_terms,
            "status": proposal.status,
            "html_file_path": proposal.html_file_path,
            "pdf_file_path": proposal.pdf_file_path,
            "approved_by": proposal.approved_by,
            "approved_at": proposal.approved_at.isoformat() if proposal.approved_at else None,
            "created_at": proposal.created_at.isoformat() if proposal.created_at else None,
        },
    }


# ── Dashboard / Stats ──────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get dashboard statistics."""
    # Total projects
    result = await db.execute(select(func.count(AutoBidProject.id)))
    total_projects = result.scalar()

    # By status
    result = await db.execute(
        select(AutoBidProject.status, func.count(AutoBidProject.id))
        .group_by(AutoBidProject.status)
    )
    by_status = {row[0]: row[1] for row in result}

    # By stage
    result = await db.execute(
        select(AutoBidProject.current_stage, func.count(AutoBidProject.id))
        .group_by(AutoBidProject.current_stage)
    )
    by_stage = {row[0]: row[1] for row in result}

    # Total SKUs in catalog
    result = await db.execute(select(func.count(SKUCatalog.id)))
    total_skus = result.scalar()

    # Total exceptions
    result = await db.execute(
        select(func.count(ExceptionModel.id))
        .where(ExceptionModel.status == "OPEN")
    )
    open_exceptions = result.scalar()

    return {
        "total_projects": total_projects,
        "by_status": by_status,
        "by_stage": by_stage,
        "total_skus": total_skus,
        "open_exceptions": open_exceptions,
    }