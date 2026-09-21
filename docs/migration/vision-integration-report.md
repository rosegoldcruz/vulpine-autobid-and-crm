# Vision integration report

## CURRENT VISION STATE

- Source snapshot: `/opt/vulpine-vision` at commit `e50923c8ac5554a0bea03fd5cf6c3548544ffc1f`.
- The standalone source already contained user-owned uncommitted AEON/chat/voice, handoff, validation, UI, and test changes. Its dirty manifest hash was `8d57223520102c9a5f517c0b40cf4b8f90c0e0c3e0bff389da31b172e7c7c1f6` before and after verification.
- The source was audited through a temporary copy excluding `.git`, `.next`, `node_modules`, environment files, and runtime data. No source files were modified by consolidation.
- Standalone validation remains healthy: 6 Vitest files / 19 tests pass, TypeScript lint passes, and the Next 15 production build passes.

## CONTRACTS PROMOTED

- `packages/contracts/src/leads-vision.ts` is the canonical Leads → Vision v1 contract.
- It owns request, handoff-context, file, project-manifest, and response schemas/types; `x-integration-key`; source-system default; correlation ID shape; and compatibility exports for the two standalone implementations.
- Root contract tests cover defaults, the auth header, request compatibility, response shape, and correlation behavior.
- The Backoffice Leads-side handoff consumer validates both outbound input and inbound Vision response against the shared schema. The standalone `/opt/vulpine-leads` snapshot was not changed or coupled to this filesystem.

## SERVICES/VISION CREATED

- `@vulpine/vision-service` is a workspace-owned, server-only package.
- Extracted responsibilities: safe file storage, project/job repositories, PDF text/metadata parsing, workbook source traceability, ZIP traversal defense, checksummed upload ingestion, workflow transitions, and Leads handoff construction.
- Upload policy: PDF, ZIP, XLSX, and CSV only; 100 files maximum; 250 MB PDF/ZIP limit; 50 MB workbook limit; 2 GB batch limit.
- The package is framework-neutral: no Next route handlers, browser state, or deployment assumptions.
- Valérie/AEON chat and voice are not copied. They remain in the standalone service until they can move to the single shared platform agent runtime.

## BACKOFFICE ROUTE CREATED

- `/bids/vision` mounts a native module inside the existing Vulpine Command Center shell.
- The UI uses `@vulpine/sdk` for create, upload, process, and refresh. It never calls the standalone host directly and contains no iframe or external Vision link.
- The module includes source-file, PDF, workbook, page, workflow, QA, and safe-to-send KPIs; traceable document rows; a persistent quarantine banner; responsive desktop/mobile layouts; and Sonner feedback for create, upload, process, refresh, and reset.
- Existing Bids Tracker save, add, delete, and reset actions already emit success/error toasts.

## AUTH STATUS

- Page access requires `vision.read` when ZITADEL is configured.
- Mutating proxy routes require `vision.write`; job reads require `vision.read`; the Leads handoff proxy requires `crm.write`.
- Authentication fails closed. With missing ZITADEL variables, shell preview remains visible for local development, but all API operations return `AUTH_NOT_CONFIGURED`.
- Upstream credentials stay server-side in `VISION_API_TOKEN` and `VISION_INTEGRATION_KEY`; browser code receives neither.

## API STATUS

- Backoffice proxy: `/api/vision/[...path]`.
- Allowed upstream operations: `POST projects`, `POST uploads`, `GET jobs/:id`, and `POST jobs/:id/process`.
- The proxy enforces capability checks, absolute HTTP(S) upstream configuration, correlation IDs, project headers, server-owned integration credentials, no-store fetches, and canonical platform response envelopes.
- Leads consumer: `POST /api/integrations/vision/handoff`, with canonical request/response validation and server-owned `x-integration-key`.

## QUARANTINE STATUS

- `safeToSend` is structurally and operationally forced to `false`.
- Unit mix, takeoff rows, SKU mappings, and pricing lines are forced empty after processing.
- Processing stops at `unit_mix_review_required` and adds `SAFE_TO_SEND_QUARANTINED`.
- Approval, resolution, takeoff, pricing, and export operations throw or proxy-return `ESTIMATOR_INTELLIGENCE_DISABLED` before an upstream mutation.
- Regression tests cover both the service invariant and every blocked proxy path.

## FILES CHANGED

- Workspace/package wiring: root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- Preview deployment boundary: root `vercel.json` explicitly builds Backoffice and publishes `apps/backoffice/.next` from the monorepo root; the root manifest pins Next 16 so Vercel's framework detector can identify the monorepo target before running the filtered build.
- Shared packages: `packages/contracts`, `packages/config`, `packages/sdk`.
- Server boundary: `services/vision`.
- Backoffice: Vision route, API proxies, access map, Command Center navigation, and Vision module.
- Verification: root contract/proxy/permission tests, service tests, Playwright config, and Vision browser tests.
- Documentation: this report and the completed next-step marker.

## COMMANDS RUN

```text
corepack pnpm install --frozen-lockfile=false
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter @vulpine/backoffice lint
corepack pnpm --filter @vulpine/backoffice build
corepack pnpm install --frozen-lockfile
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 VISION_SCREENSHOT_DIR=/tmp corepack pnpm test:e2e
npm test                    # /opt/vulpine-vision
npm run lint                # /opt/vulpine-vision
npm run build               # /opt/vulpine-vision
```

## TEST RESULTS

- Monorepo typecheck: pass across packages, Vision service, and Backoffice.
- Root unit/contract suite: 14/14 pass.
- Vision service suite: 4/4 pass.
- Backoffice ESLint: pass.
- Backoffice Next 16 production build: pass; `/bids/vision`, both Vision API routes, and existing routes compiled.
- The previous Vercel preview failure is recorded on commit `99e3321` as deployment `dpl_7kBU5kvoW3j71YKfWYGff92QttYx`. After declaring the monorepo boundary and exposing Next 16 at the workspace root, Vercel reported `Deployment has completed` for commit `feb12d0` on 2026-09-21.
- Playwright browser suite: 2/2 pass using installed Chrome; verified meaningful content, no framework overlay, fail-closed auth, create/upload/process/reset toasts, workflow state, desktop, and 390 px mobile.
- Standalone Vision: 19/19 tests, lint, and production build pass; dirty manifest unchanged.

## KNOWN GAPS

- A deployed Vision API URL and secrets must be configured before live document operations can run through Backoffice.
- The browser success path is contract-mocked because no deployed Vision API or ZITADEL session is available in this workspace; the real fail-closed path is browser-tested.
- The standalone Leads app has not yet switched its import to the monorepo package because it is outside the Git workspace. The monorepo handoff consumer is canonical and ready for that repository migration.
- AEON/chat/voice remains standalone until a shared agent-runtime migration is designed and approved.
- No production traffic, DNS, data copy, or deletion occurred.

## RUNTIME IMPACT

- Current production behavior does not change until the platform revision is deployed and `VISION_API_URL` is configured.
- Once enabled, Backoffice performs server-to-server proxy calls only. Vision remains the system of record for document/job persistence.
- All new network calls are authenticated, non-cacheable, correlation-aware, and restricted to an allowlist.
- The extraction does not activate estimator logic and does not move user data.

## ROLLBACK STATUS

- Rollback is a single platform commit revert plus removal of the three Vision environment variables.
- The standalone Vision source and deployment remain intact and usable because they were neither rewritten nor deleted.
- No irreversible database, storage, traffic, or DNS migration was performed.

## NEXT MODULE

Migrate the standalone Leads UI to consume the promoted `@vulpine/contracts` handoff schema (or publish the package for that repository), then run a real authenticated Leads → Backoffice → Vision integration test against a non-production Vision deployment. AEON/chat/voice should follow only after the shared platform agent runtime boundary exists.
