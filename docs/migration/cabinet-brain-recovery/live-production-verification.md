# Cabinet Brain production verification

Verified on 2026-09-25 against `https://backoffice.vulpine.llc`.

## Release identity

- Production project: `vulpine-autobid-and-crm`
- Vercel project ID: `prj_JzKtvnn3YmjeOGDtCKNMOg3fakR7`
- Production deployment: `dpl_HEUP6ZAVANAEkpYxhdmYFdvvAsbr`
- Deployment URL: `https://vulpine-autobid-and-b0agwptz1-elohim.vercel.app`
- Production alias: `https://backoffice.vulpine.llc`
- Backoffice release commit: `5ff6688`
- Engine release commit: `4cd9f2d`
- Production baseline before integration: `772252751756ef0dece0f9a999a89cc575f94f02`
- Rollback branch: `rollback/backoffice-pre-cabinet-brain-20260925`
- Integration branch: `codex/cabinet-brain-integration-recovery`

Vercel reported the deployment `READY`, with the existing `apps/backoffice` root,
Next.js framework preset, `corepack pnpm install --frozen-lockfile`,
`NODE_ENV=production corepack pnpm build`, and `.next` output.

## Live browser result

The production acceptance created project `Live Cabinet Brain QA 1790368590580`
under isolated organization `codex-live-verification-tenant`, uploaded a genuine
4,429,286-byte plan PDF page and a 17,474-byte XLSX workbook through the deployed
Backoffice gateway, then completed:

1. project creation and upload;
2. PDF/workbook ingestion and page rendering;
3. classification and evidence capture;
4. reviewed extraction and takeoff approval;
5. unit-mix draft and verification;
6. deterministic SKU mapping and pricing;
7. deterministic QA and approval;
8. outreach-draft preparation and review comment;
9. `cabinet bid safe to send` canonical state;
10. browser refresh/readback persistence.

The read-only confirmation loaded persisted job
`edfaac41-2c88-4892-b18b-b45dfb8da418` and recorded zero browser console errors
and zero failed HTTP responses. Authenticated `/`, `/bids/vision`,
`/bids/tracker`, and `/drive` returned 200. Desktop and 390-pixel mobile
screenshots are stored beside this report.

## Authentication and tenant checks

- Anonymous `/`, `/bids/vision`, `/bids/tracker`, and `/drive` return one 307 to
  the NextAuth sign-in route; following the root redirect terminates at the sign-in
  page after one redirect, so no loop exists.
- Anonymous `/api/vision/projects` returns 401.
- A production-format NextAuth admin session returns 200 from root, Cabinet Brain,
  and `/api/vision/projects`.
- A second authenticated organization returns 200 with zero projects and cannot see
  the verification organization's projects.
- A viewer session cannot read or mutate the operator-only Vision surface (403), and
  an attempted project creation is denied (403).
- The VPS engine independently rejects missing/tampered principals and verifies the
  short-lived HMAC principal before using its organization for storage ownership.

## Build and automated verification

- Backoffice/platform: 26 root tests passed; Documents 2/2; Vision service 4/4.
- Backoffice lint and full workspace TypeScript checks passed.
- Next.js 16 production build passed and emitted all required routes.
- Backoffice Playwright gateway coverage passed on desktop and mobile (2/2).
- Cabinet Brain engine: 163 non-phase-zero tests passed; production phase-zero
  11/11; signed-principal tests 22/22; lint and production build passed.
- Vercel returned no error-level runtime logs for the deployed acceptance window.
- The PM2 engine remained online; live engine requests show authenticated 200/201
  operations for project creation, upload, and processing.

## Requirement-ledger truth

All 47 source requirements remain mapped to implementation files, tests,
dependencies, and database changes in `requirement-source-map.json`; none were
discarded during integration. The source audit does **not** support a blanket claim
that all 47 are fully verified: it records 5 `VERIFIED`, 3
`VERIFIED_WITH_CAVEAT`, 10 `SUPPORTED`, 21 `PARTIAL`, and the remaining eight in
explicit backend/build/recovery/test-gap/external-blocker states. Those gaps are
preserved rather than relabeled as passing.

## External and pre-existing limitations

- Email delivery, company intelligence, maps, and the external Cabinet Vision
  provider are not configured in the production engine. The deterministic local
  pipeline, evidence workflow, pricing, QA, persistence, and export gates work;
  external-provider calls remain blocked until credentials are supplied.
- The existing Drive page itself returns 200 and was not changed by this recovery.
  Its client-side storage listing still reaches a pre-existing Drive gateway/upstream
  mismatch; this was not introduced by Cabinet Brain and was not expanded into a
  separate Drive-service migration.
- The engine logs PDF.js standard-font warnings during rasterization, but the tested
  real PDF page rendered and completed the workflow successfully.
