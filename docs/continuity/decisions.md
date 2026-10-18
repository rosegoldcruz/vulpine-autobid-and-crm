# Continuity decisions

## 2026-10-15 — repository engineering memory, existing Obsidian organization memory

Status: implemented engineering choice within the authorized continuity task.

Evidence: the canonical monorepo has source documentation and an AEON service
boundary but no coding-session restore command or handoff store. The accessible
Obsidian vault already has schema, company/project notes and an operations reader.

Decision: store a reviewed brief, decisions, source fingerprints and latest handoff
in `docs/continuity/`, invoked through `scripts/continuity.mjs`. Git retains prior
handoffs. Use an Obsidian project pointer rather than copying the vault or raw
user context into Git. No database or model provider is required.

Verification boundary: start automatically reads live Git state and compares selected
source fingerprints. It cannot establish that prose is true or a service is healthy.
Agents must inspect changed sources and task-relevant runtime. The handoff is an
agent-authored record, not independent approval or proof of commercial readiness.

## 2026-10-15 — preserve existing design and authorization boundaries

Status: explicit user-approved requirement, recorded without changing UI.

Decision: preserve existing typography, semantic colors, component patterns and
approved references. Exact observed tokens are listed with source paths in
`current.md`; do not claim new owner approval of every observed token.
Existing authenticated server capabilities and workbook-derived pricing remain
authoritative. Continuity adds no deployment, send, financial or approval bypass.

## 2026-10-15 — explicit commands rather than unsupported hooks

Status: implemented; session invocation remains an agent obligation.

Decision: AGENTS.md instructs agents to invoke start/end. Commands automate restore,
Git observations, fingerprints and atomic handoff persistence; they do not run
automatically on every tool, IDE or agent exit. No supported cross-agent hook was
established. An interrupted agent may leave the previous handoff; live Git state
and source drift must be reconciled before continuing.

## 2026-10-15 — complete the existing vault-to-session-to-vault cycle

Status: implemented within the user's explicit organizational-memory integration task.

Use an explicit per-project note selection rather than crawling personal records.
Preserve original notes; append private, provenance-backed session source records,
accumulate reviewed decisions in the existing project note, and update the index
and mutation log. Facts require evidence; assumptions and reported verification
remain labeled. No generic report becomes implicit owner approval.

Use the existing start/end commands, a shared Linux flock, session baselines,
atomic file replacement and a write-ahead recovery journal with receipts. Stale
completion inputs and conflicting edits fail visibly; exact retries deduplicate.
These guarantees require cooperating writers; Obsidian UI and generic MCP editors
must pause managed-record writes or adopt the same lock. No universal hook exists.

Correct Quartz's source only after applying an explicit-publish/private-note filter
and disabling unconditional attachment copying. Preserve web access restrictions.
Maintain the installer/policy in this canonical monorepo rather than pushing AEON
customizations to the upstream Quartz project's remote. No real vault publication.

## 2026-10-16 — server-wide Codex discovery and a supported SessionStart hook

Status: global instructions installed and observed in live Codex context; hook
definition installed, execution pending Codex's explicit hook trust review.

Installed Codex CLI 0.163.0 reports stable hooks enabled. Current official docs
define global AGENTS.md and SessionStart hooks, including the trust requirement.
Use global instructions as the fallback, and a SessionStart handler to supply
organizational context for every root Codex workspace and full project restoration
inside the registered checkout. Do not assign unrelated projects to this monorepo.
Do not modify trust records or bypass the review. Reviewed completion remains the
agent's responsibility. Other accounts/clients are not automatically covered.

## 2026-10-18 — all agent clients in scope, read-only initial release

The owner explicitly included GitHub, Qwen, Muse, Claude, Codex, ChatGPT, MetaMuse,
Copilot, Grok, Grokbot, OpenCode, Cursor and Hermes. Configure the actual host
runtime rather than treating a model-provider endpoint as an MCP client. Use one
authenticated backoffice endpoint with individually revocable, organization-scoped
client credentials and existing operations read adapters. Initial tools cannot
mutate records. Read-only was the assistant's proposed implementation choice;
the owner expanded client scope and requested timing, without separately granting
write access. Hosted/account/device integrations remain open until verified there.


## 2026-10-18 — owner correction: Muse desktop is independent

Explicit owner clarification: leave MetaMuse in OpenCode, but connect the actual
Muse desktop app containing the AEON chat directly. Its own `muse` credential
and production digest are separate from the six earlier clients. Do not claim
that configuring a provider in OpenCode or Hermes enrolls that desktop app.
Native app secure enrollment remains a required account-side step until verified.
