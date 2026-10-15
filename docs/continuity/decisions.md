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
