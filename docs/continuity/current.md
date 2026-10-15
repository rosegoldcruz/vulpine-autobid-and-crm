# Vulpine Platform: engineering entry point

Reviewed 2026-10-15. These are bounded observations and explicit user requirements;
they are not a complete production certification. Runtime and source override memory.

## Identity and verified environment

- Canonical local checkout: `/opt/vulpine-platform`; GitHub repository:
  `rosegoldcruz/vulpine-autobid-and-crm` (Git configuration inspected).
- Initial audit HEAD: `edce7b8`; branch `codex/cabinet-brain-integration-recovery`.
  Use the start command's live branch/HEAD/status rather than these dated values.
- `README.md` and the workspace identify this as the Vulpine commercial platform,
  with Backoffice in `apps/backoffice`. AEON's service boundary is `services/aeon`.
- Node v22.23.2 and Python 3.12.3 observed. Root package manager contract:
  `pnpm@10.30.1`; no new package is required by continuity.
- Existing staged tracker moves and unstaged changes were present before this
  task. Do not reset, stage wholesale, or interpret them as completed continuity work.

## Current architecture and functionality (source verified)

- Frontends: `apps/web`, `apps/backoffice`, `apps/portal`. Server-owned services
  and shared contracts live in `services/` and `packages/`. The current source
  supersedes the older proposed directory layout in AGENTS.md.
- Auth uses existing NextAuth/ZITADEL integration and `packages/permissions`;
  do not replace it with Clerk based on historical planning notes.
- Backoffice has protected Tracker, Cabinet Brain, Drive, Pricing integration,
  and an operations module registry. Route presence does not prove live provider access.
- `services/operations/src/server.mjs` provides an authenticated adapter;
  its source adapter reads existing vault documents via `OPS_VAULT_PATH`.
  `GET http://127.0.0.1:3020/health` returned
  `{"status":"ok","service":"vulpine-operations","version":1}` during audit.
  Re-run for current availability; this does not verify authenticated workflows.
- Systemd reports operations running from this checkout. Bidding and cabinet
  pricing run from `/opt/vulpine-cabinet-pricing`, a separate repository.
  Do not edit that project as a side effect of continuity work.
- Running Docker containers include PostgreSQL, Redis, Engine, n8n and ERPNext
  services. Their schemas, credentials, health and data were not audited here.
- `services/aeon/README.md` defines a server boundary and includes a voice console;
  this is not evidence of a complete general-purpose agent runtime.

## Approved requirements

From the explicit persistent-project-intelligence task and project instructions:

- Preserve working implementations, user edits, approved visual identity and workbook
  authority. Never invent dimensions, SKUs, quantities, prices or release approvals.
- Keep verified facts, user-approved decisions, tentative plans and historical notes
  distinct. Persist actual verification outcomes, including failures and blockers.
- Repository memory owns engineering handoffs; existing Obsidian owns organizational
  knowledge. No duplicate database, broker or framework is needed for continuity.
- Keep provider secrets server-side. Do not copy environment files, personal history,
  raw conversations, customer documents or operational databases into this memory.
- Final commercial submission, orders, financial commitments and consequential
  actions require established authorization. This task makes no such actions.

## Design continuity

Preservation is user-approved; the following exact tokens are implementation facts,
not newly approved redesigns:

- `apps/backoffice/app/globals.css`: dark obsidian background
  `oklch(0.11 0.008 260)`, cyan/teal primary `oklch(0.78 0.16 182)`,
  radius `0.75rem`, semantic surface, sidebar and finance tokens.
- `apps/backoffice/app/layout.tsx`: DM Sans body, Outfit display, JetBrains Mono.
- `docs/VULPINE_OS_SHELL.md`: preserve Tracker/Brain/Drive; URL-based navigation,
  existing mobile drawer, 44px touch targets and single-column narrow layouts.
- Existing logos/icons under `apps/backoffice/public/` remain the reference assets.
  Vulpine is the commercial identity; “Powered by AEON” is the user-supplied
  software-brand requirement. Do not overwrite current assets to enforce a vague brief.
- No new screenshot, browser flow or PDF was produced in this task. Any visual
  change requires rendered desktop/mobile evidence; PDFs require rendered page review.

## Open work and next actions

- See `handoff.json` for the last session's work, verification, blockers and next action.
- Reconcile the existing tracker migration changes with their owner before committing
  or deploying them. Continuity does not certify that migration.
- Historical `docs/OPERATIONS_DELIVERY.md` lists GHL, voice, Hermes, accounting and
  backup follow-through; recheck task-relevant dependencies before treating those as
  current blockers. The vault pricing note's API credit and OAuth reports are also
  historical, not freshly verified service failures.
- Next engineering priority: establish repeatable runtime/authorized integration
  evidence for the next selected module, using this handoff rather than repeating
  the broad inventory. Do not start a new runtime infrastructure build from memory.

## Commands and supporting records

- Start: `node scripts/continuity.mjs start`
- End: `node scripts/continuity.mjs end /absolute/path/to/reviewed-handoff.json`
- Continuity acceptance: `node --test scripts/continuity.test.mjs`
- Existing app checks: `corepack pnpm test`, `corepack pnpm typecheck`,
  `corepack pnpm lint`, `corepack pnpm build`; browser suite: `corepack pnpm test:e2e`.
  Run affected checks; listing them is not evidence they passed this session.
- Read `docs/continuity/audit.md` for audit scope and Obsidian boundaries;
  `docs/continuity/decisions.md` for decisions; `docs/continuity/verification.md`
  for acceptance evidence. Older system maps and delivery notes remain historical
  supporting records and are not overwritten by this task.
