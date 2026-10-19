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


## 2026-10-18 — explicit owner expansion, tracker retirement and private vault

Owner approvals supersede earlier assistant-chosen read-only/pricing-only scope:
grant pricing writes and the requested backoffice module/service operations to
all configured agent identities; preserve independent Muse desktop identity and
allow MetaMuse to remain in OpenCode. Use existing services and their authorization
contracts rather than inventing routes, prices or successful provider results.
Do not interpret access grants as instructions to send communications or orders.

The owner authorized pushing all dirty work and removing trackers outside the
ZITADEL-gated backoffice. Retire the standalone tracker website while preserving
the authenticated backend, records and uploads required by backoffice. Keep
private email-audit content in ignored runtime storage; do not commit it.

The owner explicitly chose a private full-vault viewer behind login and stated
that Quartz previously worked. Restore existing Quartz under its existing login,
isolating private output from ordinary restricted publication. Keep attachments
and non-note credential/database files excluded. This approval is for private
viewing, not public publication or broadening agent context to the whole vault.
Retain the supported reviewed continuity protocol for managed vault mutations.


## 2026-10-18 — owner grants Drive writes and bid deletion

The owner requested agent access to Vulpine Drive for plans, briefly selected
read-only, then explicitly changed it to read/write. The final instruction governs:
allow folder browsing, preview/download, upload and deletion through the existing
Drive service. Use scoped expiring transfer tickets for large files instead of
copying service credentials to agents or increasing MCP payload limits.

The owner explicitly requested a delete button for stored pricing bids and MCP
deletion, identifying unwanted fake test data. Add individual bid deletion rather
than deleting whole customer projects. Keep write permissions, revision conflicts,
organization/owner boundaries and audit metadata. Remove clearly labeled demo/QA
records through the new authenticated tools, preserving unrelated business data.


The owner also requested folder selection/upload rather than file-only upload.
Preserve the selected top folder and nested directories through a validated
relative-path manifest, retaining existing storage and signed transfer gates.
Batch larger selections within current limits rather than increasing unbounded
server memory. Empty folders are outside what the browser file-list picker reports.


## 2026-10-18 — standalone retirement and large folder uploads

The owner explicitly superseded the brief standalone repair request: retire
drive.vulpine.llc, but DO NOT delete Backoffice Drive or shared storage. Return
410 at the standalone hostname and remove only its frontend PM2 process. Retain
the documents backend and all stored files. No standalone IAM callback work remains.

The owner is uploading approximately 3,000 files and reported the old 250 MiB
rejection. Stream uploads through private temporary disk rather than buffering
whole files in Node memory. Allow individual files above the batching target,
retain 100-file batches and scoped authentication, and show progress with resume
for remaining files after acknowledged partial failures. Resume requires the
current browser tab; cross-reload and byte-range resume are not implemented.


## 2026-10-18 — consolidation status must match runtime

The owner reiterated /opt/vulpine-platform as the intended consolidated repository
and requested an explanation of the excess folders. Distinguish canonical source,
active release deployments, persistent state, vendor projects and unmerged old
checkouts using runtime evidence. Do not call source copying full consolidation
or remove still-mounted files/unique edits. Backoffice Drive remains preserved.
Apply the documents access-history migration to the same database as its runtime;
working SFTP listing and a shallow health response do not verify Recent/history.


## 2026-10-18 — distinguish sending from saved files

Owner reported an upload stuck at zero files with a pending request. Live metadata
showed incoming temporary-file bytes and continuing permanent-storage write logs.
The UI had reported only whole-batch acknowledgements. Add browser byte progress
and a separate indeterminate saving state without claiming bytes sent are files
saved. Keep the in-flight backend running; do not restart it or tell the owner
to reload an active upload just to load new display code.


## 2026-10-18 — owner authorizes complete consolidation and cleanup

Owner explicitly authorized migrating all scattered first-party applications into
/opt/vulpine-platform, actual source/shared dependencies/deployment configurations,
service/container cutovers, preservation of needed dirty/untracked/ignored work
and relevant Git history, and deletion of superseded locations after recovery and
consumer verification. Owner explicitly excluded all /home modifications and then
excluded Vulpine Supply and related trees. No extra approval was required.

Completed those cutovers and removed 18 application/release/check directories plus
two obsolete root files. Preserve private recovery under /opt/vulpine-backups,
runtime state under /var/lib and named volumes, and credentials under /etc. Retain
vendor applications and the vault outside first-party source. No source symlink
back to a scattered old application tree is the new runtime.

Preserve deliberate retirement of standalone Drive/Tracker and gated Backoffice
access. Previously dormant Leads/Twilio are migrated/build-tested without creating
unrequested public deployments. Use canonical deployment entry points and isolated
Brain tests so verification cannot replace the production Next build. The completed
consolidation supersedes prior partial-migration/audit open work.


## 2026-10-18 — owner pricing/PDF requirements and signature authorization

Owner explicitly required project/GC/address/actual-count/line/finish data and
verified tax (or documented applicable exemption) before customer-ready export.
New/revised pricing uses $3.33 per decorative handle without cabinet margin,
$133 per actual apartment/named amenity area, independent supplier cost tracking,
and preservation of approved overrides/historical issued documents. Avoid color
segment/island double-counting, sample schedules represented as project prices,
and framed substitutions for specified frameless construction.

Owner supplied the approved Daniel Cruz PNG under /opt for the two prepared
regression proposals. Retain it privately outside Git; explicit approval is tied
to the quote number, and new/revised drafts do not inherit it. Do not sign customer
fields, invent acceptance dates, create a replacement signature, or send anything.
Customer scope is separated into Included Scope, Pricing Basis, Substitutions
and Exclusions; internal notes remain internal. The shared pipeline preserves
approved artwork, Letter sizing and closing-page-last ordering.


## 2026-10-18 — Bonner Springs GC/contact supplied by owner

The owner supplied a chat screenshot identifying Ronco Construction as the
Bonner Springs GC / prepared-for company, Rod Ritenour as project contact, and
rritenour@ronco-construction.com as email. Record provenance as owner-provided
screenshot rather than independently verified correspondence. The phone is
clipped; do not infer it. Update the existing internal R1 draft and append its
new PDF while preserving earlier revisions and original bids. Delivery address,
tax and specified finish pricing remain unresolved. Send nothing.


## 2026-10-18 — owner tax base and manual rate

Owner explicitly directs cabinet materials and handles as the only taxable
charges; never tax freight, installation or assembly. Enforce this in manual
rate creation, tax summary and automatic provider request. Manual percentages
are authenticated, signed and saved with operator attribution; they need no
external provider or daily lookup. Delivery and other customer-ready requirements
remain separately enforced. Show estimated profit from known costs rather than
hiding it when handle/freight supplier costs remain unverified. Sales tax is
collected in the payable total and does not become profit.
