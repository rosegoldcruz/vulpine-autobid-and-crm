# AGENTS.md

## Purpose

This file defines how AI coding agents must work inside this repository.

Agents must use only this file, the repository contents, and explicit task instructions as source of truth.

Do not rely on outside context.

Do not assume unstated business rules.

Do not invent architecture, credentials, environment values, schemas, routes, APIs, deployment behavior, or pricing logic.

If a required decision is not defined, stop and report the missing decision instead of guessing.

---

# Project

This repository contains **Vulpine Command Center**, a CRM and operations platform.

The first production module is the **Bid Engine**.

The CRM will expand module-by-module. Do not attempt to build the entire platform in one pass.

---

# Current Priority

The current priority is:

```text
CRM foundation + Bid Engine
```

Build order:

```text
1. Repository foundation
2. Frontend application shell
3. Backend API service
4. Auth/session foundation
5. Bid Engine shell
6. Cabinet knowledge ingestion
7. Workbook ingestion
8. Plan PDF ingestion
9. PDF page rasterization
10. Plan page classification
11. Unit mix detection
12. Cabinet takeoff extraction
13. SKU mapping
14. Pricing
15. QA gate
16. Export
17. Leads / Contacts / Companies
18. Email module
19. Automations
20. Reporting
```

Do not skip ahead.

Do not build the Email module until the Bid Engine workflow is stable.

---

# Repository Structure

Use this structure:

```text
vulpine-command-center/
  apps/
    web/                 # frontend application

  services/
    api/                 # backend API and workers

  packages/
    shared/              # shared schemas, types, constants

  docs/                  # architecture notes and module docs

  cabinet_knowledge/     # protected cabinet pricing and SKU source material
```

Do not create competing top-level app structures unless the task explicitly requires it.

---

# Hosting Contract

The system uses a split hosting model.

```text
Frontend:
crm.vulpinehomes.com
Hosted on Vercel

Backend:
api.vulpinehomes.com
Hosted on VPS
Managed by PM2
```

## Frontend Rules

Frontend code lives in:

```text
apps/web
```

The frontend is hosted on Vercel.

The frontend must not be served by the VPS.

The frontend must not have a PM2 process.

The frontend must call the backend through:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Frontend responsibilities:

```text
UI layout
sidebar navigation
pages
forms
tables
review screens
API client
loading states
error states
auth UI / session display
```

Frontend must not perform:

```text
PDF parsing
Excel workbook parsing
database writes directly
background jobs
file storage
AI provider calls
long-running worker tasks
pricing calculations as source of truth
safe-to-send approval logic as source of truth
```

Use a central API client.

Do not hardcode backend URLs inside components.

Do not hardcode localhost, IP addresses, or preview deployment URLs in production code.

The frontend displays backend truth. It does not own workflow state.

---

## Backend Rules

Backend code lives in:

```text
services/api
```

The backend runs on the VPS with PM2.

The backend must expose:

```text
GET /health
```

Expected health response:

```json
{ "status": "ok" }
```

Backend responsibilities:

```text
API routes
auth/session verification
database access
file storage
background jobs
Bid Engine processing
PDF rasterization
workbook parsing
AI / vision provider calls
exports
future CRM automation
```

Backend must configure CORS from:

```env
CORS_ALLOWED_ORIGINS=
```

Backend env keys:

```env
PORT=
APP_BASE_URL=
DATABASE_URL=
CORS_ALLOWED_ORIGINS=
STORAGE_ROOT=
ZITADEL_ISSUER=
ZITADEL_CLIENT_ID=
ZITADEL_AUDIENCE=
VERTEX_PROJECT_ID=
VERTEX_LOCATION=
GOOGLE_APPLICATION_CREDENTIALS=
```

Do not hardcode production origins in backend code. Read them from env.

---

# Stack Rules

Use the package manager detected in the repo consistently.

Do not mix package managers unless the reason is documented.

Database access rule:

```text
Raw SQL only.
No ORM.
```

Do not add Prisma, Drizzle, Sequelize, TypeORM, MikroORM, or any other ORM unless explicitly instructed.

Database migrations must be explicit SQL migration files.

Database queries must go through a small backend database access layer.

All Bid Engine pricing, job, export, file, and audit tables must preserve audit fields where applicable:

```text
id
created_at
updated_at
created_by nullable
updated_by nullable
source_file nullable
source_hash nullable
metadata_json nullable
```

---

# Auth and Authorization Rules

Auth model:

```text
ZITADEL OIDC + PKCE
```

Do not invent a different auth provider.

Do not create unauthenticated money-impacting endpoints.

The backend must verify authenticated requests before allowing protected actions.

Protected Bid Engine actions:

```text
approve unit mix
resolve unmatched SKUs
override mapping
override pricing
mark bid safe to send
export final bid package
delete uploaded files
delete bid jobs
change pricing source
reprice a bid
```

Required rule:

```text
Only authorized users may approve unit mix, resolve pricing, mark safe_to_send, or export final bid packages.
```

If auth is not implemented yet, protected endpoints must return a clear protected/unavailable response rather than pretending to be production-secure.

Do not mark any bid `cabinet_bid_safe_to_send` from an unauthenticated or unverified action.

---

# Agent Execution Protocol

Every coding task is an end-to-end execution cycle.

A task is not complete when code is edited.

A task is complete only when the agent has:

```text
1. inspected the relevant files
2. implemented the requested change
3. run the correct verification commands
4. fixed failures caused by its changes
5. updated documentation or env examples when needed
6. committed the finished work to Git
7. pushed the finished work to GitHub
8. configured Vercel env vars through CLI when required
9. completed backend deployment steps when required and when access exists
10. reported exact proof of completion
```

Do not leave completed work sitting locally.

Do not ask the user to perform steps the agent can complete with available tools and permissions.

---

# GitHub Source of Truth

GitHub is the source of truth.

Every completed prompt must end with a Git commit and GitHub push unless a real blocker prevents it.

Required Git flow:

```bash
git status
git add .
git diff --staged
git commit -m "<clear task-based commit message>"
git push
git status
git rev-parse --short HEAD
git remote -v
```

Commit messages must describe the actual work.

Good examples:

```text
feat: add bid engine shell
feat: add workbook ingestion endpoint
feat: add vercel api base env setup
fix: block bid export when unit mix is unverified
docs: add deployment contract
chore: add pm2 config
```

Do not use vague commit messages:

```text
update
changes
stuff
fix
wip
final
```

unless the user explicitly requests a temporary WIP commit.

Acceptable task endings:

```text
completed and pushed
completed but push failed with exact blocker
not completed because verification failed
not completed because required access is missing
```

Do not report a task as complete unless the GitHub push succeeded.

The final report must include:

```text
branch
commit hash
remote pushed to
working tree status
```

If push fails, report the exact failed command and exact error.

---

# Vercel CLI Responsibilities

When frontend deployment or frontend environment variables are involved, use the Vercel CLI when available.

Check CLI availability:

```bash
npx vercel --version
```

or, if the repo uses pnpm:

```bash
pnpm dlx vercel --version
```

Use the package manager already used by the repo.

Do not mix package managers unless there is a clear reason and it is documented.

---

# Vercel Environment Variables

Frontend env vars must be created or updated through Vercel CLI when authenticated access is available.

Required frontend env key:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Production value should point to the backend API:

```text
https://api.vulpinehomes.com
```

Do not hardcode this value in source code.

Do not put real env values into `.env.example`.

`.env.example` must keep empty values only.

Correct:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Incorrect:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.vulpinehomes.com
```

Before changing Vercel env vars, inspect or establish project linkage:

```bash
npx vercel link
```

Then add required env vars.

Production:

```bash
printf "%s" "https://api.vulpinehomes.com" | npx vercel env add NEXT_PUBLIC_API_BASE_URL production
```

Preview:

```bash
printf "%s" "https://api.vulpinehomes.com" | npx vercel env add NEXT_PUBLIC_API_BASE_URL preview
```

Development:

```bash
printf "%s" "http://localhost:4000" | npx vercel env add NEXT_PUBLIC_API_BASE_URL development
```

If the env var already exists, update it by removing and re-adding it:

```bash
npx vercel env rm NEXT_PUBLIC_API_BASE_URL production
printf "%s" "https://api.vulpinehomes.com" | npx vercel env add NEXT_PUBLIC_API_BASE_URL production
```

Do not guess whether an env var exists. Inspect when possible.

Do not claim Vercel env vars were created unless the CLI command succeeded.

---

# Vercel Deployment Rules

If frontend code changes, verify the frontend build.

Example:

```bash
cd apps/web
npm run build
```

or use the actual package manager command from the repo.

If the repo is connected to Vercel through GitHub, a GitHub push may trigger deployment automatically.

In that case, report:

```text
GitHub push completed.
Vercel Git integration should deploy the frontend.
Production deployment was not manually run.
```

If production deployment is required and Vercel CLI is authenticated, run:

```bash
npx vercel --prod
```

Do not claim Vercel deployment succeeded unless it was verified.

---

# Backend Deployment Rules

If backend code changes, prepare or execute the VPS/PM2 deployment path.

Backend location:

```text
services/api
```

Expected backend operations may include:

```bash
git pull
npm install
npm run build
pm2 restart <service-name>
pm2 save
curl http://localhost:$PORT/health
```

Use actual backend commands from the repo.

If GitHub Actions deploys the backend, verify the workflow exists and confirm the push should trigger it.

If backend deployment cannot be completed because SSH access, secrets, VPS details, or PM2 service names are missing, report the exact blocker.

---

# Zero Manual Handoff Rule

The agent must complete every action it can complete with available tools and permissions.

Do not ask the user to do anything the agent can do.

Only stop for user intervention when:

```text
required credentials are missing
required secrets are unknown
third-party login or approval is required
billing/payment verification is required
DNS must be changed manually in a UI
production-destructive action requires explicit approval
the task is ambiguous enough to risk damaging production
```

If blocked, report:

```text
what is blocked
why it is blocked
exact missing access/value/tool
the command or UI step that could not be completed
the safest next action
```

Do not use vague blocker language.

Bad:

```text
You may need to configure this.
```

Good:

```text
Blocked: Vercel CLI is not authenticated.
Command failed: npx vercel env add NEXT_PUBLIC_API_BASE_URL production
Missing: Vercel login/session for the target project.
Next action: authenticate Vercel CLI or provide a Vercel token.
```

---

# DNS Rule

Agents must not change DNS unless explicitly instructed and properly authenticated.

If DNS changes are required, provide exact records:

```text
record to delete
record to add
record type
record name
record value
TTL
records that must not be touched
```

Architecture DNS target:

```text
crm.vulpinehomes.com → Vercel frontend
api.vulpinehomes.com → VPS backend
```

Do not touch unrelated records unless explicitly required:

```text
MX
TXT
CAA
root/apex
api
files
noco
n8n
database
automation
```

---

# Environment Rules

No fake environment values.

`.env.example` files must use empty values only.

Correct:

```env
NEXT_PUBLIC_API_BASE_URL=
```

Incorrect:

```env
NEXT_PUBLIC_API_BASE_URL=https://example.com
```

If a required env var is missing, fail with this exact format:

```text
Missing required env var: EXACT_ENV_VAR_NAME
```

Do not commit real secrets.

Do not invent credentials.

Do not invent API keys.

Do not invent database URLs.

---

# AI and Vision Provider Rules

AI and vision calls belong on the backend only.

Default AI / vision provider:

```text
Vertex AI Gemini
```

Use a provider abstraction so the model can be swapped later.

Do not hardcode model names inside business logic.

Do not invent provider names, model names, endpoints, or credentials.

Required behavior:

```text
PDF rasterization and deterministic text extraction may run without AI keys.
Vision-based extraction must be skipped or marked unavailable if AI env is missing.
```

If the selected provider/model is not configured, the backend must return a clear provider-unavailable status and continue deterministic processing where possible.

Required provider env keys must appear in backend `.env.example` with empty values only.

---

# Upload and File Validation Rules

The backend must validate all uploads.

Accepted workbook types:

```text
.xlsx
.csv
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
text/csv
```

Accepted plan types:

```text
.pdf
application/pdf
```

Default upload limits unless explicitly changed:

```text
Workbook max size: 50 MB
Plan PDF max size per file: 250 MB
Total plan upload batch max size: 2 GB
Max files per job upload batch: 100
```

Reject unsupported file types.

Reject files over configured limits.

Do not trust client-side validation.

Do not store uploaded files without recording:

```text
original filename
stored filename
mime type
size bytes
sha256 hash
uploaded_by nullable
uploaded_at
job_id
```

---

# Testing Requirements

Pricing and bid logic must be tested.

At minimum, tests must cover:

```text
workbook ingestion preserves source file/sheet/row
job-level workbook overrides default cabinet_knowledge only for that job
corrupt job-level workbook does not silently fall back
SKU mapping never invents SKUs
unmatched SKU remains unresolved
unit mix missing blocks safe_to_send
unit mix unverified blocks safe_to_send
sample extraction total is not treated as final bid
pricing uses unit_cost_snapshot
existing bid does not silently reprice after workbook changes
export includes warnings and unresolved items
failure states return safe_to_send false
```

Do not claim pricing logic is complete without tests for the pricing path.

Do not claim a build is production-ready if core pricing tests are missing or failing.

---

# First Module: Bid Engine

The Bid Engine is the first production CRM module.

Primary route:

```text
/autobid
```

The Bid Engine converts:

```text
pricing workbook + construction plan PDFs + unit mix + cabinet takeoff
```

into:

```text
reviewable cabinet bid package
```

The Bid Engine is not a generic construction estimator.

The Bid Engine is not a full GC bidding platform.

The first version focuses on cabinet bidding.

---

# Bid Engine Scope

Allowed first-version scope:

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

If an item exists inside the cabinet workbook as a cabinet-related accessory, filler, panel, molding, hardware, shipping, build, or margin input, preserve it as a workbook-derived record.

---

# Source of Truth Rules

The workbook is the only pricing source of truth.

The plans are the source for scope, quantity, and unit mix.

Human review is the final approval gate.

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

If data is unknown, mark it unknown.

If data is unresolved, list it as unresolved.

If confidence is low, report low confidence.

Do not hide uncertainty.

---

# Cabinet Knowledge Folder

The `cabinet_knowledge/` folder is a protected source-of-truth asset for the Bid Engine module.

This folder contains the cabinet pricing and logic material that powers the first CRM module.

Expected contents may include:

```text
cabinet_knowledge/
  Multi-Family Excel extraction .txt
  Multi-Family Master Sheet V6 - Good, Better, Best Frameless Boxes - Copy.xlsx
  Multi-Family Master Sheet V6 - Good, Better, Best Frameless Boxes - Copy.extracted.json
  skus.xlsx
```

Treat this folder as the Bid Engine’s cabinet intelligence base.

The files in this folder are not random uploads. They are the cabinet logic, pricing workbook, SKU reference, extraction reference, and workbook-derived knowledge required to build the estimating workflow.

## Cabinet Knowledge Rules

Agents must not delete, rename, overwrite, flatten, or restructure `cabinet_knowledge/` unless explicitly instructed.

Agents must treat `cabinet_knowledge/` as read-first source material.

The Bid Engine must use this folder to understand:

```text
cabinet SKUs
inventory codes
cabinet codes
framed / frameless families
finishes
pricing rows
workbook structure
accessories
fillers
panels
moldings
hardware
margin/build/shipping inputs when present
source workbook references
```

The workbook and extracted reference files inside `cabinet_knowledge/` are the starting point for:

```text
CabinetWorkbookIngestionAgent
CabinetSkuMapperAgent
CabinetPricingAgent
CabinetEstimateAgent
CabinetQaAgent
CabinetExportAgent
```

## Cabinet Knowledge Protection Rule

Do not treat `cabinet_knowledge/` as disposable test data.

Do not generate replacement files over it.

Do not clean it up automatically.

Do not mutate the original source files.

If transformed data is needed, write generated outputs to backend storage, a database, or a generated artifacts folder, while preserving the original `cabinet_knowledge/` files untouched.

---

# Workbook Precedence Rules

The Bid Engine supports two workbook sources:

```text
1. Repo-level default workbook source:
   cabinet_knowledge/

2. Job-level uploaded workbook source:
   POST /autobid/jobs/:id/workbook
```

Precedence rule:

```text
Job-level uploaded workbook overrides repo-level cabinet_knowledge/ for that specific job only.
```

Repo-level `cabinet_knowledge/` is the default cabinet pricing source.

A job-level uploaded workbook is a project-specific override.

A job-level uploaded workbook must not mutate, replace, delete, or rewrite `cabinet_knowledge/`.

When a job-level workbook is uploaded:

```text
parse it into job-scoped pricing records
store its source file hash
store its uploaded timestamp
store its uploader/user id when auth exists
mark the job pricing source as job_uploaded_workbook
use it for that job's SKU mapping, pricing, estimate, QA, and export
```

When no job-level workbook is uploaded:

```text
use normalized pricing records derived from cabinet_knowledge/
mark the job pricing source as default_cabinet_knowledge
```

A bid export must always show which pricing source was used:

```text
pricing_source_type:
  default_cabinet_knowledge
  job_uploaded_workbook

pricing_source_file:
  filename

pricing_source_hash:
  sha256 hash

pricing_source_version:
  detected workbook name/version if available
```

Never blend repo-level and job-level workbook pricing inside the same bid unless a future task explicitly implements multi-source pricing with visible source labels per line item.

If a job-level workbook is corrupt, unreadable, or missing required pricing columns, the system must not silently fall back to `cabinet_knowledge/`.

Instead:

```text
status = workbook_ingestion_failed
safe_to_send = false
critical_issues includes "job-level workbook could not be ingested"
```

Fallback to `cabinet_knowledge/` after a failed job-level workbook is only allowed after explicit human action.

---

# Pricing Snapshot and Versioning Rules

Every bid must freeze the exact pricing source used at calculation time.

A bid must not silently re-resolve prices against a newer workbook after it has been created.

For every bid and bid line item, store:

```text
pricing_source_type
pricing_source_file
pricing_source_hash
pricing_source_version
source_sheet
source_row
sku
unit_cost_snapshot
calculated_at
```

If `cabinet_knowledge/` changes later, existing bids must keep their original pricing snapshot.

Repricing an existing bid requires an explicit reprice action.

A reprice action must create a new pricing snapshot and record:

```text
previous_pricing_source_hash
new_pricing_source_hash
repriced_by nullable
repriced_at
reason
```

---

# Bid Engine Pipeline

The Bid Engine uses this structured pipeline:

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

Each stage must produce structured output containing:

```text
status
source references
confidence
warnings
assumptions
unresolved items
next required action
```

No stage may silently guess.

---

# Bid Status Machine

Allowed bid statuses:

```text
workbook_ingested
cabinet_pages_classified
cabinet_takeoff_draft
unit_mix_required
pricing_mapping_required
cabinet_bid_review_required
cabinet_bid_safe_to_send
```

Allowed failure states:

```text
workbook_ingestion_failed
plan_ingestion_failed
pdf_rasterization_failed
cabinet_page_classification_failed
unit_mix_detection_failed
cabinet_takeoff_failed
pricing_mapping_failed
export_failed
processing_error
```

Failure states must include:

```text
error_code
error_message
failed_stage
recoverable boolean
next_required_action
```

Any failed job must have:

```text
safe_to_send = false
```

Do not hide failures inside logs only. Failure details must be visible through the API and UI.

Do not skip gates.

A bid cannot become:

```text
cabinet_bid_safe_to_send
```

unless:

```text
unit mix is verified
repetition has been applied
all priced lines reference workbook records
unresolved items are visible
critical issues are empty
human review has passed
```

---

# Critical Safety Rule

A number is not a bid unless unit repetition has been applied and QA has passed.

A single-unit extraction or partial takeoff must be labeled:

```text
SAMPLE EXTRACTION TOTAL - NOT PROJECT BID
```

Never present a sample extraction as a project-level bid.

Never present a draft as a final bid.

Never mark a bid safe if unresolved items exist.

---

# Bid Engine UI Contract

The Bid Engine UI should use this structure:

```text
Ingestion Hub
  - upload pricing workbook
  - upload plan PDFs

Workflow Control Center
  - show current pipeline state
  - show blocked gates
  - show current job status

Workspace Draft Viewer
  - unit mix
  - cabinet takeoff
  - SKU mapping
  - unresolved items
  - review notes
  - source references

Review & Export
  - JSON export
  - CSV export
  - Excel export later
```

The UI displays backend truth.

The UI is not the source of truth for workflow state.

---

# Initial CRM Navigation

Initial sidebar:

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

Do not add the Email module in the first build phase.

---

# Backend API Guidance

Initial backend routes should include:

```text
GET /health

GET /autobid/status
POST /autobid/jobs
GET /autobid/jobs/:id
POST /autobid/jobs/:id/workbook
POST /autobid/jobs/:id/plans
POST /autobid/jobs/:id/run
POST /autobid/jobs/:id/approve-unit-mix
GET /autobid/jobs/:id/export/json
GET /autobid/jobs/:id/export/csv
```

If a route is not implemented, the frontend must show a clear unavailable state.

Do not create frontend screens that pretend backend data exists.

---

# Data Persistence Rules

Do not use browser localStorage as production persistence for bid jobs.

Bid jobs, uploads, outputs, and audit trails belong on the backend.

Persistent records should include:

```text
job id
uploaded files
pipeline status
events
warnings
assumptions
unit mix
takeoff items
SKU matches
pricing lines
QA result
exports
created timestamp
updated timestamp
```

---

# PDF / Vision Rules

PDF rendering and vision processing belong on the backend.

Do not process large construction PDFs in the Vercel frontend runtime.

Rendered plan images should be stored as backend artifacts with metadata.

Do not use huge Base64 payloads as the long-term storage strategy.

Use file paths, artifact IDs, or signed URLs where appropriate.

---

# Workbook Rules

Workbook ingestion must preserve source references.

Every pricing record should retain:

```text
source workbook
source sheet
source row
SKU or inventory code
cabinet code
description
finish
construction family
unit cost
formula if present
cached value if present
warnings
```

If a row is ambiguous, report it as a warning.

Do not drop ambiguous rows silently.

Do not guess missing prices.

---

# Unit Mix Rules

Unit mix is mandatory for project-level bids.

If unit mix is missing or unverified:

```text
status = unit_mix_required
safe_to_send = false
```

A user must approve or verify unit mix before project-level bid totals can be treated as reviewable.

---

# SKU Mapping Rules

SKU mapping must only map to workbook-derived records.

Do not invent SKUs.

Do not price unmatched items at zero without listing them as unresolved.

Every mapped item must include:

```text
matched SKU
pricing item id
source sheet
source row
confidence
match reason
```

Every unmatched item must remain visible.

---

# QA Rules

QA must block unsafe bids.

Critical issues include:

```text
missing workbook
missing plan files
no cabinet pages found
missing unit mix
unverified unit mix
unresolved cabinet items
pricing not sourced from workbook
sample extraction treated as final bid
export missing unresolved items
corrupt job-level workbook
missing pricing snapshot
unauthenticated protected approval
```

If critical issues exist:

```text
safe_to_send = false
```

---

# Export Rules

Exports must include:

```text
status
safe_to_send
critical issues
warnings
assumptions
unit mix
takeoff items
SKU matches
pricing lines
unresolved items
source workbook rows
source plan pages
pricing_source_type
pricing_source_file
pricing_source_hash
pricing_source_version
unit_cost_snapshot
```

Export formats:

```text
JSON first
CSV second
Excel later
PDF later
```

Do not hide warnings or unresolved items in logs only. They must appear in exported review data.

---

# Coding Rules

Do not:

```text
mix frontend/backend runtime concerns
host frontend on VPS
create fake env values
fake tests
fake successful builds
invent APIs without implementing them
invent auth providers
invent AI providers
invent ORM/database architecture
hide unresolved items
silently guess missing data
silently fall back from corrupt job workbook to cabinet_knowledge
build all modules at once
leave completed work unpushed
ask for manual action when the agent has access to do it
```

Do:

```text
build small modules
keep route names obvious
keep file names obvious
use shared schemas where useful
write maintainable code
validate inputs
return clear errors
report actual commands run
surface warnings
preserve source references
block unsafe bid output
write tests for pricing and QA rules
commit completed work
push completed work to GitHub
configure Vercel env vars through CLI when possible
complete all available deployment/configuration steps before stopping
```

---

# Verification Commands

Use actual package manager commands from the repo.

Frontend examples:

```bash
cd apps/web
npm install
npm run build
```

Backend examples:

```bash
cd services/api
npm install
npm run build
npm run start
curl http://localhost:$PORT/health
```

Test examples:

```bash
npm test
npm run test
npm run lint
npm run typecheck
```

Use only commands that exist in the repo.

If using pnpm, use pnpm consistently.

If using npm, use npm consistently.

Do not mix package managers without documenting why.

---

# Final Report Format

Every major task must end with:

```text
Summary:
- What changed
- Files created
- Files edited

Verification:
- Commands run
- Build result
- Test result
- Health check result

Env:
- Required frontend env vars
- Required backend env vars

Git:
- Branch
- Commit hash
- Remote pushed to
- Working tree status

Vercel:
- Env vars created/updated
- Build/deploy command run, if any
- Deployment result, if verified
- If not deployed, why not

Backend:
- PM2 service touched, if any
- Health endpoint result, if checked
- If not deployed, why not

Blockers:
- Anything the agent could not complete
- Exact missing access/value/tool

Limitations:
- Known gaps
- What is stubbed
- What is production-ready
- What still requires human verification

Next Step:
- One recommended next action
```

No vague claims.

No fake proof.

No unstated assumptions.

No fake GitHub push claims.

No fake Vercel env claims.

No fake deployment claims.

---

# Completion Standard

The agent must operate like this:

```text
receive prompt
inspect repo
execute task
verify task
commit task
push task to GitHub
configure env/deploy steps when possible
report proof
```

A task is not finished until the work is pushed to GitHub or a real blocker is reported.

---

# Current Mission

Build the CRM foundation and make the Bid Engine the first real module.

Do not build everything at once.

Do not assume missing context.

This file is the operating contract for coding agents.
