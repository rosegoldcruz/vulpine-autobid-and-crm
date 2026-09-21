-- ═══════════════════════════════════════════════════════════════════════════════
-- Vulpine Auto Bidder V1 — Domain Tables Migration
-- Add to existing PostgreSQL (vulpine database), alongside existing tables.
-- All tables use UUID PKs, TIMESTAMPTZ, JSONB for flexible structured data.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── auto_bid_projects ──────────────────────────────────────────────────────────
-- Top-level container for an Auto Bid job. Links to existing projects table.

CREATE TABLE IF NOT EXISTS auto_bid_projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,

    name            VARCHAR(1000) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    -- State machine: CREATED → WAITING_FOR_DOCUMENTS → PREFLIGHT → EXTRACTING →
    -- BOM_GENERATED → SKU_MAPPING → EXCEPTIONS_REVIEW → PRICING → QA →
    -- PROPOSAL_GENERATED → COMPLETE   |   FAILED

    current_stage   VARCHAR(50) NOT NULL DEFAULT 'UPLOAD',
    -- 9-stage workflow stage: UPLOAD, PREFLIGHT, EXTRACT, BOM, SKU_MAP,
    -- EXCEPTIONS, PRICE, QA, PROPOSAL

    stage_history   JSONB DEFAULT '[]'::jsonb,
    -- [{stage, entered_at, exited_at, actor}]

    -- Tracking
    assigned_to     VARCHAR(200),
    due_date        DATE,
    notes           TEXT,
    error_message   TEXT,
    failed_at       TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abp_project ON auto_bid_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_abp_status ON auto_bid_projects(status);
CREATE INDEX IF NOT EXISTS idx_abp_stage ON auto_bid_projects(current_stage);

-- ── document_pages ─────────────────────────────────────────────────────────────
-- Per-page analysis of uploaded PDF documents.

CREATE TABLE IF NOT EXISTS document_pages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    document_id         UUID REFERENCES documents(id) ON DELETE SET NULL,

    page_number         INTEGER NOT NULL,
    width_pts           NUMERIC(10,2),
    height_pts          NUMERIC(10,2),
    width_inches        NUMERIC(10,2),
    height_inches       NUMERIC(10,2),
    page_size_label     VARCHAR(50),   -- 'ARCH_D', 'ANSI_E', 'LETTER', 'TABLOID', etc.

    has_text            BOOLEAN DEFAULT FALSE,
    text_char_count     INTEGER DEFAULT 0,
    text_preview        TEXT,          -- first 500 chars
    has_vector_graphics BOOLEAN DEFAULT FALSE,
    has_images          BOOLEAN DEFAULT FALSE,
    image_count         INTEGER DEFAULT 0,
    is_likely_scanned   BOOLEAN DEFAULT FALSE,
    needs_ocr           BOOLEAN DEFAULT FALSE,

    -- Sheet identification
    sheet_label         VARCHAR(200),  -- e.g. "A-101", "1.0"
    sheet_title         VARCHAR(1000), -- e.g. "FLOOR PLAN - LEVEL 1"
    sheet_type          VARCHAR(100),  -- 'floor_plan', 'elevation', 'schedule', 'finish_schedule', 'detail', 'section', 'unknown'
    is_schedule_page    BOOLEAN DEFAULT FALSE,
    is_finish_schedule  BOOLEAN DEFAULT FALSE,
    is_cabinet_related  BOOLEAN DEFAULT FALSE,

    -- Cabinet keywords detected
    cabinet_keywords    TEXT[],
    -- ['cabinet', 'casework', 'millwork', 'countertop', 'vanities', etc.]

    -- OCR results (lazily populated)
    ocr_text            TEXT,
    ocr_confidence      NUMERIC(5,2),

    -- Bookmarks / TOC
    bookmark_path       VARCHAR(1000),

    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_project ON document_pages(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_dp_document ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_dp_sheet_type ON document_pages(sheet_type);
CREATE INDEX IF NOT EXISTS idx_dp_cabinet ON document_pages(is_cabinet_related);

-- ── preflight_results ──────────────────────────────────────────────────────────
-- Summary preflight analysis for the whole document package.

CREATE TABLE IF NOT EXISTS preflight_results (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    total_pages             INTEGER NOT NULL DEFAULT 0,
    total_documents         INTEGER NOT NULL DEFAULT 0,

    page_sizes              JSONB DEFAULT '[]'::jsonb,
    -- [{label, count, percentage}]

    schedule_pages_count    INTEGER DEFAULT 0,
    cabinet_keyword_pages   INTEGER DEFAULT 0,
    scanned_pages_count     INTEGER DEFAULT 0,
    needs_ocr_count         INTEGER DEFAULT 0,

    has_bookmarks           BOOLEAN DEFAULT FALSE,
    bookmark_count          INTEGER DEFAULT 0,

    detected_sheets         JSONB DEFAULT '[]'::jsonb,
    -- [{page_number, sheet_label, sheet_title, sheet_type}]

    cabinet_keywords_found  JSONB DEFAULT '{}'::jsonb,
    -- {keyword: [page_numbers]}

    file_sizes_bytes        BIGINT,

    warnings                JSONB DEFAULT '[]'::jsonb,
    -- [{type, message, severity}]

    is_ready_for_extraction BOOLEAN DEFAULT FALSE,
    extraction_notes        TEXT,

    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pf_project ON preflight_results(auto_bid_project_id);

-- ── sheets ─────────────────────────────────────────────────────────────────────
-- Detected drawing sheets from the document set.

CREATE TABLE IF NOT EXISTS sheets (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    document_id             UUID REFERENCES documents(id) ON DELETE SET NULL,
    page_id                 UUID REFERENCES document_pages(id) ON DELETE SET NULL,

    sheet_label             VARCHAR(200),
    sheet_title             VARCHAR(1000),
    sheet_type              VARCHAR(100),
    page_number             INTEGER,
    scale                   VARCHAR(100),
    north_arrow             BOOLEAN DEFAULT FALSE,
    has_dimensions          BOOLEAN DEFAULT FALSE,

    -- Detected objects / annotations
    detected_objects        JSONB DEFAULT '[]'::jsonb,
    -- [{type, label, quantity, location_hint, confidence}]

    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheets_project ON sheets(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_sheets_type ON sheets(sheet_type);

-- ── extracted_evidence ─────────────────────────────────────────────────────────
-- Every extracted fact with provenance. The foundation of trust.

CREATE TABLE IF NOT EXISTS extracted_evidence (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    document_id             UUID REFERENCES documents(id) ON DELETE SET NULL,
    page_id                 UUID REFERENCES document_pages(id) ON DELETE SET NULL,

    evidence_type           VARCHAR(100) NOT NULL,
    -- 'cabinet_mention', 'room_label', 'dimension', 'finish_code', 'hardware_note',
    -- 'countertop_spec', 'unit_type', 'schedule_entry', etc.

    raw_text                TEXT,
    normalized_text         TEXT,
    confidence              NUMERIC(5,2) DEFAULT 1.0,

    -- Provenance
    page_number             INTEGER,
    bounding_box            JSONB,
    -- {x0, y0, x1, y1} in PDF coordinates

    source_method           VARCHAR(50) DEFAULT 'text_extraction',
    -- 'text_extraction', 'ocr', 'ai_inference', 'manual'

    metadata                JSONB DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ee_project ON extracted_evidence(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_ee_type ON extracted_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_ee_document ON extracted_evidence(document_id);

-- ── detected_schedules ─────────────────────────────────────────────────────────
-- Schedules detected in the document set (finish, door, hardware, cabinet, etc.)

CREATE TABLE IF NOT EXISTS detected_schedules (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    page_id                 UUID REFERENCES document_pages(id) ON DELETE SET NULL,

    schedule_type           VARCHAR(100) NOT NULL,
    -- 'finish_schedule', 'door_schedule', 'hardware_schedule', 'cabinet_schedule', 'room_schedule'

    page_number             INTEGER,
    raw_text                TEXT,
    parsed_entries          JSONB DEFAULT '[]'::jsonb,
    -- [{row_data, columns}]

    row_count               INTEGER,
    confidence              NUMERIC(5,2),

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_project ON detected_schedules(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_ds_type ON detected_schedules(schedule_type);

-- ── plan_intelligence_objects ──────────────────────────────────────────────────
-- Higher-level intelligence extracted from plans (rooms, unit types, counts).

CREATE TABLE IF NOT EXISTS plan_intelligence_objects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    object_type             VARCHAR(100) NOT NULL,
    -- 'unit_type', 'room', 'floor_level', 'building', 'cabinet_zone'

    label                   VARCHAR(500),
    quantity                INTEGER,
    floor_level             VARCHAR(50),
    building_label          VARCHAR(200),

    -- The design intent from the architect (NOT the Vulpine solution)
    design_intent           TEXT,
    -- What the plans call for, as-written

    evidence_ids            UUID[],
    -- Links to extracted_evidence records that support this object

    metadata                JSONB DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pio_project ON plan_intelligence_objects(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_pio_type ON plan_intelligence_objects(object_type);

-- ── cabinet_requirements ───────────────────────────────────────────────────────
-- Structured cabinet requirement records with full provenance.

CREATE TABLE IF NOT EXISTS cabinet_requirements (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    room_label              VARCHAR(500),
    unit_type               VARCHAR(200),
    floor_level             VARCHAR(50),
    building_label          VARCHAR(200),

    cabinet_type            VARCHAR(200),
    -- 'base', 'wall', 'tall', 'vanity', 'closet', 'island', 'pantry', etc.

    design_intent           TEXT,
    -- What the plans specify (e.g. "3-base cabinet at kitchen")

    quantity                INTEGER,
    width                   NUMERIC(10,2),
    height                  NUMERIC(10,2),
    depth                   NUMERIC(10,2),
    finish                  VARCHAR(500),
    hardware                VARCHAR(500),
    countertop_spec         VARCHAR(500),
    special_notes           TEXT,

    -- Provenance
    evidence_ids            UUID[],
    page_numbers            INTEGER[],
    source_method           VARCHAR(50) DEFAULT 'extraction',

    -- Vulpine solution (separate from design intent)
    proposed_sku            VARCHAR(200),
    proposed_quantity       INTEGER,

    status                  VARCHAR(50) DEFAULT 'EXTRACTED',
    -- EXTRACTED, MAPPED, EXCEPTION, APPROVED

    metadata                JSONB DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cr_project ON cabinet_requirements(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_cr_unit_type ON cabinet_requirements(unit_type);
CREATE INDEX IF NOT EXISTS idx_cr_status ON cabinet_requirements(status);

-- ── bom_versions ───────────────────────────────────────────────────────────────
-- Versioned Bill of Materials. Immutable once generated.

CREATE TABLE IF NOT EXISTS bom_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    version_number          INTEGER NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, SUBMITTED, APPROVED, SUPERSEDED

    total_lines             INTEGER DEFAULT 0,
    total_cabinets          INTEGER DEFAULT 0,
    total_linear_feet       NUMERIC(12,2),

    -- Provenance
    generated_by            VARCHAR(50) DEFAULT 'engine',
    -- 'engine', 'manual', 'ai_assisted'

    evidence_count          INTEGER DEFAULT 0,
    confidence_score        NUMERIC(5,2),

    notes                   TEXT,
    approved_by             VARCHAR(200),
    approved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bv_project ON bom_versions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_bv_status ON bom_versions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bv_version ON bom_versions(auto_bid_project_id, version_number);

-- ── bom_lines ──────────────────────────────────────────────────────────────────
-- Individual lines within a BOM version. Each with provenance.

CREATE TABLE IF NOT EXISTS bom_lines (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bom_version_id          UUID REFERENCES bom_versions(id) ON DELETE CASCADE,
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    line_number             INTEGER NOT NULL,

    -- Design intent (from plans)
    design_intent           TEXT,
    room_label              VARCHAR(500),
    unit_type               VARCHAR(200),
    floor_level             VARCHAR(50),

    cabinet_type            VARCHAR(200),
    quantity                INTEGER NOT NULL DEFAULT 0,
    width                   NUMERIC(10,2),
    height                  NUMERIC(10,2),
    depth                   NUMERIC(10,2),
    finish                  VARCHAR(500),
    hardware                VARCHAR(500),
    countertop_spec         VARCHAR(500),

    -- Provenance
    cabinet_requirement_id  UUID REFERENCES cabinet_requirements(id) ON DELETE SET NULL,
    evidence_ids            UUID[],
    page_numbers            INTEGER[],

    -- SKU mapping (filled in SKU mapping stage)
    mapped_sku_id           UUID,
    sku_confidence          NUMERIC(5,2),
    is_exception            BOOLEAN DEFAULT FALSE,
    exception_id            UUID,

    notes                   TEXT,
    metadata                JSONB DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bl_bom ON bom_lines(bom_version_id);
CREATE INDEX IF NOT EXISTS idx_bl_project ON bom_lines(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_bl_exception ON bom_lines(is_exception);

-- ── sku_catalog ────────────────────────────────────────────────────────────────
-- Master SKU catalog. Real supplier SKUs only — never invented.

CREATE TABLE IF NOT EXISTS sku_catalog (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    sku_code                VARCHAR(200) NOT NULL UNIQUE,
    manufacturer            VARCHAR(500),
    product_line            VARCHAR(500),
    series                  VARCHAR(500),
    model                   VARCHAR(500),

    cabinet_type            VARCHAR(200),
    width                   NUMERIC(10,2),
    height                  NUMERIC(10,2),
    depth                   NUMERIC(10,2),
    finish                  VARCHAR(500),
    hardware_included       BOOLEAN DEFAULT FALSE,

    -- Cost data (from supplier — may be empty until loaded)
    unit_cost               NUMERIC(12,2),
    cost_currency           VARCHAR(10) DEFAULT 'USD',
    cost_updated_at         TIMESTAMPTZ,
    lead_time_days          INTEGER,
    freight_class           VARCHAR(50),

    -- Status
    is_active               BOOLEAN DEFAULT TRUE,
    discontinued            BOOLEAN DEFAULT FALSE,

    -- Spec sheet
    spec_sheet_url          VARCHAR(2000),
    image_url               VARCHAR(2000),

    notes                   TEXT,
    metadata                JSONB DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_code ON sku_catalog(sku_code);
CREATE INDEX IF NOT EXISTS idx_sku_type ON sku_catalog(cabinet_type);
CREATE INDEX IF NOT EXISTS idx_sku_manufacturer ON sku_catalog(manufacturer);

-- ── sku_aliases ────────────────────────────────────────────────────────────────
-- Known aliases / synonyms for SKUs. Helps mapping.

CREATE TABLE IF NOT EXISTS sku_aliases (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id                  UUID REFERENCES sku_catalog(id) ON DELETE CASCADE,

    alias                   VARCHAR(500) NOT NULL,
    alias_type              VARCHAR(50),
    -- 'manufacturer_code', 'legacy_code', 'supplier_code', 'nickname'

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_sku ON sku_aliases(sku_id);
CREATE INDEX IF NOT EXISTS idx_sa_alias ON sku_aliases(alias);

-- ── sku_mappings ───────────────────────────────────────────────────────────────
-- Mapping of BOM lines to SKUs (current state).

CREATE TABLE IF NOT EXISTS sku_mappings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    bom_line_id             UUID REFERENCES bom_lines(id) ON DELETE CASCADE,
    sku_id                  UUID REFERENCES sku_catalog(id) ON DELETE SET NULL,

    match_confidence        NUMERIC(5,2),
    match_method            VARCHAR(50),
    -- 'exact_code', 'alias_match', 'dimension_match', 'ai_recommendation', 'manual'

    is_ai_recommendation    BOOLEAN DEFAULT FALSE,
    is_human_approved       BOOLEAN DEFAULT FALSE,
    approved_by             VARCHAR(200),
    approved_at             TIMESTAMPTZ,

    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sm_project ON sku_mappings(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_sm_bom_line ON sku_mappings(bom_line_id);

-- ── sku_mapping_history ────────────────────────────────────────────────────────
-- Audit trail of SKU mapping changes.

CREATE TABLE IF NOT EXISTS sku_mapping_history (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_mapping_id          UUID REFERENCES sku_mappings(id) ON DELETE CASCADE,
    bom_line_id             UUID REFERENCES bom_lines(id) ON DELETE CASCADE,

    old_sku_id              UUID,
    new_sku_id              UUID,
    old_confidence          NUMERIC(5,2),
    new_confidence          NUMERIC(5,2),

    change_reason           TEXT,
    actor                   VARCHAR(200),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smh_mapping ON sku_mapping_history(sku_mapping_id);

-- ── exceptions ─────────────────────────────────────────────────────────────────
-- Exceptions flagged during SKU mapping or other stages.

CREATE TABLE IF NOT EXISTS exceptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    bom_line_id             UUID REFERENCES bom_lines(id) ON DELETE SET NULL,

    exception_type          VARCHAR(100) NOT NULL,
    -- 'no_sku_match', 'ambiguous_match', 'dimension_mismatch', 'finish_unavailable',
    -- 'quantity_discrepancy', 'missing_spec', 'custom_requirement'

    severity                VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    -- 'BLOCKER', 'WARNING', 'INFO'

    title                   VARCHAR(500) NOT NULL,
    description             TEXT,

    -- The design intent that couldn't be mapped
    design_intent           TEXT,
    cabinet_type            VARCHAR(200),
    required_dimensions     JSONB,
    required_finish         VARCHAR(500),

    -- Possible resolutions
    suggested_skus          UUID[],
    suggested_actions       JSONB DEFAULT '[]'::jsonb,

    status                  VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    -- OPEN, IN_REVIEW, RESOLVED, DEFERRED, ESCALATED

    resolution              TEXT,
    resolution_type         VARCHAR(100),
    -- 'sku_substituted', 'custom_quote', 'value_engineered', 'deferred', 'rejected'

    resolved_by             VARCHAR(200),
    resolved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exc_project ON exceptions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_exc_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exc_severity ON exceptions(severity);

-- ── review_decisions ───────────────────────────────────────────────────────────
-- Human review decisions across the pipeline.

CREATE TABLE IF NOT EXISTS review_decisions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    stage                   VARCHAR(50) NOT NULL,
    -- 'preflight', 'extract', 'bom', 'sku_map', 'exceptions', 'pricing', 'qa', 'proposal'

    entity_type             VARCHAR(100) NOT NULL,
    entity_id               UUID,

    decision                VARCHAR(50) NOT NULL,
    -- 'approved', 'rejected', 'modified', 'deferred', 'escalated'

    old_value               JSONB,
    new_value               JSONB,
    reason                  TEXT,

    reviewer                VARCHAR(200) NOT NULL,
    reviewed_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rd_project ON review_decisions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_rd_stage ON review_decisions(stage);

-- ── value_engineering_decisions ────────────────────────────────────────────────
-- Mike's review workspace. Persistent VE decisions with before/after history.

CREATE TABLE IF NOT EXISTS value_engineering_decisions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    bom_line_id             UUID REFERENCES bom_lines(id) ON DELETE CASCADE,
    cabinet_requirement_id  UUID REFERENCES cabinet_requirements(id) ON DELETE SET NULL,

    title                   VARCHAR(500) NOT NULL,
    description             TEXT NOT NULL,

    ve_type                 VARCHAR(100),
    -- 'substitution', 'quantity_reduction', 'finish_change', 'hardware_change',
    -- 'design_simplification', 'alternative_product'

    -- Before (original design intent)
    before_description      TEXT,
    before_sku_id           UUID,
    before_quantity         INTEGER,
    before_cost             NUMERIC(12,2),

    -- After (Vulpine proposed solution)
    after_description       TEXT,
    after_sku_id            UUID,
    after_quantity          INTEGER,
    after_cost              NUMERIC(12,2),

    cost_savings            NUMERIC(12,2),
    rationale               TEXT,

    status                  VARCHAR(50) NOT NULL DEFAULT 'PROPOSED',
    -- PROPOSED, APPROVED, REJECTED, DEFERRED

    decided_by              VARCHAR(200),
    decided_at              TIMESTAMPTZ,
    decision_notes          TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ve_project ON value_engineering_decisions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_ve_status ON value_engineering_decisions(status);

-- ── pricing_versions ───────────────────────────────────────────────────────────
-- Versioned pricing calculations. Deterministic — code-driven, NOT LLM.

CREATE TABLE IF NOT EXISTS pricing_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    bom_version_id          UUID REFERENCES bom_versions(id) ON DELETE SET NULL,

    version_number          INTEGER NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED

    -- Cost components (aggregated from pricing_lines)
    total_product_cost      NUMERIC(16,2) DEFAULT 0,
    total_freight           NUMERIC(16,2) DEFAULT 0,
    total_duties_tariffs    NUMERIC(16,2) DEFAULT 0,
    total_tax               NUMERIC(16,2) DEFAULT 0,
    total_storage           NUMERIC(16,2) DEFAULT 0,
    total_delivery          NUMERIC(16,2) DEFAULT 0,
    total_installation      NUMERIC(16,2) DEFAULT 0,
    total_contingency       NUMERIC(16,2) DEFAULT 0,
    total_other_costs       NUMERIC(16,2) DEFAULT 0,

    landed_cost             NUMERIC(16,2) DEFAULT 0,

    -- Pricing
    desired_margin_percent  NUMERIC(6,2) DEFAULT 18.0,
    suggested_sell_price    NUMERIC(16,2) DEFAULT 0,
    gross_profit            NUMERIC(16,2) DEFAULT 0,
    gross_margin_percent    NUMERIC(6,2) DEFAULT 0,

    -- Commission
    rep_commission_percent  NUMERIC(6,2) DEFAULT 0,
    rep_commission_amount   NUMERIC(16,2) DEFAULT 0,
    vulpine_retained_profit NUMERIC(16,2) DEFAULT 0,

    -- Risk
    risk_flags              TEXT[],
    is_blocked              BOOLEAN DEFAULT FALSE,
    block_reasons           TEXT[],

    -- Guardrail validation
    meets_margin_floor      BOOLEAN DEFAULT FALSE,
    meets_commission_floor  BOOLEAN DEFAULT FALSE,

    notes                   TEXT,
    approved_by             VARCHAR(200),
    approved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_project ON pricing_versions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_pv_status ON pricing_versions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pv_version ON pricing_versions(auto_bid_project_id, version_number);

-- ── pricing_lines ──────────────────────────────────────────────────────────────
-- Per-line pricing breakdown. Each BOM line has a pricing line.

CREATE TABLE IF NOT EXISTS pricing_lines (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_version_id      UUID REFERENCES pricing_versions(id) ON DELETE CASCADE,
    bom_line_id             UUID REFERENCES bom_lines(id) ON DELETE CASCADE,
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    line_number             INTEGER NOT NULL,

    sku_id                  UUID REFERENCES sku_catalog(id) ON DELETE SET NULL,
    sku_code                VARCHAR(200),
    cabinet_type            VARCHAR(200),
    quantity                INTEGER NOT NULL DEFAULT 0,

    unit_cost               NUMERIC(12,2) DEFAULT 0,
    extended_product_cost   NUMERIC(16,2) DEFAULT 0,

    freight                 NUMERIC(16,2) DEFAULT 0,
    duties_tariffs          NUMERIC(16,2) DEFAULT 0,
    tax                     NUMERIC(16,2) DEFAULT 0,
    storage                 NUMERIC(16,2) DEFAULT 0,
    delivery                NUMERIC(16,2) DEFAULT 0,
    installation            NUMERIC(16,2) DEFAULT 0,
    contingency             NUMERIC(16,2) DEFAULT 0,
    other_costs             NUMERIC(16,2) DEFAULT 0,

    line_landed_cost        NUMERIC(16,2) DEFAULT 0,
    line_sell_price         NUMERIC(16,2) DEFAULT 0,
    line_gross_profit       NUMERIC(16,2) DEFAULT 0,

    -- Per-line risk
    has_cost                BOOLEAN DEFAULT FALSE,
    is_blocked              BOOLEAN DEFAULT FALSE,
    block_reason            TEXT,

    notes                   TEXT,
    metadata                JSONB DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_version ON pricing_lines(pricing_version_id);
CREATE INDEX IF NOT EXISTS idx_pl_project ON pricing_lines(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_pl_blocked ON pricing_lines(is_blocked);

-- ── qa_runs ────────────────────────────────────────────────────────────────────
-- QA run records. Rule-based checks.

CREATE TABLE IF NOT EXISTS qa_runs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    pricing_version_id      UUID REFERENCES pricing_versions(id) ON DELETE SET NULL,
    bom_version_id          UUID REFERENCES bom_versions(id) ON DELETE SET NULL,

    run_number              INTEGER NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'PASSED',
    -- PASSED, PASSED_WITH_WARNINGS, BLOCKED

    total_checks            INTEGER DEFAULT 0,
    blockers_count          INTEGER DEFAULT 0,
    warnings_count          INTEGER DEFAULT 0,
    info_count              INTEGER DEFAULT 0,

    is_proposal_blocked     BOOLEAN DEFAULT FALSE,

    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_project ON qa_runs(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_qa_status ON qa_runs(status);

-- ── qa_findings ────────────────────────────────────────────────────────────────
-- Individual QA findings.

CREATE TABLE IF NOT EXISTS qa_findings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qa_run_id               UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    check_name              VARCHAR(200) NOT NULL,
    severity                VARCHAR(20) NOT NULL,
    -- 'BLOCKER', 'WARNING', 'INFO'

    message                 TEXT NOT NULL,
    entity_type             VARCHAR(100),
    entity_id               UUID,

    expected_value          JSONB,
    actual_value            JSONB,

    is_resolved             BOOLEAN DEFAULT FALSE,
    resolution              TEXT,
    resolved_by             VARCHAR(200),
    resolved_at             TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qaf_run ON qa_findings(qa_run_id);
CREATE INDEX IF NOT EXISTS idx_qaf_severity ON qa_findings(severity);
CREATE INDEX IF NOT EXISTS idx_qaf_project ON qa_findings(auto_bid_project_id);

-- ── proposal_versions ──────────────────────────────────────────────────────────
-- Generated proposal documents. Tied to approved BOM + pricing.

CREATE TABLE IF NOT EXISTS proposal_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,
    pricing_version_id      UUID REFERENCES pricing_versions(id) ON DELETE SET NULL,
    bom_version_id          UUID REFERENCES bom_versions(id) ON DELETE SET NULL,
    qa_run_id               UUID REFERENCES qa_runs(id) ON DELETE SET NULL,

    version_number          INTEGER NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, PENDING_REVIEW, APPROVED, SENT, REJECTED

    -- Proposal content
    title                   VARCHAR(1000),
    proposal_number         VARCHAR(100),
    proposal_date           DATE,
    valid_until             DATE,

    -- Summary
    executive_summary       TEXT,
    scope_summary           TEXT,
    total_price             NUMERIC(16,2),
    total_cabinets          INTEGER,
    estimated_lead_time     VARCHAR(200),
    warranty_terms          TEXT,
    payment_terms           TEXT,

    -- File references
    pdf_file_path           VARCHAR(2000),
    html_file_path          VARCHAR(2000),

    -- Metadata
    template_name           VARCHAR(200) DEFAULT 'default',
    metadata                JSONB DEFAULT '{}'::jsonb,

    approved_by             VARCHAR(200),
    approved_at             TIMESTAMPTZ,
    sent_at                 TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_project ON proposal_versions(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_pp_status ON proposal_versions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_version ON proposal_versions(auto_bid_project_id, version_number);

-- ── audit_events ───────────────────────────────────────────────────────────────
-- Comprehensive audit trail for every action.

CREATE TABLE IF NOT EXISTS audit_events (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auto_bid_project_id     UUID REFERENCES auto_bid_projects(id) ON DELETE CASCADE,

    actor                   VARCHAR(200) NOT NULL,
    -- 'system', 'daniel', 'mike', 'ai_router', etc.

    action                  VARCHAR(100) NOT NULL,
    -- 'create', 'update', 'delete', 'stage_transition', 'approve', 'reject',
    -- 'upload', 'generate', 'map_sku', 'resolve_exception', etc.

    entity_type             VARCHAR(100) NOT NULL,
    entity_id               UUID,

    old_values              JSONB,
    new_values              JSONB,

    reason                  TEXT,
    metadata                JSONB DEFAULT '{}'::jsonb,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ae_project ON audit_events(auto_bid_project_id);
CREATE INDEX IF NOT EXISTS idx_ae_actor ON audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_ae_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_ae_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ae_created ON audit_events(created_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Updated trigger for updated_at on key tables
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'auto_bid_projects',
            'cabinet_requirements',
            'bom_lines',
            'sku_mappings',
            'exceptions',
            'value_engineering_decisions',
            'pricing_versions',
            'proposal_versions',
            'sku_catalog'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated ON %s;'
            'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            t, t, t, t
        );
    END LOOP;
END $$;