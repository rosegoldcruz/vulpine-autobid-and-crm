# Vulpine Command Center

Vulpine Command Center is the internal CRM and operations platform for Vulpine.

This build starts with the **Bid Engine** as the first production module. The CRM is not being built all at once. We are building it module-by-module, using the same disciplined operating style that worked during the Diversified build: one finished loop, verified in runtime, then the next module.

The first useful loop is:

```text
CRM shell → Bid Engine → cabinet workbook ingestion → plan intake → cabinet takeoff draft → SKU/pricing mapping → review/export
```

Email, campaign operations, automation, and other CRM systems come later.

---

## Core Doctrine

This repo is a clean rebuild.

We are not patching the old Command Center. We are not importing the old shell. We are not mixing broken old architecture with new code.

The build doctrine is:

```text
Clean foundation.
One module at a time.
Runtime proof before expansion.
No fake production claims.
No bloated rebuild.
No legacy contamination.
```

The CRM starts with the Bid Engine because bidding is the highest-leverage internal tool for Vulpine right now.

---

## Hosting Model

This build uses a split deployment architecture.

```text
crm.vulpinehomes.com
  → Vercel-hosted frontend

api.vulpinehomes.com
  → VPS-hosted backend API / workers / database / files
```

### Frontend

The frontend is hosted on Vercel.

The VPS must not serve the CRM frontend.

Frontend responsibilities:

```text
UI shell
sidebar navigation
dashboards
forms
tables
review screens
API client
module interfaces
```

Frontend does not handle:

```text
PDF parsing
Excel ingestion
database writes directly
background jobs
AI provider calls
file storage
worker processes
```

### Backend

The backend is hosted on the VPS and managed by PM2.

Backend responsibilities:

```text
API routes
database access
file storage
background jobs
bid engine processing
PDF rasterization
workbook parsing
AI/vision calls
exports
future CRM automation
```

---

## Normal Deployment Model

GitHub is the source of truth.

Normal workflow:

```bash
git add .
git commit -m "update"
git push
```

Expected deployment behavior:

```text
Vercel deploys the frontend automatically.
Backend deploys or restarts through the VPS/PM2 deployment path.
```

No normal frontend deployment should require manually running a server deploy script.

---

## Repo Structure

Target structure:

```text
vulpine-command-center/
  apps/
    web/                 # Vercel frontend

  services/
    api/                 # VPS backend API / workers

  packages/
    shared/              # shared schemas, types, constants

  docs/                  # architecture notes and module plans
```

---

## Phase Strategy

We are building the CRM in controlled phases.

### Phase 1 — CRM Foundation + Bid Engine Shell

Build:

```text
clean CRM shell
Vercel frontend
VPS backend
shared package
health checks
sidebar
routing
Bid Engine module shell
Vulpine Drive link
```

Do not build email engine yet.

Do not build every CRM module yet.

### Phase 2 — Cabinet Bid Engine Core

Build the real bid engine backend.

Modules:

```text
Workbook ingestion
Plan upload
PDF page rendering
Plan classification
Unit mix detection
Cabinet takeoff draft
SKU mapping
Pricing
QA gate
Review/export
```

### Phase 3 — Leads / Contacts / Companies

Add the CRM data layer around customers, contractors, suppliers, projects, and opportunities.

### Phase 4 — Email / Campaign Engine

Email comes after the Bid Engine is useful.

Monday CRM or external tools can handle email operations until our own clean email module is ready.

### Phase 5 — Automation / Revenue / Reporting

Add operational automation only after the foundation and first modules are stable.

---

# Bid Engine

The Bid Engine lives inside the CRM.

It is not a separate random app. It is the first major CRM module.

Route target:

```text
/autobid
```

The Bid Engine is an AI-assisted, cabinet-focused estimating system that converts plan packages and cabinet pricing workbooks into reviewable bid drafts.

It is not a generic construction estimator.

It is not a full GC bidding engine.

It is not an all-trades takeoff tool.

The first version focuses on cabinet bidding.

---

## Bid Engine Product Definition

```text
Plans + cabinet workbook + unit mix + SKU pricing + QA
→ reviewable cabinet bid package
```

The system should answer:

```text
What cabinet items are in this project?
Where do they appear?
How many units do they repeat across?
Which workbook SKUs do they map to?
What pricing comes from the workbook?
What is unresolved?
Is the bid safe to send?
```

---

## Bid Engine Scope

Allowed scope:

```text
Cabinetry
Vanities
Sink Bases
Drawer Bases
Wall Cabinets
Tall Cabinets
Pantry Cabinets
Fillers
Panels
Moldings
Cabinet Accessories
Cabinet Hardware
Cabinet Build / Assembly inputs
Cabinet Shipping / Margin inputs
```

Disallowed by default:

```text
Flooring
Standalone countertops
Paint
Civil
Structural
Mechanical
Electrical
Plumbing
Fire protection
Landscaping
Geotech
Wage scale
Full GC estimating
```

Exception:

If a row exists inside the cabinet workbook as a cabinet-related accessory, filler, panel, molding, hardware, shipping, build, or margin input, it may be preserved as a workbook-derived cabinet record.

---

## Source of Truth Rules

The workbook is the only pricing source of truth.

The plans are the scope and quantity source.

```text
Workbook = pricing universe
Plans = scope / quantity / unit mix source
Human review = final approval gate
```

The system must never invent:

```text
SKUs
unit costs
final totals
missing quantities
verified unit mix
safe-to-send status
```

---

## Bid Engine Agent Pipeline

The Bid Engine uses a structured multi-agent pipeline.

```text
CabinetWorkbookIngestionAgent
        ↓
CabinetPlanClassifierAgent
        ↓
CabinetPageExtractorAgent
        ↓
UnitMixAgent
        ↓
CabinetTakeoffAgent
        ↓
CabinetSkuMapperAgent
        ↓
CabinetPricingAgent
        ↓
CabinetEstimateAgent
        ↓
CabinetQaAgent
        ↓
CabinetExportAgent
```

Each agent must produce structured output with:

```text
status
source references
confidence
warnings
assumptions
unresolved items
next required action
```

No agent should silently guess.

---

## Bid Status Machine

A bid can only move through these states:

```text
workbook_ingested
cabinet_pages_classified
cabinet_takeoff_draft
unit_mix_required
pricing_mapping_required
cabinet_bid_review_required
cabinet_bid_safe_to_send
```

A bid cannot be marked `cabinet_bid_safe_to_send` unless:

```text
unit mix is verified
repetition has been applied
all priced lines reference workbook records
unresolved items are visible
critical issues are empty
human review has passed
```

---

## Critical Safety Rule

A number is not a bid unless unit repetition has been applied and QA has passed.

A single-unit extraction or partial takeoff must be labeled:

```text
SAMPLE EXTRACTION TOTAL - NOT PROJECT BID
```

The system must not present a sample extraction as a project-level bid.

---

## Bid Engine UI

The Bid Engine UI should follow this workflow:

```text
Ingestion Hub
  - upload pricing workbook
  - upload plan PDFs

Workflow Control Center
  - show active pipeline state
  - show blocked gates
  - show current job status

Workspace Draft Viewer
  - unit mix
  - cabinet takeoff
  - SKU mapping
  - unresolved items
  - review notes
  - export package

Review & Export
  - JSON export
  - CSV export
  - Excel export later
```

---

## First CRM Navigation

Initial CRM sidebar:

```text
// CORE
Dashboard

// CRM
Leads
Contacts
Companies

// REVENUE
Revenue
Bid Engine

// SYSTEM
Vulpine Drive
Settings
```

Email Engine is intentionally excluded from the first build phase.

---

## Vulpine Drive

Vulpine Drive survives as a preserved system/service.

In the new CRM, it should appear as a sidebar item or linked module.

The first CRM build should not rewrite Vulpine Drive unless explicitly required.

---

## Email Engine

Email Engine is not phase one.

The CRM will eventually include:

```text
email operations
campaigns
templates
suppression lists
reply tracking
automation
queue processing
```

But this comes after the Bid Engine foundation is real.

Current operating position:

```text
Monday CRM / external tools handle email until our clean email module is ready.
```

---

## Environment Rules

No fake environment values.

`.env.example` files must use empty values only.

Missing required environment variables must fail with:

```text
Missing required env var: EXACT_ENV_VAR_NAME
```

Frontend env:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Backend env:

```env
PORT=
APP_BASE_URL=
DATABASE_URL=
CORS_ALLOWED_ORIGINS=
STORAGE_ROOT=
```

---

## Development Rules

Do not:

```text
import old Command Center shell code
copy old routes
reuse old broken deployment scripts
host frontend on the VPS
put frontend build artifacts on the VPS
mix frontend and backend runtime concerns
build all CRM modules at once
fake successful tests
fake production readiness
```

Do:

```text
build one module at a time
verify runtime behavior
keep frontend on Vercel
keep backend on VPS
preserve clear API boundaries
document every module contract
surface unresolved items
block unsafe bid output
```

---

## Build Order

The correct order is:

```text
1. Clean repo foundation
2. Frontend shell
3. Backend health/API service
4. Vercel/VPS deployment contract
5. Vulpine Drive link
6. Bid Engine shell
7. Workbook ingestion
8. PDF plan ingestion / rasterization
9. Plan classification
10. Unit mix detection
11. Cabinet takeoff
12. SKU mapping
13. Pricing
14. QA gate
15. Export
16. CRM leads/contacts/companies
17. Email engine
18. Automations
```

---

## Verification Philosophy

Every phase must prove itself before the next phase starts.

A phase is not done because code exists.

A phase is done when:

```text
it runs
it builds
it has a health check or visible UI proof
it has documented env requirements
it has no fake values
it does not break the previous phase
```

---

## Current Mission

The current mission is not to build the entire CRM.

The current mission is:

```text
Build the new CRM foundation and make the Bid Engine the first real module.
```

The CRM grows after that.

One module at a time.
One verified loop at a time.
No legacy contamination.
No all-at-once rebuild.
