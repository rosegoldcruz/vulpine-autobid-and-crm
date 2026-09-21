-- Vulpine Engine Database Schema
-- PostgreSQL with pgvector for AI embeddings

-- ── Extensions ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ── Companies ──────────────────────────────────────────────

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ghl_id VARCHAR(100),
    name VARCHAR(500) NOT NULL,
    company_type VARCHAR(100),
    website VARCHAR(500),
    phone VARCHAR(50),
    address_line1 VARCHAR(500),
    city VARCHAR(200),
    state VARCHAR(100),
    zip VARCHAR(20),
    country VARCHAR(100) DEFAULT 'US',
    employee_count INTEGER,
    annual_revenue NUMERIC(16,2),
    sic_code VARCHAR(50),
    naics_code VARCHAR(50),
    zoominfo_id VARCHAR(100),
    duns_number VARCHAR(50),
    geographic_markets TEXT,
    supplier_indicators TEXT,
    notes TEXT,
    cabinet_opportunity_score INTEGER DEFAULT 0,
    cabinet_score_tier VARCHAR(50),
    estimated_annual_cabinet_volume NUMERIC(16,2),
    is_house_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_ghl ON companies(ghl_id);
CREATE INDEX idx_companies_type ON companies(company_type);
CREATE INDEX idx_companies_score ON companies(cabinet_opportunity_score);

-- ── Contacts ───────────────────────────────────────────────

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ghl_id VARCHAR(100),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email VARCHAR(500) UNIQUE,
    phone VARCHAR(50),
    first_name VARCHAR(200),
    last_name VARCHAR(200),
    title VARCHAR(500),
    department VARCHAR(200),
    linkedin_url VARCHAR(1000),
    role_category VARCHAR(100),
    buyer_influence VARCHAR(100),
    is_decision_maker BOOLEAN DEFAULT FALSE,
    lead_source VARCHAR(100),
    cabinet_opportunity_score INTEGER DEFAULT 0,
    cabinet_score_tier VARCHAR(50),
    outreach_sequence VARCHAR(100),
    reply_intent VARCHAR(100),
    last_outreach_date DATE,
    last_reply_date DATE,
    is_unsubscribed BOOLEAN DEFAULT FALSE,
    is_bounced BOOLEAN DEFAULT FALSE,
    notes TEXT,
    raw_data JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_ghl ON contacts(ghl_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_score ON contacts(cabinet_opportunity_score);
CREATE INDEX idx_contacts_role ON contacts(role_category);
CREATE INDEX idx_contacts_embedding ON contacts USING ivfflat (embedding vector_cosine_ops);

-- ── Projects ───────────────────────────────────────────────

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(200),
    source VARCHAR(100),               -- planhub, buildingconnected, manual
    source_url VARCHAR(2000),
    name VARCHAR(1000) NOT NULL,
    project_type VARCHAR(100),
    description TEXT,
    address_line1 VARCHAR(500),
    city VARCHAR(200),
    state VARCHAR(100),
    zip VARCHAR(20),
    project_value NUMERIC(16,2),
    unit_count INTEGER,
    building_count INTEGER,
    square_footage NUMERIC(16,2),
    bid_date TIMESTAMPTZ,
    bid_time VARCHAR(50),
    bid_location TEXT,
    submission_method VARCHAR(100),
    submission_portal_url VARCHAR(2000),
    plans_available BOOLEAN DEFAULT FALSE,
    plans_location TEXT,
    addenda_count INTEGER DEFAULT 0,
    addenda_acknowledged BOOLEAN DEFAULT FALSE,
    gc_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    owner_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    architect_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    cabinet_scope TEXT,
    scope_keywords TEXT[],
    estimated_package_size NUMERIC(16,2),
    raw_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_source ON projects(source);
CREATE INDEX idx_projects_bid_date ON projects(bid_date);
CREATE INDEX idx_projects_type ON projects(project_type);
CREATE INDEX idx_projects_active ON projects(is_active);

-- ── Opportunities ──────────────────────────────────────────

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ghl_id VARCHAR(100),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(1000) NOT NULL,
    pipeline_stage VARCHAR(100) DEFAULT 'New Lead',
    status VARCHAR(50) DEFAULT 'open',
    bid_status VARCHAR(100),
    monetary_value NUMERIC(16,2),
    cabinet_package_size NUMERIC(16,2),
    win_probability INTEGER,
    competitor_notes TEXT,
    bid_date TIMESTAMPTZ,
    bid_submitted_date TIMESTAMPTZ,
    award_date TIMESTAMPTZ,
    close_date TIMESTAMPTZ,
    lost_reason TEXT,
    notes TEXT,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opps_ghl ON opportunities(ghl_id);
CREATE INDEX idx_opps_stage ON opportunities(pipeline_stage);
CREATE INDEX idx_opps_project ON opportunities(project_id);
CREATE INDEX idx_opps_contact ON opportunities(contact_id);

-- ── Documents ──────────────────────────────────────────────

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    filename VARCHAR(1000) NOT NULL,
    file_path VARCHAR(2000) NOT NULL,
    file_type VARCHAR(100),            -- plan, spec, schedule, addenda, finish_schedule, etc.
    file_size_bytes BIGINT,
    page_count INTEGER,
    relevant_pages INTEGER[],
    extracted_text TEXT,
    cabinet_tags TEXT[],
    embedding vector(1536),
    is_processed BOOLEAN DEFAULT FALSE,
    processing_notes TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_project ON documents(project_id);
CREATE INDEX idx_docs_type ON documents(file_type);

-- ── Takeoffs ───────────────────────────────────────────────

CREATE TABLE takeoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, in_progress, complete, approved
    unit_types JSONB DEFAULT '[]',
    rooms JSONB DEFAULT '[]',
    cabinet_items JSONB DEFAULT '[]',
    total_cabinet_count INTEGER,
    total_linear_feet NUMERIC(12,2),
    finish_schedule JSONB DEFAULT '{}',
    hardware_schedule JSONB DEFAULT '{}',
    notes TEXT,
    created_by VARCHAR(200),
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Supplier RFQs ──────────────────────────────────────────

CREATE TABLE supplier_rfqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    takeoff_id UUID REFERENCES takeoffs(id) ON DELETE SET NULL,
    supplier_name VARCHAR(500),
    supplier_email VARCHAR(500),
    status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, acknowledged, questions, pricing_received, rejected
    rfq_data JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    response_received_at TIMESTAMPTZ,
    quoted_price NUMERIC(16,2),
    quoted_lead_time_days INTEGER,
    quoted_freight NUMERIC(16,2),
    exclusions TEXT,
    warranty_terms TEXT,
    validity_days INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pricing ────────────────────────────────────────────────

CREATE TABLE pricing_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, pending_approval, approved, rejected
    product_cost NUMERIC(16,2),
    freight NUMERIC(16,2),
    duties_tariffs NUMERIC(16,2),
    tax_estimate NUMERIC(16,2),
    storage NUMERIC(16,2),
    delivery NUMERIC(16,2),
    installation NUMERIC(16,2),
    contingency NUMERIC(16,2),
    payment_fees NUMERIC(16,2),
    financing_cost NUMERIC(16,2),
    warranty_reserve NUMERIC(16,2),
    other_costs NUMERIC(16,2),
    landed_cost NUMERIC(16,2),
    desired_margin_percent NUMERIC(6,2),
    suggested_sell_price NUMERIC(16,2),
    gross_profit NUMERIC(16,2),
    gross_margin_percent NUMERIC(6,2),
    rep_commission_percent NUMERIC(6,2),
    rep_commission_amount NUMERIC(16,2),
    vulpine_retained_profit NUMERIC(16,2),
    risk_flags TEXT[],
    notes TEXT,
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Commissions ────────────────────────────────────────────

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    rep_name VARCHAR(500),
    rep_email VARCHAR(500),
    deal_revenue NUMERIC(16,2),
    direct_costs NUMERIC(16,2),
    adjustments NUMERIC(16,2),
    commissionable_profit NUMERIC(16,2),
    commission_percent NUMERIC(6,2),
    commission_amount NUMERIC(16,2),
    vulpine_retained NUMERIC(16,2),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, paid, disputed
    payment_date DATE,
    payment_reference VARCHAR(500),
    tax_year INTEGER,
    form_1099_sent BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Outreach Log ───────────────────────────────────────────

CREATE TABLE outreach_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    channel VARCHAR(50),               -- email, voice, sms
    direction VARCHAR(20),             -- outbound, inbound
    sequence_type VARCHAR(100),
    step_number INTEGER,
    subject VARCHAR(1000),
    body_preview TEXT,
    status VARCHAR(50),                -- sent, delivered, opened, replied, bounced, failed
    external_id VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_contact ON outreach_log(contact_id);
CREATE INDEX idx_outreach_created ON outreach_log(created_at);

-- ── Engine Log ─────────────────────────────────────────────

CREATE TABLE engine_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(200),
    action VARCHAR(200),
    entity_type VARCHAR(100),
    entity_id VARCHAR(200),
    status VARCHAR(50),
    message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_log_agent ON engine_log(agent_name);
CREATE INDEX idx_log_created ON engine_log(created_at);

-- ── Views ──────────────────────────────────────────────────

-- Daily briefing view
CREATE VIEW daily_briefing AS
SELECT
    (SELECT COUNT(*) FROM contacts WHERE cabinet_score_tier IN ('BID_NOW', 'HIGH_PRIORITY') AND is_unsubscribed = FALSE) AS high_priority_contacts,
    (SELECT COUNT(*) FROM projects WHERE bid_date >= NOW() AND bid_date <= NOW() + INTERVAL '14 days' AND is_active = TRUE) AS bids_due_soon,
    (SELECT COUNT(*) FROM opportunities WHERE bid_status = 'Submitted' AND status = 'open') AS bids_awaiting_response,
    (SELECT COUNT(*) FROM opportunities WHERE bid_status IN ('Verbal Award', 'Contracted') AND status = 'open') AS verbal_awards,
    (SELECT COUNT(*) FROM supplier_rfqs WHERE status = 'sent') AS rfqs_awaiting_response,
    (SELECT COUNT(*) FROM outreach_log WHERE direction = 'inbound' AND created_at >= NOW() - INTERVAL '24 hours') AS replies_last_24h,
    (SELECT COALESCE(SUM(monetary_value), 0) FROM opportunities WHERE status = 'open' AND pipeline_stage NOT IN ('Lost', 'Dead', 'Archived')) AS total_pipeline_value,
    (SELECT COALESCE(SUM(estimated_package_size), 0) FROM projects WHERE is_active = TRUE AND bid_date >= NOW()) AS estimated_cabinet_pipeline_value;
