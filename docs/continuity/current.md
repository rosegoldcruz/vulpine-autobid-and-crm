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
  knowledge. Startup/completion now load and write selected vault context through
  the same commands; see `vault-integration.md`. No duplicate database is needed.
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
- Continuity acceptance: `node --test scripts/continuity.test.mjs scripts/vault-memory.test.mjs scripts/quartz-privacy.test.mjs`
- Existing app checks: `corepack pnpm test`, `corepack pnpm typecheck`,
  `corepack pnpm lint`, `corepack pnpm build`; browser suite: `corepack pnpm test:e2e`.
  Run affected checks; listing them is not evidence they passed this session.
- Read `docs/continuity/audit.md` for audit scope and Obsidian boundaries;
  `docs/continuity/decisions.md` for decisions; `docs/continuity/verification.md`
  for acceptance evidence. Older system maps and delivery notes remain historical
  supporting records and are not overwritten by this task.

## Shared organizational memory integration

Implemented 2026-10-15 (America/Phoenix). `docs/continuity/vault.json` selects this
project's company, AEON direction, pricing/access decision context and existing
continuity project note. Startup returns selected notes, latest execution record,
accumulated decisions and a session ID. Completion uses that ID plus evidence-backed
facts and explicit assumptions to write the vault source record, project summary,
index, mutation log and repository handoff through a recoverable transaction.
See `vault-integration.md` for commands, conflict handling, credentials and limits.

Quartz's source now resolves to `/opt/pai-obsidian/obsidian-vault`. The versioned
installer enforces explicit publication, private/draft exclusion and no automatic
attachment copying. Existing web access controls were not changed. Only disposable
fixture content was built; no business notes were published. This supersedes the
earlier dated publishing-path issue, without certifying a live publishing service.

## Server-wide Codex entry

On 2026-10-16, installed `/root/.codex/AGENTS.md` and a supported SessionStart
hook definition from `infra/codex/`. The global memory instructions were observed
in live Codex context and verified by `codex debug prompt-input`. The hook requires
one-time review/trust in `/hooks` before automatic execution. Its loader supplies
organizational context outside this checkout and invokes project continuity inside
it. Global instructions require a fallback loader if hook context is absent.
This supersedes the earlier no-hook-definition statement; completion still requires
a reviewed end handoff. The vault's foundational notes are dated context, not a
complete live inventory of all server projects.

## 2026-10-18 — read-only agent access

Backoffice now serves authenticated MCP at `/api/mcp` with `list_workspaces` and
`read_workspace` for explicitly scoped projects/CRM reads. Each local agent has a
separate bearer credential; production stores only digests in `MCP_CLIENTS_JSON`.
The adapter at `scripts/agent-mcp.mjs` keeps raw credentials outside the repository.
See `docs/integrations/agent-mcp.md` for configuration and verification boundaries.

Production deployment `dpl_BCBP9ksQLJGUPcfXeA2111qy6Lcu` passed live initialization,
tool listing and project reads through six client adapters (Codex, Claude Code,
Qwen, OpenCode, GitHub Copilot CLI and Hermes); OpenCode's native MCP list also
reported connected. This certifies transport/tool execution, not model behavior.
MetaMuse may remain configured through OpenCode; the owner requires the Muse desktop AEON app to have its own direct connection. Desktop/web ChatGPT, Cursor,
separate Grok/Grokbot and GitHub-hosted agents remain unenrolled/unverified; their
actual account/device/runtime access is needed. This route does not implement
OAuth onboarding. The separate pricing/bidding MCP service remains independent.

### Muse desktop clarification and independent identity

The owner identified the Muse desktop app (AEON conversation) in a screenshot,
explicitly allowing MetaMuse to remain in OpenCode. Provisioned a separate `muse`
client identity and credential in private server configuration; updated the
production digest registry and deployed `dpl_6cbTJ5TyoYvqq8du1Niyorw457bS`.
Direct HTTP SDK initialization, tool discovery and a real project read passed
with this dedicated identity, without OpenCode, Hermes or a stdio bridge. The
desktop app itself has not been enrolled or verified: this session has no live
control of its account/window or secure credential input. See the integration
document for the exact endpoint and non-secret setup request. No Muse CLI was
installed; the screenshot identifies the desktop product rather than Muse Code.


### Generator attribution removal and Muse secure enrollment check

Removed the third-party generator metadata property from the backoffice layout.
Production deployment `dpl_9AmSQknpSbtud5JKbYoJnJo9GMm5` passed its build. Live
`/signed-out` and `/access-denied` return HTTP 200 with the Vulpine title and no
generator meta tags or removed-vendor domain references. Repository source scan
found no further vendor attribution or named integration dependencies. The
existing Vulpine favicon and all unrelated infrastructure remain unchanged.

The owner supplied Muse's secure credential-entry URL. Its decoded specification
restricts the connector host to backoffice.vulpine.llc and places the access
credential in an authentication header. The URL redirects from agent.meta.ai to
muse.ai, then returns HTTP 401 to this execution session. No key was submitted.
Enrollment requires the owner's signed-in Muse browser; keep the one-time URL,
its session identifier, and all private credentials out of repository memory.
