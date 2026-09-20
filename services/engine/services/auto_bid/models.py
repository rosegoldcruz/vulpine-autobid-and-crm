"""
SQLAlchemy models for the Auto Bid domain.
All tables map to the migration in db/migrations/001_auto_bid.sql.
"""

import uuid
from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Float, Numeric, Boolean, Text, Date, DateTime,
    ForeignKey, JSON, Index, UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from shared.database import Base

# Import existing table stubs so SQLAlchemy can resolve foreign keys
from services.auto_bid.existing_models import Project, Opportunity, Document


# ── Auto Bid Project ────────────────────────────────────────────────────────────

class AutoBidProject(Base):
    __tablename__ = "auto_bid_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    opportunity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("opportunities.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="CREATED")
    current_stage: Mapped[str] = mapped_column(String(50), nullable=False, server_default="UPLOAD")
    stage_history: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    assigned_to: Mapped[Optional[str]] = mapped_column(String(200))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Document Pages ──────────────────────────────────────────────────────────────

class DocumentPage(Base):
    __tablename__ = "document_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    width_pts: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    height_pts: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    width_inches: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    height_inches: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    page_size_label: Mapped[Optional[str]] = mapped_column(String(50))
    has_text: Mapped[bool] = mapped_column(Boolean, server_default="false")
    text_char_count: Mapped[int] = mapped_column(Integer, server_default="0")
    text_preview: Mapped[Optional[str]] = mapped_column(Text)
    has_vector_graphics: Mapped[bool] = mapped_column(Boolean, server_default="false")
    has_images: Mapped[bool] = mapped_column(Boolean, server_default="false")
    image_count: Mapped[int] = mapped_column(Integer, server_default="0")
    is_likely_scanned: Mapped[bool] = mapped_column(Boolean, server_default="false")
    needs_ocr: Mapped[bool] = mapped_column(Boolean, server_default="false")
    sheet_label: Mapped[Optional[str]] = mapped_column(String(200))
    sheet_title: Mapped[Optional[str]] = mapped_column(String(1000))
    sheet_type: Mapped[Optional[str]] = mapped_column(String(100))
    is_schedule_page: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_finish_schedule: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_cabinet_related: Mapped[bool] = mapped_column(Boolean, server_default="false")
    cabinet_keywords: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    ocr_text: Mapped[Optional[str]] = mapped_column(Text)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    bookmark_path: Mapped[Optional[str]] = mapped_column(String(1000))
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Preflight Results ───────────────────────────────────────────────────────────

class PreflightResult(Base):
    __tablename__ = "preflight_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    total_documents: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    page_sizes: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    schedule_pages_count: Mapped[int] = mapped_column(Integer, server_default="0")
    cabinet_keyword_pages: Mapped[int] = mapped_column(Integer, server_default="0")
    scanned_pages_count: Mapped[int] = mapped_column(Integer, server_default="0")
    needs_ocr_count: Mapped[int] = mapped_column(Integer, server_default="0")
    has_bookmarks: Mapped[bool] = mapped_column(Boolean, server_default="false")
    bookmark_count: Mapped[int] = mapped_column(Integer, server_default="0")
    detected_sheets: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    cabinet_keywords_found: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    file_sizes_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    warnings: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    is_ready_for_extraction: Mapped[bool] = mapped_column(Boolean, server_default="false")
    extraction_notes: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Sheets ──────────────────────────────────────────────────────────────────────

class Sheet(Base):
    __tablename__ = "sheets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    page_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("document_pages.id"), nullable=True)
    sheet_label: Mapped[Optional[str]] = mapped_column(String(200))
    sheet_title: Mapped[Optional[str]] = mapped_column(String(1000))
    sheet_type: Mapped[Optional[str]] = mapped_column(String(100))
    page_number: Mapped[Optional[int]] = mapped_column(Integer)
    scale: Mapped[Optional[str]] = mapped_column(String(100))
    north_arrow: Mapped[bool] = mapped_column(Boolean, server_default="false")
    has_dimensions: Mapped[bool] = mapped_column(Boolean, server_default="false")
    detected_objects: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Extracted Evidence ──────────────────────────────────────────────────────────

class ExtractedEvidence(Base):
    __tablename__ = "extracted_evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    page_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("document_pages.id"), nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_text: Mapped[Optional[str]] = mapped_column(Text)
    normalized_text: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), server_default="1.0")
    page_number: Mapped[Optional[int]] = mapped_column(Integer)
    bounding_box: Mapped[Optional[dict]] = mapped_column(JSONB)
    source_method: Mapped[str] = mapped_column(String(50), server_default="text_extraction")
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Detected Schedules ──────────────────────────────────────────────────────────

class DetectedSchedule(Base):
    __tablename__ = "detected_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    page_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("document_pages.id"), nullable=True)
    schedule_type: Mapped[str] = mapped_column(String(100), nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer)
    raw_text: Mapped[Optional[str]] = mapped_column(Text)
    parsed_entries: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Plan Intelligence Objects ───────────────────────────────────────────────────

class PlanIntelligenceObject(Base):
    __tablename__ = "plan_intelligence_objects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    object_type: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(500))
    quantity: Mapped[Optional[int]] = mapped_column(Integer)
    floor_level: Mapped[Optional[str]] = mapped_column(String(50))
    building_label: Mapped[Optional[str]] = mapped_column(String(200))
    design_intent: Mapped[Optional[str]] = mapped_column(Text)
    evidence_ids: Mapped[Optional[List[str]]] = mapped_column(ARRAY(UUID(as_uuid=True)))
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Cabinet Requirements ────────────────────────────────────────────────────────

class CabinetRequirement(Base):
    __tablename__ = "cabinet_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    room_label: Mapped[Optional[str]] = mapped_column(String(500))
    unit_type: Mapped[Optional[str]] = mapped_column(String(200))
    floor_level: Mapped[Optional[str]] = mapped_column(String(50))
    building_label: Mapped[Optional[str]] = mapped_column(String(200))
    cabinet_type: Mapped[Optional[str]] = mapped_column(String(200))
    design_intent: Mapped[Optional[str]] = mapped_column(Text)
    quantity: Mapped[Optional[int]] = mapped_column(Integer)
    width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    height: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    depth: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    finish: Mapped[Optional[str]] = mapped_column(String(500))
    hardware: Mapped[Optional[str]] = mapped_column(String(500))
    countertop_spec: Mapped[Optional[str]] = mapped_column(String(500))
    special_notes: Mapped[Optional[str]] = mapped_column(Text)
    evidence_ids: Mapped[Optional[List[str]]] = mapped_column(ARRAY(UUID(as_uuid=True)))
    page_numbers: Mapped[Optional[List[int]]] = mapped_column(ARRAY(Integer))
    source_method: Mapped[str] = mapped_column(String(50), server_default="extraction")
    proposed_sku: Mapped[Optional[str]] = mapped_column(String(200))
    proposed_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), server_default="EXTRACTED")
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── BOM Versions ────────────────────────────────────────────────────────────────

class BOMVersion(Base):
    __tablename__ = "bom_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="DRAFT")
    total_lines: Mapped[int] = mapped_column(Integer, server_default="0")
    total_cabinets: Mapped[int] = mapped_column(Integer, server_default="0")
    total_linear_feet: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    generated_by: Mapped[str] = mapped_column(String(50), server_default="engine")
    evidence_count: Mapped[int] = mapped_column(Integer, server_default="0")
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── BOM Lines ───────────────────────────────────────────────────────────────────

class BOMLine(Base):
    __tablename__ = "bom_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    bom_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_versions.id", ondelete="CASCADE"), nullable=False)
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    design_intent: Mapped[Optional[str]] = mapped_column(Text)
    room_label: Mapped[Optional[str]] = mapped_column(String(500))
    unit_type: Mapped[Optional[str]] = mapped_column(String(200))
    floor_level: Mapped[Optional[str]] = mapped_column(String(50))
    cabinet_type: Mapped[Optional[str]] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    height: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    depth: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    finish: Mapped[Optional[str]] = mapped_column(String(500))
    hardware: Mapped[Optional[str]] = mapped_column(String(500))
    countertop_spec: Mapped[Optional[str]] = mapped_column(String(500))
    cabinet_requirement_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cabinet_requirements.id"), nullable=True)
    evidence_ids: Mapped[Optional[List[str]]] = mapped_column(ARRAY(UUID(as_uuid=True)))
    page_numbers: Mapped[Optional[List[int]]] = mapped_column(ARRAY(Integer))
    mapped_sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    sku_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    is_exception: Mapped[bool] = mapped_column(Boolean, server_default="false")
    exception_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── SKU Catalog ─────────────────────────────────────────────────────────────────

class SKUCatalog(Base):
    __tablename__ = "sku_catalog"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    sku_code: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(500))
    product_line: Mapped[Optional[str]] = mapped_column(String(500))
    series: Mapped[Optional[str]] = mapped_column(String(500))
    model: Mapped[Optional[str]] = mapped_column(String(500))
    cabinet_type: Mapped[Optional[str]] = mapped_column(String(200))
    width: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    height: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    depth: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    finish: Mapped[Optional[str]] = mapped_column(String(500))
    hardware_included: Mapped[bool] = mapped_column(Boolean, server_default="false")
    unit_cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    cost_currency: Mapped[str] = mapped_column(String(10), server_default="USD")
    cost_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lead_time_days: Mapped[Optional[int]] = mapped_column(Integer)
    freight_class: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    discontinued: Mapped[bool] = mapped_column(Boolean, server_default="false")
    spec_sheet_url: Mapped[Optional[str]] = mapped_column(String(2000))
    image_url: Mapped[Optional[str]] = mapped_column(String(2000))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── SKU Aliases ─────────────────────────────────────────────────────────────────

class SKUAlias(Base):
    __tablename__ = "sku_aliases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    sku_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sku_catalog.id", ondelete="CASCADE"), nullable=False)
    alias: Mapped[str] = mapped_column(String(500), nullable=False)
    alias_type: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── SKU Mappings ────────────────────────────────────────────────────────────────

class SKUMapping(Base):
    __tablename__ = "sku_mappings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    bom_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False)
    sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sku_catalog.id"), nullable=True)
    match_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    match_method: Mapped[Optional[str]] = mapped_column(String(50))
    is_ai_recommendation: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_human_approved: Mapped[bool] = mapped_column(Boolean, server_default="false")
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── SKU Mapping History ────────────────────────────────────────────────────────

class SKUMappingHistory(Base):
    __tablename__ = "sku_mapping_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    sku_mapping_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sku_mappings.id", ondelete="CASCADE"), nullable=False)
    bom_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False)
    old_sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    new_sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    old_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    new_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    change_reason: Mapped[Optional[str]] = mapped_column(Text)
    actor: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Exceptions ──────────────────────────────────────────────────────────────────

class Exception(Base):
    __tablename__ = "exceptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    bom_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_lines.id"), nullable=True)
    exception_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, server_default="WARNING")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    design_intent: Mapped[Optional[str]] = mapped_column(Text)
    cabinet_type: Mapped[Optional[str]] = mapped_column(String(200))
    required_dimensions: Mapped[Optional[dict]] = mapped_column(JSONB)
    required_finish: Mapped[Optional[str]] = mapped_column(String(500))
    suggested_skus: Mapped[Optional[List[str]]] = mapped_column(ARRAY(UUID(as_uuid=True)))
    suggested_actions: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="OPEN")
    resolution: Mapped[Optional[str]] = mapped_column(Text)
    resolution_type: Mapped[Optional[str]] = mapped_column(String(100))
    resolved_by: Mapped[Optional[str]] = mapped_column(String(200))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Review Decisions ────────────────────────────────────────────────────────────

class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    decision: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    reviewer: Mapped[str] = mapped_column(String(200), nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Value Engineering Decisions ────────────────────────────────────────────────

class ValueEngineeringDecision(Base):
    __tablename__ = "value_engineering_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    bom_line_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=True)
    cabinet_requirement_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("cabinet_requirements.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ve_type: Mapped[Optional[str]] = mapped_column(String(100))
    before_description: Mapped[Optional[str]] = mapped_column(Text)
    before_sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    before_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    before_cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    after_description: Mapped[Optional[str]] = mapped_column(Text)
    after_sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    after_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    after_cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    cost_savings: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    rationale: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="PROPOSED")
    decided_by: Mapped[Optional[str]] = mapped_column(String(200))
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    decision_notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Pricing Versions ────────────────────────────────────────────────────────────

class PricingVersion(Base):
    __tablename__ = "pricing_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    bom_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_versions.id"), nullable=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="DRAFT")
    total_product_cost: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_freight: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_duties_tariffs: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_tax: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_storage: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_delivery: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_installation: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_contingency: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    total_other_costs: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    landed_cost: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    desired_margin_percent: Mapped[float] = mapped_column(Numeric(6, 2), server_default="18.0")
    suggested_sell_price: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    gross_profit: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    gross_margin_percent: Mapped[float] = mapped_column(Numeric(6, 2), server_default="0")
    rep_commission_percent: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), server_default="0")
    rep_commission_amount: Mapped[Optional[float]] = mapped_column(Numeric(16, 2), server_default="0")
    vulpine_retained_profit: Mapped[Optional[float]] = mapped_column(Numeric(16, 2), server_default="0")
    risk_flags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    is_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false")
    block_reasons: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    meets_margin_floor: Mapped[bool] = mapped_column(Boolean, server_default="false")
    meets_commission_floor: Mapped[bool] = mapped_column(Boolean, server_default="false")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Pricing Lines ───────────────────────────────────────────────────────────────

class PricingLine(Base):
    __tablename__ = "pricing_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    pricing_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pricing_versions.id", ondelete="CASCADE"), nullable=False)
    bom_line_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_lines.id", ondelete="CASCADE"), nullable=False)
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    sku_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("sku_catalog.id"), nullable=True)
    sku_code: Mapped[Optional[str]] = mapped_column(String(200))
    cabinet_type: Mapped[Optional[str]] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), server_default="0")
    extended_product_cost: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    freight: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    duties_tariffs: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    tax: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    storage: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    delivery: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    installation: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    contingency: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    other_costs: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    line_landed_cost: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    line_sell_price: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    line_gross_profit: Mapped[float] = mapped_column(Numeric(16, 2), server_default="0")
    has_cost: Mapped[bool] = mapped_column(Boolean, server_default="false")
    is_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false")
    block_reason: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── QA Runs ─────────────────────────────────────────────────────────────────────

class QARun(Base):
    __tablename__ = "qa_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    pricing_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("pricing_versions.id"), nullable=True)
    bom_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_versions.id"), nullable=True)
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="PASSED")
    total_checks: Mapped[int] = mapped_column(Integer, server_default="0")
    blockers_count: Mapped[int] = mapped_column(Integer, server_default="0")
    warnings_count: Mapped[int] = mapped_column(Integer, server_default="0")
    info_count: Mapped[int] = mapped_column(Integer, server_default="0")
    is_proposal_blocked: Mapped[bool] = mapped_column(Boolean, server_default="false")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── QA Findings ─────────────────────────────────────────────────────────────────

class QAFinding(Base):
    __tablename__ = "qa_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    qa_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("qa_runs.id", ondelete="CASCADE"), nullable=False)
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    check_name: Mapped[str] = mapped_column(String(200), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(100))
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    expected_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    actual_value: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_resolved: Mapped[bool] = mapped_column(Boolean, server_default="false")
    resolution: Mapped[Optional[str]] = mapped_column(Text)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(200))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Proposal Versions ───────────────────────────────────────────────────────────

class ProposalVersion(Base):
    __tablename__ = "proposal_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=False)
    pricing_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("pricing_versions.id"), nullable=True)
    bom_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("bom_versions.id"), nullable=True)
    qa_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("qa_runs.id"), nullable=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="DRAFT")
    title: Mapped[Optional[str]] = mapped_column(String(1000))
    proposal_number: Mapped[Optional[str]] = mapped_column(String(100))
    proposal_date: Mapped[Optional[date]] = mapped_column(Date)
    valid_until: Mapped[Optional[date]] = mapped_column(Date)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text)
    scope_summary: Mapped[Optional[str]] = mapped_column(Text)
    total_price: Mapped[Optional[float]] = mapped_column(Numeric(16, 2))
    total_cabinets: Mapped[Optional[int]] = mapped_column(Integer)
    estimated_lead_time: Mapped[Optional[str]] = mapped_column(String(200))
    warranty_terms: Mapped[Optional[str]] = mapped_column(Text)
    payment_terms: Mapped[Optional[str]] = mapped_column(Text)
    pdf_file_path: Mapped[Optional[str]] = mapped_column(String(2000))
    html_file_path: Mapped[Optional[str]] = mapped_column(String(2000))
    template_name: Mapped[str] = mapped_column(String(200), server_default="default")
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Audit Events ────────────────────────────────────────────────────────────────

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    auto_bid_project_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auto_bid_projects.id", ondelete="CASCADE"), nullable=True)
    actor: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())