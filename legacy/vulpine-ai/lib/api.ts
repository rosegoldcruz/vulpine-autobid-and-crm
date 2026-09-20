/**
 * API client for Vulpine Auto Bidder backend.
 * All calls go to /api/v1/auto-bid/* (proxied through nginx to port 8000).
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE || "/api/v1/auto-bid";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const isAbsolute = url.startsWith("http");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
    },
    ...(isAbsolute ? {} : { next: { revalidate: 0 } }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StageProgress {
  current_stage: string;
  current_index: number;
  total_stages: number;
  completed_stages: number;
  progress_percent: number;
  remaining_stages: string[];
  all_stages: string[];
}

export interface Project {
  id: string;
  name: string;
  status: string;
  current_stage: string;
  stage_progress: StageProgress;
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
  error_message: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  stage_history: any[];
  counts?: Record<string, number>;
}

export interface ProjectListResponse {
  projects: Project[];
  count: number;
}

export interface StatsResponse {
  total_projects: number;
  by_status: Record<string, number>;
  by_stage: Record<string, number>;
  total_skus: number;
  open_exceptions: number;
}

export interface PreflightResult {
  id: string;
  total_pages: number;
  total_documents: number;
  page_sizes: any[];
  schedule_pages_count: number;
  cabinet_keyword_pages: number;
  scanned_pages_count: number;
  needs_ocr_count: number;
  has_bookmarks: boolean;
  bookmark_count: number;
  detected_sheets: any[];
  cabinet_keywords_found: any[];
  warnings: any[];
  is_ready_for_extraction: boolean;
  extraction_notes: string | null;
  completed_at: string | null;
}

export interface DocumentPage {
  id: string;
  page_number: number;
  page_size_label: string | null;
  width_inches: number | null;
  height_inches: number | null;
  has_text: boolean;
  text_char_count: number;
  text_preview: string | null;
  has_vector_graphics: boolean;
  has_images: boolean;
  is_likely_scanned: boolean;
  needs_ocr: boolean;
  sheet_label: string | null;
  sheet_title: string | null;
  sheet_type: string | null;
  is_schedule_page: boolean;
  is_cabinet_related: boolean;
  cabinet_keywords: string[] | null;
  bookmark_path: string | null;
}

export interface PreflightResponse {
  preflight: PreflightResult | null;
  pages?: DocumentPage[];
  message?: string;
}

export interface Evidence {
  id: string;
  evidence_type: string;
  raw_text: string;
  normalized_text: string;
  confidence: number | null;
  page_number: number;
  source_method: string;
  meta: any;
}

export interface EvidenceResponse {
  evidence: Evidence[];
  count: number;
}

export interface CabinetRequirement {
  id: string;
  room_label: string | null;
  unit_type: string | null;
  floor_level: string | null;
  cabinet_type: string | null;
  design_intent: string | null;
  quantity: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  finish: string | null;
  hardware: string | null;
  countertop_spec: string | null;
  evidence_ids: string[];
  page_numbers: any;
  status: string;
}

export interface CabinetRequirementsResponse {
  requirements: CabinetRequirement[];
  count: number;
}

export interface BOMLine {
  id: string;
  line_number: number;
  design_intent: string | null;
  room_label: string | null;
  unit_type: string | null;
  cabinet_type: string | null;
  quantity: number;
  width: number | null;
  height: number | null;
  depth: number | null;
  finish: string | null;
  hardware: string | null;
  countertop_spec: string | null;
  mapped_sku_id: string | null;
  sku_confidence: number | null;
  is_exception: boolean;
  exception_id: string | null;
  page_numbers: any;
}

export interface BOMVersion {
  id: string;
  version_number: number;
  status: string;
  total_lines: number;
  total_cabinets: number;
  generated_by: string;
  evidence_count: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface BOMResponse {
  bom: BOMVersion | null;
  lines: BOMLine[];
  message?: string;
}

export interface SKU {
  id: string;
  sku_code: string;
  manufacturer: string | null;
  product_line: string | null;
  model: string | null;
  cabinet_type: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  finish: string | null;
  unit_cost: number | null;
  lead_time_days: number | null;
  is_active: boolean;
}

export interface SKUCatalogResponse {
  skus: SKU[];
  count: number;
}

export interface ExceptionItem {
  id: string;
  exception_type: string;
  severity: string;
  title: string;
  description: string;
  design_intent: string | null;
  cabinet_type: string | null;
  required_dimensions: any;
  required_finish: string | null;
  status: string;
  resolution: string | null;
  resolution_type: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  bom_line_id: string | null;
  created_at: string;
}

export interface ExceptionsResponse {
  exceptions: ExceptionItem[];
  count: number;
}

export interface PricingLine {
  id: string;
  line_number: number;
  sku_code: string | null;
  cabinet_type: string | null;
  quantity: number;
  unit_cost: number | null;
  extended_product_cost: number;
  line_landed_cost: number;
  has_cost: boolean;
  is_blocked: boolean;
  block_reason: string | null;
}

export interface PricingVersion {
  id: string;
  version_number: number;
  status: string;
  total_product_cost: number;
  total_freight: number;
  total_duties_tariffs: number;
  total_tax: number;
  total_storage: number;
  total_delivery: number;
  total_installation: number;
  total_contingency: number;
  total_other_costs: number;
  landed_cost: number;
  desired_margin_percent: number;
  suggested_sell_price: number;
  gross_profit: number;
  gross_margin_percent: number;
  rep_commission_percent: number | null;
  rep_commission_amount: number | null;
  vulpine_retained_profit: number | null;
  is_blocked: boolean;
  block_reasons: string[];
  risk_flags: string[];
  meets_margin_floor: boolean;
  meets_commission_floor: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

export interface PricingResponse {
  pricing: PricingVersion | null;
  lines: PricingLine[];
  message?: string;
}

export interface QAFinding {
  id: string;
  check_name: string;
  severity: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_resolved: boolean;
  resolution?: string | null;
}

export interface QARun {
  id: string;
  run_number: number;
  status: string;
  total_checks: number;
  blockers_count: number;
  warnings_count: number;
  info_count: number;
  is_proposal_blocked: boolean;
  created_at?: string;
}

export interface QAResponse {
  qa_run: QARun | null;
  findings: QAFinding[];
  message?: string;
}

export interface ProposalVersion {
  id: string;
  version_number: number;
  proposal_number: string;
  title: string;
  proposal_date: string | null;
  valid_until: string | null;
  executive_summary?: string;
  scope_summary?: string;
  total_price: number | null;
  total_cabinets: number;
  estimated_lead_time?: string;
  warranty_terms?: string;
  payment_terms?: string;
  status: string;
  html_file_path?: string;
  pdf_file_path?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
}

export interface ProposalResponse {
  proposal: ProposalVersion | null;
  message?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  reason: string | null;
  created_at: string;
}

export interface AuditResponse {
  events: AuditEvent[];
  count: number;
}

// ── API Functions ──────────────────────────────────────────────────────────────

export const api = {
  // Stats
  getStats: () => apiFetch<StatsResponse>("/stats"),

  // Projects
  listProjects: (status?: string) =>
    apiFetch<ProjectListResponse>(`/projects${status ? `?status=${status}` : ""}`),
  getProject: (id: string) => apiFetch<Project>(`/projects/${id}`),
  createProject: (data: { name: string; assigned_to?: string; due_date?: string; notes?: string }) =>
    apiFetch<Project>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  advanceProject: (id: string, actor?: string) =>
    apiFetch<Project>(`/projects/${id}/advance?actor=${actor || "system"}`, { method: "POST" }),
  transitionProject: (id: string, targetStatus: string, actor?: string) =>
    apiFetch<Project>(`/projects/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_status: targetStatus, actor: actor || "system" }),
    }),

  // Documents
  uploadDocuments: (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    return apiFetch<{ uploaded: any[]; count: number }>(`/projects/${id}/documents/upload`, {
      method: "POST",
      body: formData,
    });
  },

  // Preflight
  runPreflight: (id: string) =>
    apiFetch<{ status: string; preflight: PreflightResult | null }>(`/projects/${id}/preflight`, { method: "POST" }),
  getPreflight: (id: string) => apiFetch<PreflightResponse>(`/projects/${id}/preflight`),

  // Extraction
  runExtraction: (id: string) =>
    apiFetch<{ status: string; evidence_count: number; cabinet_requirements_count: number }>(`/projects/${id}/extract`, { method: "POST" }),
  getEvidence: (id: string) => apiFetch<EvidenceResponse>(`/projects/${id}/evidence`),
  getCabinetRequirements: (id: string) => apiFetch<CabinetRequirementsResponse>(`/projects/${id}/cabinet-requirements`),

  // BOM
  generateBOM: (id: string) =>
    apiFetch<{ status: string; bom: BOMVersion | null }>(`/projects/${id}/bom/generate`, { method: "POST" }),
  getBOM: (id: string) => apiFetch<BOMResponse>(`/projects/${id}/bom`),
  approveBOM: (projectId: string, bomId: string) =>
    apiFetch<{ status: string; bom_id: string; version: number }>(`/projects/${projectId}/bom/${bomId}/approve`, { method: "POST" }),

  // SKU Catalog
  listSKUs: (query?: string) =>
    apiFetch<SKUCatalogResponse>(`/sku-catalog${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  createSKU: (data: any) =>
    apiFetch<{ id: string; sku_code: string; status: string }>("/sku-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // SKU Mapping
  runSKUMapping: (projectId: string, bomVersionId: string) =>
    apiFetch<{ status: string; mapped_count: number; exception_count: number }>(`/projects/${projectId}/sku-mapping/run?bom_version_id=${bomVersionId}`, { method: "POST" }),
  manualMapSKU: (projectId: string, bomLineId: string, skuId: string, actor?: string) =>
    apiFetch<{ status: string; mapping_id: string }>(`/projects/${projectId}/bom-lines/${bomLineId}/map-sku`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku_id: skuId, actor: actor || "mike" }),
    }),

  // Exceptions
  getExceptions: (id: string) => apiFetch<ExceptionsResponse>(`/projects/${id}/exceptions`),
  resolveException: (projectId: string, exceptionId: string, resolution: string, resolutionType?: string, newSkuId?: string) =>
    apiFetch<{ status: string; exception_id: string }>(`/projects/${projectId}/exceptions/${exceptionId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolution,
        resolution_type: resolutionType || "sku_substituted",
        resolved_by: "mike",
        new_sku_id: newSkuId,
      }),
    }),

  // Pricing
  generatePricing: (projectId: string, bomVersionId: string) =>
    apiFetch<{ status: string; pricing: PricingVersion }>(`/projects/${projectId}/pricing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bom_version_id: bomVersionId }),
    }),
  getPricing: (id: string) => apiFetch<PricingResponse>(`/projects/${id}/pricing`),
  approvePricing: (projectId: string, pricingId: string) =>
    apiFetch<{ status: string; pricing_id: string }>(`/projects/${projectId}/pricing/${pricingId}/approve`, { method: "POST" }),

  // QA
  runQA: (projectId: string) =>
    apiFetch<{ qa_run: QARun; findings: QAFinding[] }>(`/projects/${projectId}/qa/run`, { method: "POST" }),
  getQA: (id: string) => apiFetch<QAResponse>(`/projects/${id}/qa`),

  // Proposal
  generateProposal: (projectId: string, pricingVersionId: string, bomVersionId: string) =>
    apiFetch<{ status: string; proposal: ProposalVersion }>(`/projects/${projectId}/proposal/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricing_version_id: pricingVersionId, bom_version_id: bomVersionId }),
    }),
  getProposal: (id: string) => apiFetch<ProposalResponse>(`/projects/${id}/proposal`),

  // Audit
  getAuditTrail: (id: string) => apiFetch<AuditResponse>(`/projects/${id}/audit-trail`),
};