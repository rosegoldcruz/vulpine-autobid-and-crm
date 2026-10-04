import { hasCapability, type Capability } from "@vulpine/permissions"

// Product surfaces, not service-health claims. Existing workspaces retain their
// original components and proxies; planned surfaces never manufacture records.
export const platformModules = [
  { id: "dashboard", label: "Command Center", path: "/", group: "CORE", capability: "dashboard.read", existing: true, purpose: "Navigate your company workspace.", boundary: "Backoffice" },
  { id: "projects", label: "Projects", path: "/projects", group: "PROJECTS", capability: "dashboard.read", purpose: "A shared project identity across drawings, bids, documents, and delivery.", boundary: "Project service integration" },
  { id: "documents", label: "Documents", path: "/projects/documents", group: "PROJECTS", capability: "drive.read", purpose: "Project documents with source provenance and controlled access.", boundary: "Document service / Vulpine Drive" },
  { id: "activity", label: "Activity", path: "/projects/activity", group: "PROJECTS", capability: "dashboard.read", purpose: "A project timeline backed by real events and audit records.", boundary: "Canonical event contracts" },
  { id: "crm", label: "CRM", path: "/crm", group: "SALES", capability: "crm.read", purpose: "One relationship workspace for companies, contacts, and opportunities.", boundary: "CRM integration" },
  { id: "leads", label: "Leads", path: "/crm/leads", group: "SALES", capability: "crm.read", purpose: "Lead intake and qualification.", boundary: "CRM integration" },
  { id: "opportunities", label: "Opportunities", path: "/crm/opportunities", group: "SALES", capability: "crm.read", purpose: "Qualified opportunities linked to projects and proposals.", boundary: "CRM integration" },
  { id: "companies", label: "Companies", path: "/crm/companies", group: "SALES", capability: "crm.read", purpose: "Company records and commercial relationships.", boundary: "CRM integration" },
  { id: "contacts", label: "Contacts", path: "/crm/contacts", group: "SALES", capability: "crm.read", purpose: "People, responsibilities, and verified contact details.", boundary: "CRM integration" },
  { id: "emailblaster", label: "Campaigns", path: "/sales/campaigns", group: "SALES", capability: "crm.write", purpose: "Controlled outreach and campaign delivery.", boundary: "AEON mail / CRM integration" },
  { id: "bidstracker", label: "Bids Tracker", path: "/bids/tracker", group: "BIDDING", capability: "bids.read", existing: true, purpose: "Your existing bid register, pipeline, and document intake.", boundary: "Existing Bids Tracker proxy" },
  { id: "vision", label: "Cabinet Brain", path: "/bids/vision", group: "BIDDING", capability: "vision.read", existing: true, purpose: "Plan Room, evidence, takeoff review, and release gates.", boundary: "Existing Vision proxy" },
  { id: "autobid", label: "Bid Engine", path: "/bids/engine", group: "BIDDING", capability: "bids.read", purpose: "Deterministic estimating and workbook execution.", boundary: "Engine integration" },
  { id: "takeoffs", label: "Takeoffs", path: "/bids/takeoffs", group: "BIDDING", capability: "vision.read", purpose: "Evidence-linked cabinet quantities and takeoff groups.", boundary: "Cabinet Brain canonical takeoff records" },
  { id: "pricing", label: "Pricing", path: "/bids/pricing", group: "BIDDING", capability: "bids.read", purpose: "Workbook-derived prices and immutable pricing snapshots.", boundary: "Engine / authorized workbook records" },
  { id: "proposals", label: "Proposals", path: "/bids/proposals", group: "BIDDING", capability: "bids.read", purpose: "Reviewed proposal packages with visible release status.", boundary: "Engine exports / QA gate" },
  { id: "catalog", label: "SKU Catalog", path: "/bids/catalog", group: "BIDDING", capability: "vision.read", purpose: "Catalog-backed SKUs with workbook provenance; never invented codes.", boundary: "Cabinet Brain catalog records" },
  { id: "fox", label: "Fox", path: "/ai/fox", group: "AI", capability: "backoffice.access", purpose: "Vulpine's assistant, business context, and permitted tools.", boundary: "Agent definition on the shared runtime" },
  { id: "hermes", label: "Hermes", path: "/ai/hermes", group: "AI", capability: "backoffice.access", purpose: "Conversations, sessions, and tool execution.", boundary: "External Hermes runtime; not vendored" },
  { id: "agents", label: "Agents", path: "/ai/agents", group: "AI", capability: "backoffice.access", purpose: "Agent identities, tools, responsibilities, and approvals.", boundary: "Shared agent contracts / runtime" },
  { id: "paperclip", label: "Paperclip", path: "/ai/paperclip", group: "AI", capability: "backoffice.access", purpose: "Autonomous worker coordination, budgets, and execution approvals.", boundary: "External Paperclip orchestration; not vendored" },
  { id: "providers", label: "Model Providers", path: "/ai/providers", group: "AI", capability: "settings.manage", purpose: "Model capabilities and provider configuration without exposing credentials.", boundary: "Server-side provider abstraction" },
  { id: "automations", label: "Automations", path: "/ai/automations", group: "AI", capability: "settings.manage", purpose: "Controlled routines and event-triggered workflows.", boundary: "AEON automation / orchestration" },
  { id: "inbox", label: "Inbox", path: "/communications/inbox", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "Shared company communications linked to projects and people.", boundary: "AEON mail integration" },
  { id: "sms", label: "SMS", path: "/communications/sms", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "Business messaging with verified delivery and consent.", boundary: "AEON voice / Twilio integration" },
  { id: "phone", label: "Dialer", path: "/communications/dialer", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "Your existing communications console.", boundary: "AEON voice console configuration" },
  { id: "calls", label: "Calls", path: "/communications/calls", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "Call history backed by authoritative provider records.", boundary: "AEON voice integration" },
  { id: "recordings", label: "Recordings", path: "/communications/recordings", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "Controlled access to call recordings and transcripts.", boundary: "AEON voice integration" },
  { id: "valerie", label: "Valérie", path: "/communications/valerie", group: "COMMUNICATIONS", capability: "backoffice.access", purpose: "The voice agent using the same tools and company context as Fox.", boundary: "Agent definition / AEON Voice / runtime" },
  { id: "vault", label: "Vault", path: "/knowledge", group: "KNOWLEDGE", capability: "drive.read", purpose: "One canonical knowledge source shared by people and agents.", boundary: "PAI Obsidian indexing integration" },
  { id: "search", label: "Search", path: "/knowledge/search", group: "KNOWLEDGE", capability: "drive.read", purpose: "Evidence-backed retrieval across the company knowledge base.", boundary: "Knowledge index integration" },
  { id: "sops", label: "SOPs", path: "/knowledge/sops", group: "KNOWLEDGE", capability: "drive.read", purpose: "Operational procedures with source documents and revision history.", boundary: "Canonical vault / optional Quartz rendering" },
  { id: "intelligence", label: "Intelligence", path: "/knowledge/intelligence", group: "KNOWLEDGE", capability: "drive.read", purpose: "Source-backed company and project intelligence.", boundary: "Knowledge service integration" },
  { id: "drive", label: "Vulpine Drive", path: "/drive", group: "OPERATIONS", capability: "drive.read", existing: true, purpose: "Your existing files, folders, uploads, and document storage.", boundary: "Existing Drive proxy" },
  { id: "jobs", label: "Jobs", path: "/operations/jobs", group: "OPERATIONS", capability: "dashboard.read", purpose: "Background work with actual progress, failures, and recovery.", boundary: "Worker / job service integration" },
  { id: "events", label: "Events", path: "/operations/events", group: "OPERATIONS", capability: "dashboard.read", purpose: "Canonical business events and delivery history.", boundary: "Event service integration" },
  { id: "notifications", label: "Notifications", path: "/operations/notifications", group: "OPERATIONS", capability: "dashboard.read", purpose: "Real alerts and actionable delivery notifications.", boundary: "Notification service integration" },
  { id: "backups", label: "Backups", path: "/operations/backups", group: "OPERATIONS", capability: "settings.manage", purpose: "Verified backup runs and restore evidence.", boundary: "Infrastructure backup integration" },
  { id: "revenue", label: "Revenue", path: "/finance", group: "FINANCE", capability: "finance.read", purpose: "Revenue and financial reporting from authoritative records.", boundary: "Finance integration" },
  { id: "integrations", label: "Integrations", path: "/integrations", group: "SYSTEM", capability: "settings.manage", purpose: "Integration boundaries and scoped service access.", boundary: "Backoffice service adapters" },
  { id: "services", label: "Services", path: "/system/services", group: "SYSTEM", capability: "settings.manage", purpose: "The platform's service map; connectivity must be verified separately.", boundary: "Service inventory / observability integration" },
  { id: "health", label: "Health", path: "/system/health", group: "SYSTEM", capability: "settings.manage", purpose: "Real service probes and operational incidents.", boundary: "Observability integration" },
  { id: "logs", label: "Logs", path: "/system/logs", group: "SYSTEM", capability: "settings.manage", purpose: "Correlated operational logs with sensitive values redacted.", boundary: "Observability integration" },
  { id: "users", label: "Users", path: "/system/users", group: "SYSTEM", capability: "settings.manage", purpose: "Identity-backed user administration.", boundary: "Existing ZITADEL identity plane" },
  { id: "permissions", label: "Permissions", path: "/system/permissions", group: "SYSTEM", capability: "settings.manage", purpose: "Project roles mapped through the canonical capability model.", boundary: "ZITADEL / packages/auth / packages/permissions" },
  { id: "settings", label: "Settings", path: "/settings", group: "SYSTEM", capability: "settings.read", existing: true, purpose: "Your existing account preferences and sign-out controls.", boundary: "Backoffice settings" },
] as const satisfies readonly { id: string; label: string; path: string; group: string; capability: Capability; existing?: boolean; purpose: string; boundary: string }[]

export type PlatformModule = (typeof platformModules)[number]
export type PlatformModuleId = PlatformModule["id"]
export const platformGroups = [...new Set(platformModules.map((module) => module.group))]

export function moduleForPath(path: string): PlatformModule | undefined {
  const normalized = path === "/dashboard" ? "/" : path.replace(/\/$/, "") || "/"
  return platformModules.find((module) => module.path === normalized)
}

export function moduleForId(id: PlatformModuleId): PlatformModule {
  return platformModules.find((module) => module.id === id)!
}

export function canAccessModule(roles: readonly string[], id: PlatformModuleId): boolean {
  return hasCapability(roles, moduleForId(id).capability)
}

export function visiblePlatformModules(roles: readonly string[]): PlatformModuleId[] {
  return platformModules.filter((module) => hasCapability(roles, module.capability)).map((module) => module.id)
}
