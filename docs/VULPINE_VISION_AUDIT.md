# VULPINE VISION AUDIT

## Executive Summary

**What Vulpine Vision actually is today:**

Vulpine Vision, as currently integrated into the back-office codebase, is **not** a working AI cabinetry takeoff engine. Inside the current back-office monorepo (`/opt/vulpine-platform`), Vision is a **quarantined document-ingestion module** that can:

- create a Vision project,
- accept PDF / ZIP / XLSX / CSV uploads,
- persist those uploads to file-backed storage,
- parse workbook rows heuristically,
- extract PDF text via `pdfjs-dist`,
- classify pages using deterministic keyword heuristics,
- persist job/project state,
- and stop at `unit_mix_review_required` with `safeToSend = false`.

Evidence:
- `services/vision/README.md`
- `services/vision/src/service.ts`
- `services/vision/src/parsers.ts`
- `services/vision/src/quarantine.ts`
- `apps/backoffice/lib/vision-proxy.ts`
- `apps/backoffice/components/cards/vision-section.tsx`

The back-office integration explicitly states estimator intelligence remains quarantined and blocked. The only allowed Vision proxy operations are:
- `POST /projects`
- `POST /uploads`
- `GET /jobs/:id`
- `POST /jobs/:id/process`

Blocked operations include:
- approve unit mix
- resolve
- export
- pricing
- takeoff

Evidence:
- `apps/backoffice/lib/vision-proxy.ts`
- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `tests/vision-proxy.test.ts`

There is also a **standalone** repo at `/opt/vulpine-vision` that contains a broader App Router app, chat/voice features, lead handoff, and legacy estimator prototype history. But even there, the active workflow service intentionally returns empty unit mix / takeoff / pricing outputs and throws `ESTIMATOR_INTELLIGENCE_DISABLED` for estimator mutations.

Evidence:
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`
- `/opt/vulpine-vision/docs/CABINET_INTELLIGENCE_AUDIT.md`
- `/opt/vulpine-vision/docs/GOLDEN_BID_SPEC.md`
- `/opt/vulpine-vision/app/api/health/route.ts`

**Bottom line:**
- The current Vision foundation is **good at controlled ingestion and evidence preservation**.
- It is **not currently capable of generating trustworthy cabinet takeoffs or SKUs**.
- The more mature estimating domain architecture today actually lives more in the **separate FastAPI Auto Bid engine** under `services/engine/services/auto_bid/*` than in the active Vision service.
- Extraction into an SNRG Labs product is **practical**, but **not by treating current Vision as a finished takeoff engine**. The realistic extraction is a combination of:
  1. Vision’s ingestion/storage/proxy shell,
  2. Auto Bid’s richer data model / workflow / SKU catalog / pricing architecture,
  3. and a new estimator core replacing the quarantined prototype logic.

---

## Current Repository Architecture

### Repository roots discovered

Under `/opt`, the relevant codebases are:

- `/opt/vulpine-platform` — current back-office monorepo, Git repo
- `/opt/vulpine-vision` — standalone Vision app, Git repo
- `/opt/vulpine-engine` — older standalone FastAPI engine deployment
- `/opt/vulpine-ai` — standalone Auto Bid frontend deployment
- `/opt/vulpine-bids-tracker` — standalone bids tracker app

Evidence:
- `.git` roots discovered under `/opt`
- `/opt/vulpine-platform/pnpm-workspace.yaml`
- `/opt/vulpine-platform/package.json`

### Monorepo structure

`/opt/vulpine-platform` is a pnpm workspace:

- `apps/*`
- `packages/*`
- `services/*`

Evidence:
- `pnpm-workspace.yaml`

### Back-office application

The monorepo’s main app is:

- `apps/backoffice`

Evidence:
- `package.json` root scripts target `@vulpine/backoffice`
- `apps/backoffice/package.json`

### Vision service inside monorepo

The monorepo has a single workspace service for Vision:

- `services/vision`

Evidence:
- `services/vision/package.json`

### Shared packages relevant to productization

Reusable packages already exist:

- `packages/auth`
- `packages/config`
- `packages/contracts`
- `packages/sdk`
- `packages/permissions`
- `packages/types`
- `packages/events`
- `packages/observability`
- `packages/ui`
- `packages/agents`

Evidence:
- `packages/*/package.json`

### Separate Python engine already present

The monorepo also contains a copied Python engine service:

- `services/engine`

It includes:
- FastAPI routes
- PostgreSQL-backed Auto Bid tables
- SKU catalog / mapping logic
- deterministic pricing
- proposal generation
- audit events

Evidence:
- `services/engine/docker-compose.yml`
- `services/engine/services/auto_bid/routes.py`
- `services/engine/services/auto_bid/models.py`
- `services/engine/db/migrations/001_auto_bid.sql`

### Current deployment split

Per the system map, current reality is split between:

- Vercel / backoffice shell
- server-side Vision / Engine / auth / storage / DB services

Evidence:
- `docs/architecture/current-system-map.md`

---

## Where Vulpine Vision Lives

## 1) Backoffice UI route

The back-office Vision UI route is:

- `apps/backoffice/app/bids/vision/page.tsx`

This route requires `vision.read` when auth is enabled and mounts the command center with `initialSection="vision"`.

Evidence:
- `apps/backoffice/app/bids/vision/page.tsx`

## 2) Backoffice Vision UI component

The actual integrated UI is:

- `apps/backoffice/components/cards/vision-section.tsx`

This UI provides:
- create project
- select files
- upload
- process
- refresh
- evidence display
- QA issue display
- quarantine banner

It explicitly says:
- “Deterministic evidence comes in; estimator intelligence stays locked down.”
- the module cannot approve unit mix, generate takeoff, resolve SKUs, calculate pricing, export a bid, or mark anything safe to send.

Evidence:
- `apps/backoffice/components/cards/vision-section.tsx`

## 3) Backoffice API proxy routes

Backoffice exposes:

- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `apps/backoffice/app/api/integrations/vision/handoff/route.ts`

The Vision proxy sends server-to-server calls to `VISION_API_URL` and injects `VISION_API_TOKEN` as `x-vulpine-integration-key`.

Evidence:
- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `packages/config/src/index.ts`

## 4) Monorepo Vision service

The workspace Vision code lives in:

- `services/vision/src/*`

But this package is **not** a deployed HTTP server by itself. It is framework-neutral extracted domain code.

Evidence:
- `services/vision/README.md`
- `services/vision/package.json`

## 5) Standalone upstream Vision system of record

Backoffice still depends on a deployed standalone Vision API upstream. The migration report says:

- “Vision remains the system of record for document/job persistence.”

Evidence:
- `docs/migration/vision-integration-report.md`

That upstream source repo is:
- `/opt/vulpine-vision`

Its API routes live in:
- `/opt/vulpine-vision/app/api/projects/route.ts`
- `/opt/vulpine-vision/app/api/uploads/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/process/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/approve-unit-mix/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/resolve/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/export/route.ts`
- `/opt/vulpine-vision/app/api/workbook/route.ts`
- `/opt/vulpine-vision/app/api/integrations/leads/handoff/route.ts`

---

## Current Runtime Workflow

## Actual implemented workflow today

### Backoffice path

User path today:

1. Visit `/bids/vision`
2. Create Vision project
3. Upload PDF / ZIP / XLSX / CSV evidence
4. Backoffice proxies request to upstream Vision API
5. Upstream stores files in file-backed storage
6. Upstream creates job JSON + project JSON
7. User clicks Process
8. Upstream parses workbook and PDFs
9. Upstream classifies PDF pages via keyword heuristics
10. Workflow advances to `unit_mix_review_required`
11. QA issues remain blocking
12. `safeToSend` remains false
13. No takeoff, no SKU mapping, no pricing, no export allowed through backoffice

Evidence:
- `apps/backoffice/components/cards/vision-section.tsx`
- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `services/vision/src/service.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`

## Runtime states actually implemented in monorepo Vision

Monorepo Vision states:
- `created`
- `files_ingested`
- `workbook_ingested`
- `pages_classified`
- `unit_mix_drafted`
- `unit_mix_review_required`
- `failed`

Evidence:
- `services/vision/src/types.ts`
- `services/vision/src/workflow.ts`

Standalone Vision has additional type-level states declared:
- `takeoff_drafted`
- `sku_mapping_required`
- `pricing_ready`
- `bid_review_required`
- `safe_to_send`

But active workflow service does **not** reach them.

Evidence:
- `/opt/vulpine-vision/types/workflow.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`

---

## Capability Matrix

| Capability | Status | Evidence |
| --- | --- | --- |
| Backoffice Vision UI exists | WORKING | `apps/backoffice/app/bids/vision/page.tsx`, `apps/backoffice/components/cards/vision-section.tsx` |
| Create Vision project | WORKING | `apps/backoffice/lib/vision-proxy.ts`, `services/vision/src/repositories.ts`, `/opt/vulpine-vision/app/api/projects/route.ts` |
| Upload PDFs | WORKING | `services/vision/src/ingestion.ts`, `/opt/vulpine-vision/lib/autobidder/services/upload-ingestion.ts` |
| Upload ZIPs with nested supported files | WORKING | `services/vision/src/parsers.ts`, `services/vision/tests/zip.test.ts`, `/opt/vulpine-vision/tests/phase-zero-routes.integration.test.ts` |
| Upload XLSX / CSV workbook | WORKING | `services/vision/src/ingestion.ts`, `services/vision/src/parsers.ts`, `/opt/vulpine-vision/lib/autobidder/services/workbook-parser.ts` |
| Upload legacy `.xls` | STANDALONE ONLY / NOT IN BACKOFFICE SERVICE | standalone accepts `.xls` in `/opt/vulpine-vision/lib/autobidder/services/upload-ingestion.ts`; monorepo Vision only allows `.xlsx` and `.csv` in `services/vision/src/ingestion.ts` |
| File-backed persistence | WORKING | `services/vision/src/storage.ts`, `/opt/vulpine-vision/lib/autobidder/storage/file-store.ts` |
| Checksummed uploads | WORKING in monorepo extracted service | `services/vision/src/ingestion.ts` stores `sha256`; standalone `types/project.ts` does not show checksum in base type |
| PDF parsing | WORKING | `services/vision/src/parsers.ts`, `/opt/vulpine-vision/lib/autobidder/services/pdf-service.ts` |
| PDF processing as text extraction | WORKING | uses `pdfjs-dist` text extraction |
| PDF processing as vectors | NOT IMPLEMENTED in Vision | no vector parsing in `services/vision/src/parsers.ts` or `/opt/vulpine-vision/lib/autobidder/services/pdf-service.ts` |
| PDF raster/image analysis | NOT IMPLEMENTED in active Vision workflow | no page raster pipeline in active service |
| OCR in Vision runtime | NOT IMPLEMENTED | monorepo Vision has no OCR path; standalone health explicitly says takeoff/pricing/export false; PDF route is text-only |
| Page classification | PARTIAL | keyword heuristics only in `services/vision/src/parsers.ts` and `/opt/vulpine-vision/lib/autobidder/services/pdf-service.ts` |
| Relevant sheet identification | PARTIAL | heuristic page classification only |
| Unit type identification | STUBBED / TYPE-ONLY in active Vision | workflow stops before generation; `unitMix = []` |
| Unit count reconciliation | NOT IMPLEMENTED | no code performing counts in active Vision |
| Cabinet detection from drawings | NOT IMPLEMENTED in active Vision | no geometry / CV pipeline |
| Cabinet symbol recognition | NOT IMPLEMENTED | no symbol model or vector matcher found |
| Dimension extraction from plans | NOT IMPLEMENTED in active Vision | only regex on extracted text in Auto Bid extraction, not Vision |
| Base / wall / tall / vanity distinction | NOT IMPLEMENTED in active Vision | no generated takeoff rows |
| Dimension normalization to available sizes | NOT IMPLEMENTED in active Vision | no normalization module active |
| SKU mapping | BLOCKED / NOT IMPLEMENTED in active Vision | blocked in proxy and workflow |
| Quantity rollup | NOT IMPLEMENTED in active Vision | no takeoff rows generated |
| Source page linkage | WORKING for classified pages and workbook rows | `ClassifiedPage`, `WorkbookRecord`, source file/sheet/row/page fields |
| Confidence scoring | PARTIAL | heuristic confidence values attached to classified pages only |
| Exception review | STUBBED / BLOCKED in active Vision | routes exist in standalone, blocked in workflow; backoffice blocks mutation |
| Human correction persistence | STUBBED route, disabled behavior | `/opt/vulpine-vision/app/api/jobs/[id]/resolve/route.ts`, workflow throws disabled |
| Export results | UI/route exists in standalone, blocked in practice | `/opt/vulpine-vision/app/api/jobs/[id]/export/route.ts` requires `safeToSend`; impossible under quarantine |
| Feed estimate/quote/bid | NOT IMPLEMENTED in active Vision | no successful takeoff→pricing→export path |
| Leads handoff | WORKING | backoffice handoff proxy + standalone `POST /api/integrations/leads/handoff` |
| Chat / voice assistant | WORKING as separate assistant feature, not takeoff intelligence | `/opt/vulpine-vision/app/api/chat/*`, `lib/autobidder/services/llm-service.ts` |

---

## Cabinet Intelligence Inventory

## Active Vision runtime

### Deterministic rules actually active today

In active Vision, cabinet-specific logic is extremely limited.

Implemented deterministic logic:
- workbook column heuristics for `sku`, `cabinet_code`, `description`, `unit_cost`
- page classification keyword heuristics such as:
  - `unit matrix`
  - `unit mix`
  - `casework schedule`
  - `finish schedule`
  - `unit plan`
  - `floor plan`

Evidence:
- `services/vision/src/parsers.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workbook-parser.ts`
- `/opt/vulpine-vision/lib/autobidder/services/pdf-service.ts`

### Active cabinet intelligence status

The active Vision runtime does **not** currently implement deterministic cabinet intelligence for:
- base cabinets
- wall cabinets
- tall cabinets
- pantry cabinets
- vanity cabinets
- sink bases
- drawer bases
- ADA cabinets
- fillers
- panels
- toe kick
- molding
- accessories
- hardware takeoff
- appliance openings
- dishwasher exclusions
- width normalization
- height normalization
- framed vs frameless
- plywood vs particle board
- finish/style selection
- cabinet family rollup

Reason:
- `unitMix`, `takeoffRows`, `skuMappings`, and `pricingLines` are forcibly empty in active workflow
- quarantined estimator logic is explicitly disabled

Evidence:
- `services/vision/src/quarantine.ts`
- `services/vision/src/service.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`
- `/opt/vulpine-vision/docs/CABINET_INTELLIGENCE_AUDIT.md`

## Type-level / schema-only cabinet structures

Standalone Vision declares models for future capability:
- `UnitMix`
- `CabinetObservation`
- `SkuMapping`
- `PricingLine`
- `ManualOverride`

Evidence:
- `/opt/vulpine-vision/types/cabinet.ts`

These are **shape definitions**, not proof of implemented estimator logic.

## Legacy / prototype estimator logic

The legacy prototype under:
- `/opt/vulpine-vision/legacy/vite-prototype/server.ts`

contained mocked or dangerous logic including:
- random page classification
- hardcoded takeoff rows
- hardcoded unit mix
- synthetic totals
- partial deterministic SKU lookup layered on mocked upstream data

The repo’s own cabinet intelligence audit labels this logic:
- `MOCKED`
- `DANGEROUS`
- `PARTIAL`
- `UNVERIFIED`

Evidence:
- `/opt/vulpine-vision/docs/CABINET_INTELLIGENCE_AUDIT.md`

## Separate Auto Bid engine cabinet logic

The **Python Auto Bid engine** contains more real domain-specific patterns, including regex extraction for:
- `base`
- `wall`
- `tall`
- `pantry`
- `vanity`
- `closet`
- `island`
- room labels
- unit type patterns
- floor-level patterns
- dimension regexes

Evidence:
- `services/engine/services/auto_bid/extraction.py`

But this is **not** the active Vision runtime used by backoffice `/bids/vision`.

### Cabinet intelligence location summary

- **Deterministic rules active now:** workbook parsing + page keyword classification only
- **AI prompts active now for takeoff:** none
- **Database data active for takeoff:** none in active Vision runtime
- **Hardcoded values:** only heuristic keywords / quarantine conditions / upload limits
- **User configuration:** none for cabinet rules

---

## Catalog / SKU Architecture

## Vision today

Current Vision is **not catalog-agnostic in any meaningful production-ready way**, because it does not perform live takeoff-to-catalog mapping today.

What it does have:
- workbook ingestion with traceability
- workbook row parsing into cabinet records
- source workbook / source sheet / source row persistence

Evidence:
- `services/vision/src/parsers.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workbook-parser.ts`

What it does **not** have active today:
- tenant → manufacturer → catalog → product line → matching rules abstraction
- configured manufacturer-specific mapping profiles
- selectable catalog context in the backoffice Vision UI
- persisted matching rule sets in active Vision JSON model

## Where richer catalog architecture exists

The Auto Bid engine has a real SKU catalog model:
- `sku_catalog`
- `sku_aliases`
- `sku_mappings`
- `sku_mapping_history`

Evidence:
- `services/engine/db/migrations/001_auto_bid.sql`
- `services/engine/services/auto_bid/models.py`
- `services/engine/services/auto_bid/sku_intelli.py`
- `services/engine/services/auto_bid/routes.py`

The SKU catalog supports fields like:
- manufacturer
- product_line
- series
- model
- cabinet_type
- width / height / depth
- finish
- hardware_included
- unit_cost
- lead_time_days
- freight_class

Evidence:
- `services/engine/services/auto_bid/routes.py`
- `services/engine/services/auto_bid/models.py`

## Classification of current architecture

For the question “Is Vulpine Vision hardcoded to Vulpine / suppliers / configurable / catalog-agnostic?”

### Current answer

- **Active Vision runtime:** **C. partially configurable** at the ingestion level only
- **Auto Bid engine catalog layer:** **C. partially configurable**
- **Neither system today is genuinely catalog-agnostic end-to-end**

Why:
- Workbook ingestion can accept external workbook data without code changes
- But actual takeoff generation + normalization + matching rule abstraction are missing/quarantined
- There is no manufacturer onboarding contract that separates:
  - manufacturer
  - catalog
  - product line
  - matching rules
  - normalization policies

## Can Rythern be onboarded without app-code changes today?

**No**, not as a functional external takeoff engine.

At best, you could:
- upload a Rythern workbook
- preserve rows and source traceability
- classify plan pages heuristically

You could **not** today, without code changes, reliably:
- normalize observed dimensions to Rythern product constraints
- apply manufacturer-specific rules
- produce proposed Rythern SKUs
- review exception mappings in a working approval loop
- export an approved takeoff

---

## AI / Model Architecture

## Active AI calls in Vision

AI in the standalone Vision app is currently tied to **chat/voice assistant features**, not cabinet takeoff generation.

Main AI code:
- `/opt/vulpine-vision/lib/autobidder/services/llm-service.ts`
- `/opt/vulpine-vision/lib/autobidder/services/chat-service.ts`
- `/opt/vulpine-vision/app/api/chat/route.ts`
- `/opt/vulpine-vision/app/api/chat/models/route.ts`
- `/opt/vulpine-vision/app/api/chat/voice/session/route.ts`

Configured provider options include:
- Gemini via `@google/genai`
- OpenAI-compatible endpoints
- MetaMuse
- OpenAI
- xAI
- Anthropic catalog metadata
- DeepSeek metadata
- Mistral metadata
- Ollama Cloud metadata

Evidence:
- `/opt/vulpine-vision/lib/autobidder/env/server-env.ts`
- `/opt/vulpine-vision/lib/autobidder/llm/model-catalog.ts`
- `/opt/vulpine-vision/lib/autobidder/services/llm-service.ts`

## What AI is used for today

### Confirmed active uses
- text chat completion
- voice/realtime session initialization
- model catalog discovery / capability listing

### Not found as active takeoff uses
- no active model call inside Vision `processJob`
- no model call for page classification in active Vision workflow
- no model call for unit mix extraction
- no model call for cabinet detection
- no model call for dimension normalization
- no model call for SKU generation in active Vision workflow

Evidence:
- `services/vision/src/service.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`

## Prompt / system instruction surface

Active prompt surface exists for chat/voice assistant:
- `LLM_SYSTEM_PROMPT`
- `LLM_SYSTEM_PROMPT_FILE`
- default fallback prompt in `llm-service.ts`

Evidence:
- `/opt/vulpine-vision/lib/autobidder/env/server-env.ts`
- `/opt/vulpine-vision/lib/autobidder/services/llm-service.ts`
- `/opt/vulpine-vision/.env.example`

No dedicated estimator/takeoff prompt was found in the active workflow path.

## AI architecture assessment

### Provider dependence
For takeoff intelligence today: **not applicable**, because estimator AI is not active.

For chat/voice: there is multi-provider scaffolding, but practical default behavior depends on env config and fallback chains. It is not obviously tied to one single provider in code.

### Correct task split for future product
Based on current architecture and safety requirements:

- **Deterministic code:**
  - pricing arithmetic
  - catalog lookups
  - normalization rules
  - required-field validation
  - export generation
  - state transitions

- **AI reasoning:**
  - ambiguous schedule interpretation
  - sheet relevance triage
  - note summarization
  - probable room/cabinet inference from weak evidence

- **Computer vision / geometry:**
  - detecting cabinets from drawings/elevations when text is insufficient
  - extracting symbols / dimension lines
  - associating cabinets with rooms/views

- **Human review:**
  - unresolved dimensions
  - catalog edge cases
  - substitutions
  - unit repetition conflicts
  - low-confidence cases

That split is broadly aligned with the deterministic pricing in Auto Bid (`pricing.py`) and the stated quarantine posture.

---

## Database & Persistence

## Active Vision persistence

### Monorepo Vision service
Persistence is file-backed under `VISION_DATA_DIR` (or `.data/vision` by default):

- `projects/*.json`
- `jobs/*.json`
- `uploads/...`

Evidence:
- `services/vision/src/storage.ts`
- `services/vision/src/repositories.ts`

### Standalone Vision app
Persistence is file-backed under `AUTOBIDDER_DATA_DIR` (default `.data/autobidder` locally or `/tmp/autobidder` on Vercel):

- `projects/*.json`
- `jobs/*.json`
- `uploads/...`

Evidence:
- `/opt/vulpine-vision/lib/autobidder/storage/file-store.ts`
- `/opt/vulpine-vision/lib/autobidder/repositories/project-repository.ts`
- `/opt/vulpine-vision/lib/autobidder/repositories/bid-job-repository.ts`

## Relational persistence already exists elsewhere

The Auto Bid engine has a much stronger relational model in PostgreSQL for:
- project stages
- document pages
- extracted evidence
- schedules
- plan intelligence objects
- cabinet requirements
- BOM versions / lines
- SKU catalog / aliases / mappings
- exception queue
- review decisions
- value engineering decisions
- pricing versions / lines
- QA runs / findings
- proposal versions
- audit events

Evidence:
- `services/engine/db/migrations/001_auto_bid.sql`
- `services/engine/services/auto_bid/models.py`

## Key persistence conclusion

The current active Vision runtime is **not using relational persistence for takeoff state**. It stores job manifests and partial evidence in JSON files. That is acceptable for ingestion experiments, but weak for SaaS productization.

---

## File / PDF Processing

## Upload storage

Uploaded files are stored under `uploads/<project>/<uuid>_<basename>`.

Evidence:
- `services/vision/src/ingestion.ts`
- `/opt/vulpine-vision/lib/autobidder/services/upload-ingestion.ts`

## Supported file types

### Monorepo Vision extracted service
- PDF
- ZIP
- XLSX
- CSV

Evidence:
- `services/vision/src/ingestion.ts`
- `services/vision/src/parsers.ts`

### Standalone Vision
- PDF
- ZIP
- XLSX
- XLS
- CSV

Evidence:
- `/opt/vulpine-vision/lib/autobidder/services/upload-ingestion.ts`

## ZIP handling

ZIP handling is one of the stronger reusable components.

Verified behavior:
- supports nested directories
- ignores unrelated files
- blocks path traversal
- requires at least one PDF inside ZIP
- enforces limits on supported file count / expanded bytes

Evidence:
- `services/vision/src/parsers.ts`
- `services/vision/tests/zip.test.ts`
- `/opt/vulpine-vision/tests/phase-zero-routes.integration.test.ts`

## PDF parsing behavior

### What it does
- uses `pdfjs-dist`
- loads PDF document
- iterates pages
- extracts text content
- concatenates text strings
- applies keyword heuristics

Evidence:
- `services/vision/src/parsers.ts`
- `/opt/vulpine-vision/lib/autobidder/services/pdf-service.ts`

### What it does not do
- no vector geometry extraction in active Vision
- no symbol detection
- no OCR pipeline in active Vision workflow
- no page image raster pipeline for takeoff
- no measurement extraction from drawing geometry

## Workbook parsing behavior

### What it does
- reads workbook with `xlsx`
- discovers sheets and columns
- maps loose column names to SKU, cabinet code, description, cost
- preserves source workbook / sheet / row provenance

Evidence:
- `services/vision/src/parsers.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workbook-parser.ts`
- `/opt/vulpine-vision/app/api/workbook/route.ts`

### What it does not do
- no strict supplier schema contract
- no manufacturer profile system
- no workbook validation against catalog templates beyond basic parseability

---

## Human Review Workflow

## Current actual state

Human review is **not operational** in the active Vision workflow.

What exists:
- workflow stops at `unit_mix_review_required`
- QA critical issues are populated
- blocked routes exist for:
  - approve unit mix
  - resolve mapping
  - export

Evidence:
- `services/vision/src/service.ts`
- `services/vision/src/quarantine.ts`
- `apps/backoffice/lib/vision-proxy.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/approve-unit-mix/route.ts`
- `/opt/vulpine-vision/app/api/jobs/[id]/resolve/route.ts`

What does not exist in active runtime:
- editable unit mix review UI
- approved unit mix persistence that advances workflow
- exception queue UI with working resolution path
- approval history stored in a relational audit log for Vision

### Manual corrections persisted?

**No, not in active Vision behavior.**

Standalone types define `ManualOverride`, and routes exist, but workflow service throws `ESTIMATOR_INTELLIGENCE_DISABLED`.

Evidence:
- `/opt/vulpine-vision/types/cabinet.ts`
- `/opt/vulpine-vision/lib/autobidder/services/workflow-service.ts`

---

## Export / Estimating Integration

## Active Vision

Backoffice blocks export proxy paths pre-upstream.

Evidence:
- `apps/backoffice/lib/vision-proxy.ts`
- `tests/vision-proxy.test.ts`

Standalone export route exists:
- `/opt/vulpine-vision/app/api/jobs/[id]/export/route.ts`

But export requires `job.qaResult.safeToSend == true`, and the quarantine forces it false.

So export is **present in code but unreachable in real approved workflow**.

Status: **UI/route exists, functionally blocked**.

## Auto Bid engine

The Auto Bid engine has much more real estimating architecture:
- BOM versions
- SKU mappings
- pricing versions
- proposal versions
- exception review
- audit trail

Evidence:
- `services/engine/services/auto_bid/routes.py`
- `services/engine/services/auto_bid/models.py`
- `services/engine/services/auto_bid/pricing.py`
- `services/engine/services/auto_bid/proposal.py`

This is the stronger future estimating/export foundation than current Vision.

---

## Authentication & Security

## Backoffice auth

Backoffice uses NextAuth + Zitadel.

Evidence:
- `apps/backoffice/lib/auth.ts`
- `apps/backoffice/app/api/auth/[...nextauth]/route.ts`
- `packages/auth`
- `packages/permissions`

Backoffice capability gating relevant to Vision:
- `vision.read`
- `vision.write`
- `crm.write` for handoff

Evidence:
- `packages/permissions/src/index.ts`
- `apps/backoffice/lib/backoffice-access.ts`

## Server-to-server auth

Backoffice → Vision API uses:
- `VISION_API_URL`
- `VISION_API_TOKEN`
- header `x-vulpine-integration-key`

Leads handoff uses:
- `VISION_INTEGRATION_KEY` on backoffice side
- `LEADS_INTEGRATION_KEY` / `x-integration-key` on standalone Vision side

Evidence:
- `packages/config/src/index.ts`
- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `apps/backoffice/app/api/integrations/vision/handoff/route.ts`
- `/opt/vulpine-vision/lib/platform/integration-auth.ts`
- `/opt/vulpine-vision/.env.example`

## File access and storage security

### Positives
- monorepo Vision storage has path traversal protection via `safePath`
- service test verifies path traversal rejection
- ZIP extraction rejects unsafe entry paths

Evidence:
- `services/vision/src/storage.ts`
- `services/vision/tests/storage.test.ts`
- `services/vision/src/parsers.ts`
- `/opt/vulpine-vision/tests/phase-zero-routes.integration.test.ts`

### Risks
- file-backed JSON persistence is per-app storage, not tenant-isolated storage
- no signed URL system found
- no row-level tenant isolation in active Vision persistence
- no configurable document retention policy found
- no explicit storage quota enforcement per tenant/org found

## Uploaded-document confidentiality risks

Main risks for external SaaS use:
- file-backed projects/jobs/uploads with no tenant partitioning beyond project path
- no strong project/org boundary in active Vision JSON storage
- no encryption/retention lifecycle found in code reviewed
- no audit log for document access inside active Vision runtime
- standalone loopback bypass in `withVisionIntegration()` allows unauthenticated local loopback access by design

Evidence:
- `/opt/vulpine-vision/lib/platform/integration-auth.ts`
- `services/vision/src/storage.ts`
- `/opt/vulpine-vision/lib/autobidder/storage/file-store.ts`

## Secret/config locations (names only)

Backoffice / platform:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `ZITADEL_ISSUER`
- `ZITADEL_CLIENT_ID`
- `ZITADEL_CLIENT_SECRET`
- `ZITADEL_AUDIENCE`
- `VISION_API_URL`
- `VISION_API_TOKEN`
- `VISION_INTEGRATION_KEY`
- `BIDS_TRACKER_API_URL`
- `BIDS_TRACKER_API_TOKEN`

Standalone Vision:
- `GEMINI_API_KEY`
- `LLM_API_KEY`
- `OPENAI_API_KEY`
- `METAMUSE_API_KEY`
- `XAI_API_KEY`
- `OLLAMA_API_KEY`
- `VISION_API_TOKEN`
- `LEADS_INTEGRATION_KEY`
- `LLM_SYSTEM_PROMPT`
- `LLM_SYSTEM_PROMPT_FILE`
- `AUTOBIDDER_DATA_DIR`

Evidence:
- `packages/config/src/index.ts`
- `/opt/vulpine-vision/.env.example`
- `/opt/vulpine-vision/lib/autobidder/env/server-env.ts`

---

## SaaS / Multi-Tenant Readiness

## What already exists and is reusable

### Organizations / identity signals
Backoffice auth normalizes Zitadel project/org claims and stores organization info in session context.

Evidence:
- `apps/backoffice/lib/auth.ts`

### Role/capability model
Reusable role model exists:
- admin
- executive
- finance
- operations
- estimator
- sales
- nbc

Evidence:
- `packages/permissions/src/index.ts`

### Projects domain
A project concept exists in both Vision and Auto Bid.

Evidence:
- `services/vision/src/repositories.ts`
- `/opt/vulpine-vision/types/project.ts`
- `services/engine/services/auto_bid/models.py`

### Products/SKUs domain
Reusable SKU catalog exists in Auto Bid engine.

Evidence:
- `services/engine/services/auto_bid/models.py`
- `services/engine/services/auto_bid/routes.py`

## What does not exist yet for SaaS productization

Missing or incomplete for real external SaaS:
- tenant isolation in Vision persistence
- org-scoped storage containers
- customer-specific catalogs in active Vision runtime
- manufacturer-specific rule sets
- usage tracking for model/API/storage operations
- billing/subscription system
- plan limits / quotas
- storage quotas
- per-tenant audit logs for takeoff workflow
- API keys for external customers

Backoffice currently contains **billing placeholders**, not an implemented subscription system.

Evidence:
- `apps/backoffice/components/cards/vulpine-command-center.tsx`
- `apps/backoffice/components/cards/financial-analytics-dashboard.tsx`

## SaaS readiness conclusion

Current architecture supports:
- authenticated internal operator workflows,
- project concepts,
- permissions,
- some org identity data,
- and a reusable SKU catalog domain in Auto Bid.

It does **not** yet support external SaaS-grade tenant isolation and billing.

---

## Productization Gap Analysis

Target flow:

`User creates project → uploads 300–500 page architectural plan set → system indexes document → identifies relevant sheets → identifies unit types → reconciles unit counts → extracts cabinet requirements → determines cabinet type/dimensions → applies deterministic normalization rules → maps requirements against selected manufacturer catalog → produces proposed SKUs → provides quantity rollup → links every result to source sheet/page → flags ambiguity → human reviews exceptions → approved takeoff is exported to XLSX/CSV → optional pricing/estimating layer`

### Requirement-by-requirement status

| Requirement | Status | Why |
| --- | --- | --- |
| Create project | READY | Implemented in Vision backoffice + standalone API |
| Upload large plan set | PARTIALLY READY | Upload pipeline exists; 300–500 page scale not disproven, but no proof of production performance beyond route tests |
| Index document | READY | files persisted; PDFs parsed; page counts stored |
| Identify relevant sheets | PARTIALLY READY | keyword page classification only |
| Identify unit types | MISSING | no active extraction |
| Reconcile unit counts | MISSING | no active logic |
| Extract cabinet requirements | MISSING in active Vision | only future structures/types; Auto Bid has partial regex extraction |
| Determine cabinet type/dimensions | MISSING in active Vision | no cabinet CV/vector pipeline |
| Deterministic normalization rules | MISSING | no active normalization engine |
| Map to selected manufacturer catalog | BLOCKED BY ARCHITECTURE | no runtime catalog-selection / rule layer in Vision |
| Produce proposed SKUs | MISSING in active Vision | no active SKU mapping in Vision |
| Quantity rollup | MISSING | no takeoff rows |
| Link result to source page | PARTIALLY READY | source page/file provenance exists for pages and workbook rows, but not for generated takeoff because none exists |
| Flag ambiguity | PARTIALLY READY | QA/critical issues exist, but not estimator-grade ambiguity handling |
| Human review exceptions | PARTIALLY READY / BLOCKED | route shapes exist; actual behavior disabled |
| Export XLSX/CSV | BLOCKED | export route exists standalone but impossible under quarantine |
| Optional pricing layer | READY in Auto Bid engine, MISSING in Vision | deterministic pricing exists in Python engine, not wired to Vision |

---

## Vulpine-Specific Coupling

## Vulpine-specific coupling found

- Naming / branding in UI and docs (`Vulpine`, `Vulpine Command Center`, `Vulpine Cabinet AutoBidder`)
- Backoffice permissions are Vulpine-role-oriented
- Leads handoff assumes Vulpine CRM context
- Some copy assumes cabinet-supplier business model
- Auto Bid proposal defaults embed Vulpine-specific output terms / warranties

Evidence:
- `apps/backoffice/components/cards/vision-section.tsx`
- `/opt/vulpine-vision/app/page.tsx`
- `packages/permissions/src/index.ts`
- `services/engine/services/auto_bid/proposal.py`

## Generic takeoff infrastructure already reusable

- file ingestion + ZIP safety
- PDF text extraction
- workbook parsing + provenance
- workflow state machine shells
- API contracts / correlation IDs
- auth / permission packages
- relational SKU catalog + pricing engine in Auto Bid

## Shared infra already reusable

- Zitadel-backed auth scaffolding
- capability-based gating
- Next.js backoffice shell
- SDK / contracts package
- FastAPI engine + PostgreSQL stack

---

## Reusable Components

Strongest reusable components right now:

1. **Upload + ZIP safety layer**
   - `services/vision/src/ingestion.ts`
   - `services/vision/src/parsers.ts`
   - `services/vision/tests/zip.test.ts`
   - `/opt/vulpine-vision/lib/autobidder/services/upload-ingestion.ts`

2. **File-backed project/job persistence for prototyping**
   - `services/vision/src/storage.ts`
   - `services/vision/src/repositories.ts`

3. **Workbook traceability**
   - `services/vision/src/parsers.ts`
   - `/opt/vulpine-vision/lib/autobidder/services/workbook-parser.ts`

4. **Backoffice proxy boundary + auth capability checks**
   - `apps/backoffice/app/api/vision/[...path]/route.ts`
   - `apps/backoffice/lib/vision-proxy.ts`
   - `packages/permissions/src/index.ts`
   - `apps/backoffice/lib/auth.ts`

5. **Auto Bid relational domain + deterministic pricing**
   - `services/engine/db/migrations/001_auto_bid.sql`
   - `services/engine/services/auto_bid/models.py`
   - `services/engine/services/auto_bid/pricing.py`
   - `services/engine/services/auto_bid/sku_intelli.py`

---

## Missing Components

Major missing components for InteriorFinishes.ai:

- true cabinet takeoff extraction engine
- plan geometry / vector understanding
- OCR fallback in active workflow
- unit repetition / unit-mix reconciliation engine
- deterministic normalization rules by manufacturer/product line
- configurable manufacturer onboarding model
- active exception resolution workflow
- approved takeoff export path
- tenantized storage / DB boundaries
- billing / quotas / usage metering
- trustworthy human-review UI for estimator operations

---

## Technical Debt / Risks

1. **Vision name collision / architecture confusion**
   - “Vulpine Vision” currently refers to multiple things:
     - backoffice shell section
     - monorepo extracted service
     - standalone upstream app
     - historical estimator prototype
   - This creates product and engineering ambiguity.

2. **Quarantine means there is no working estimator engine today**
   - safest choice was made, but product claims must reflect it.

3. **File-backed persistence is weak for SaaS**
   - good for controlled internal tests, poor for external isolation / auditability.

4. **Standalone route surface exceeds active safe capabilities**
   - export / approve / resolve routes exist, but are blocked by logic.
   - creates false impression of completeness.

5. **Auto Bid and Vision are split across two architectures**
   - Vision has better ingestion shell
   - Auto Bid has better estimating data model
   - current product path is fragmented.

6. **No verified cabinet intelligence corpus yet**
   - `GOLDEN_BID_SPEC.md` explicitly says Golden Bid corpus is required.

Evidence:
- `/opt/vulpine-vision/docs/GOLDEN_BID_SPEC.md`

---

## Recommended Extraction Boundary

## Best clean boundary from reality

Do **not** extract current Vision as-is and pretend it is the takeoff engine.

Cleanest practical boundary:

### VULPINE-SPECIFIC
- backoffice shell and cards
- internal CRM handoff workflows
- Vulpine role naming and commercial workflows
- internal command center navigation

### GENERIC TAKEOFF INTELLIGENCE
- document ingestion
- page analysis
- evidence extraction
- unit mix reconciliation
- cabinet observation model
- normalization engine
- SKU matching engine
- exception queue
- review/approval workflow
- export layer

### SHARED INFRASTRUCTURE
- auth / org claims
- permissions
- contracts / SDK
- storage abstraction
- PostgreSQL models
- audit logging
- model access wrappers

## Recommendation

The takeoff intelligence should become a **shared SNRG Labs service** consumed by:
- Vulpine backoffice
- future external SaaS tenants

But that shared service should be built by combining:
- Vision’s ingestion shell patterns
- Auto Bid’s relational domain model
- a new estimator core replacing the quarantined logic

Not by lifting the current standalone Vision estimator code.

---

## Proposed InteriorFinishes.ai Architecture

Based on the code that actually exists, a realistic future split is:

```text
apps/
  backoffice                 # internal Vulpine operator app
  interiorfinishes-web       # external SaaS UI

services/
  takeoff-engine             # extraction, evidence, unit mix, review state
  catalog-engine             # manufacturers, catalogs, product lines, rules
  pricing-engine             # deterministic pricing / landed cost / quoting
  document-ingestion         # file ingest, parsing, OCR, page metadata

packages/
  auth                       # Zitadel / org auth patterns
  permissions                # capabilities / roles
  contracts                  # API schemas and envelopes
  sdk                        # clients
  types                      # shared TS types
  cabinet-domain             # cabinet/finish domain models
  catalog-types              # manufacturer/catalog schemas
  storage                    # signed access / object store interface
```

If Python remains preferred for estimating, equivalent service split can stay in Python for engine components while the web layers remain Next.js.

---

## Minimum Path to First External Pilot

To allow **one external manufacturer** to upload a plan set, use its own catalog, review the generated SKU takeoff, and export the result, minimum work is:

1. Move project/job/evidence persistence from file-backed JSON into relational storage.
2. Add manufacturer / catalog / product line entities and binding to a project.
3. Implement deterministic unit-mix + takeoff + normalization flow.
4. Reuse or extend Auto Bid SKU catalog + pricing tables instead of inventing a second catalog model.
5. Build a working exception-review UI with persisted approvals/overrides.
6. Enable export only after review and deterministic QA gates.
7. Add tenant/org isolation for projects, uploads, catalogs, and review decisions.
8. Add audit logging for every manual override.
9. Add OCR / image/vector extraction path for plan sheets where text extraction is insufficient.
10. Keep LLMs advisory only for ambiguous interpretation, never arithmetic or invented SKUs.

---

## Files That Would Need Modification

Primary files that would likely need modification in the next implementation phase:

### Backoffice / web
- `apps/backoffice/components/cards/vision-section.tsx`
- `apps/backoffice/lib/vision-proxy.ts`
- `apps/backoffice/app/api/vision/[...path]/route.ts`
- `packages/sdk/src/index.ts`
- `packages/contracts/src/*`

### Vision / ingestion service
- `services/vision/src/types.ts`
- `services/vision/src/service.ts`
- `services/vision/src/parsers.ts`
- `services/vision/src/repositories.ts`
- `services/vision/src/storage.ts`

### Auto Bid / engine side
- `services/engine/services/auto_bid/extraction.py`
- `services/engine/services/auto_bid/sku_intelli.py`
- `services/engine/services/auto_bid/pricing.py`
- `services/engine/services/auto_bid/routes.py`
- `services/engine/services/auto_bid/models.py`

### New domain layer needed
- new catalog abstraction package/service
- new normalization rules package/service
- new review/approval service

---

## Files That Should NOT Be Modified

Do not modify during productization bootstrap without explicit reason:

- `legacy/vite-prototype/*` under `/opt/vulpine-vision` — historical / quarantined prototype
- standalone production config / deployed secrets
- production auth tenant configuration unless required
- existing `vulpine-bids-tracker` runtime code unless intentionally migrating it
- unrelated Vulpine Drive / Leads production behavior
- migration audit docs that exist as historical record

Specific caution files:
- `/opt/vulpine-vision/legacy/vite-prototype/server.ts`
- `/opt/vulpine-platform/docs/migration/vision-integration-report.md`
- `/opt/vulpine-platform/docs/architecture/current-system-map.md`

---

## Recommended Next Implementation Sequence

1. **Choose canonical engine boundary**
   - Decide that takeoff intelligence lives in shared service, not in UI.

2. **Unify data model**
   - Use Auto Bid relational schema as base for project/evidence/SKU/pricing/review.

3. **Replace file-backed Vision persistence**
   - Keep ingestion behavior, change persistence target.

4. **Implement evidence-first preflight**
   - sheet detection, OCR fallback, page metadata, source traceability.

5. **Implement deterministic unit-mix + takeoff core**
   - no LLM arithmetic, no invented SKUs.

6. **Implement catalog abstraction**
   - tenant → manufacturer → catalog → product line → SKU library → rule set.

7. **Implement review queue**
   - exception resolution, approvals, audit trail.

8. **Implement export**
   - CSV/XLSX only after QA pass.

9. **Implement tenant isolation + quotas**
   - before broad external rollout.

10. **Add AI selectively**
   - only where ambiguity exists and outputs are reviewable.

---

## CURRENT REALITY

Vulpine Vision can genuinely do **three** real things today:

1. **Ingest and persist source files**
   - PDF plans
   - ZIP bundles
   - XLSX/CSV workbooks

2. **Extract deterministic metadata/evidence**
   - workbook rows with source traceability
   - PDF text and heuristic page classifications
   - page counts and workflow state

3. **Stop safely before estimator judgment**
   - no live takeoff
   - no live SKU mapping
   - no live pricing
   - no safe-to-send approval
   - no usable export path

It is currently a **quarantined intake and evidence pipeline**, not a production cabinetry takeoff engine.

---

## FIRST EXTERNAL PILOT

Minimum engineering work required for one external manufacturer pilot:

- replace file-backed Vision persistence with relational project/evidence storage
- bind each project to a selected manufacturer/catalog/product line
- implement deterministic cabinet observation + unit repetition + normalization logic
- reuse Auto Bid SKU catalog and matching/history tables
- implement exception review / human override persistence
- implement approved export to CSV/XLSX
- add org/tenant storage isolation and auth boundaries
- add document confidentiality controls and retention policy

If that work is done, the first pilot shape is realistic:
- one external manufacturer
- one catalog family
- one estimator review queue
- one export format
- one controlled tenant

Without that work, external pilot claims would be fake.
