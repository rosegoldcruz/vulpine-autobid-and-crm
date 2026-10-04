# Vulpine OS functional convergence — 2026-10-04

Scope: the existing 46-route Backoffice. Preserve Tracker, Cabinet Brain, Drive, ZITADEL and current visual language. Runtime inspection takes precedence over the supplied October 2 audit. No customer messages or outbound campaigns are sent during implementation.

## Runtime and ownership

- Backoffice: Next.js App Router on Vercel. Shared `packages/auth` and `packages/permissions`; 46 entries in `lib/platform-modules.ts` drive sidebar and Command Center links.
- Tracker: loopback 4400, SQLite bid ledger. Existing authenticated Backoffice proxy. Historical ledger remains authoritative.
- Vision: loopback 3000, existing signed principal proxy and scoped project/job APIs. Preserve estimating, workbook, QA and release gates.
- Documents: loopback 3016, SFTP and Postgres access history, existing Drive proxy and file UI.
- Engine: loopback-reachable 8000, Postgres SKU catalog (2,187 records), no engine projects at inspection. Catalog prices are source records, not automatically verified workbook pricing.
- Paperclip: loopback 3100, existing service and database. Real VULPINE company, agent and work records now exist. The older audit predates onboarding.
- Hermes: 8787, authenticated Web UI; gateway systemd service. Integrate without forking upstream.
- Ollama: loopback 11434. Providers and GHL/Twilio configuration exist; credentials are never browser data.
- Knowledge: `/opt/pai-obsidian/obsidian-vault`. Preserve files and source paths. Do not repair Quartz publishing as a side effect.
- Existing pending user work: Drive proxy changes and AEON voice console. Preserve, do not discard or silently deploy unrelated changes.

## Route matrix

| Route | Purpose | Initial state | Source / service | Functions to build | Overlap / implementation |
|---|---|---|---|---|---|
| / | Command Center | Directory only | Tracker, Paperclip, probes, documents | Actual summaries, failures, links, refresh | Aggregate; never equate bids to revenue |
| /projects | Projects | Unconnected | Tracker + Vision + operator links | Search, source IDs, detail, notes, tasks | Preserve separate service identities |
| /projects/documents | Documents | Unconnected | Existing Drive | Browse/upload/preview/download | Reuse Drive component |
| /projects/activity | Activity | Unconnected | Paperclip activity + recorded operator events | Timeline, filter, details | Same event view as Events |
| /bids/tracker | Bid ledger | Implemented | Tracker API | Preserve existing edit/upload/KPIs | No duplicate ledger |
| /bids/vision | Cabinet Brain | Implemented | Vision API | Preserve evidence/workspace/review | Canonical takeoff source |
| /bids/engine | Engine | Old workflow UI | Engine + Vision | Actual engine state, source projects, execution links | No second estimator |
| /bids/takeoffs | Takeoff review | Unconnected | Vision project workspaces | Project selector, quantities/evidence, review links | No takeoff database |
| /bids/pricing | Pricing | Unconnected | Catalog + project pricing | Source prices, search, provenance, project pricing links | No invented markup or totals |
| /bids/proposals | Outputs | Unconnected | Tracker documents + Vision exports | Version/source/QA references, open workflow | Never fabricate release status |
| /bids/catalog | SKU library | Unconnected | Existing Engine SKU catalog | Search, dimensions, source, detail, export | Read-only catalog |
| /crm | CRM overview | Unconnected | GHL | Contacts, opportunities, connectivity, next actions | GHL remains authority |
| /crm/opportunities | Deals | Unconnected | GHL + explicitly local drafts | Pipeline/table, stage/value/next action | Drafts not synchronized unless implemented |
| /crm/companies | Organizations | Old empty UI | GHL company relationships + Tracker | Source-linked company list/details | No automatic entity merges |
| /crm/contacts | People | Old empty UI | GHL | Search/contact details/relationships | No fabricated contacts |
| /sales/campaigns | Campaign work | Old empty UI | Durable operator drafts + provider state | Draft sequence, edit, preview, pause, export | No delivery claims or automatic sending |
| /crm/leads | Digital agency | Old empty UI | Operator ingestion + salvaged source ideas | Manual add, CSV import, stages, evidence-based scoring | Never import old fictional HVAC demo |
| /finance | Commercial reporting | Empty KPIs | Tracker | Pipeline, explicit won/lost, profit coverage, monthly breakdown | Actual revenue unknown until ledger connected |
| /ai/paperclip | Orchestration | Unconnected | Paperclip API | Agents, tasks, approvals, activity, launch | Existing instance |
| /ai/hermes | Agent runtime | Unconnected | Hermes health + launch | Runtime status, authenticated launch | Sessions only if API authorized |
| /ai/agents | Registry | Unconnected | Paperclip agents | Model/runtime/status/details/launch | Shared orchestration records |
| /ai/providers | Compute | Unconnected | Credential presence + Ollama/Paperclip | Models, configured vs verified, inspect | Never expose credentials |
| /ai/automations | Routines | Unconnected | Paperclip routines + system timers | Last/next/status/history links | No fabricated schedules |
| /communications/inbox | Attention | Unconnected | GHL conversations | Search, unread/source, open CRM | Gmail gap explicit |
| /communications/sms | Messages | Unconnected | Twilio | History/status/filter, compose draft | Send requires explicit configured workflow |
| /communications/dialer | Voice | Pending user console | AEON voice + Twilio | Numbers, call history, console launch | Preserve user's implementation |
| /communications/calls | Call history | Unconnected | Twilio | Status/duration/recipient/filter/detail | Shared communications adapter |
| /communications/recordings | Recordings | Unconnected | Twilio | Recording metadata/source links | No public audio credentials |
| /communications/valerie | Voice agent | Unconnected | Vapi + voice console | Provider state/agents/calls/launch | No autonomous dial action |
| /knowledge | Vault | Unconnected | PAI markdown | Browse/search/source/preview | Read canonical files safely |
| /knowledge/search | Retrieval | Unconnected | Vault + project sources | Full-text search with provenance | No invented summaries |
| /knowledge/sops | Procedures | Unconnected | Vault skill/SOP files + durable drafts | Browse/read/draft/export | Originals preserved |
| /knowledge/intelligence | Research | Unconnected | Vault concept/company/source files | Search/read/source links | Document-derived labels |
| /drive | Files | Implemented | Documents service | Preserve full existing workflow | Shared with Documents |
| /operations/jobs | Background work | Unconnected | Paperclip runs + Engine state | Status/filter/details/source | No fabricated jobs |
| /operations/events | Events | Unconnected | Paperclip activity + operator audit | Timeline/filter/export | Same canonical events as Activity |
| /operations/notifications | Attention | Unconnected | Failed probes + approvals/issues | Actionable source-linked failures | Local acknowledgement explicit |
| /operations/backups | Recovery | Unconnected | Existing backup filesystem | Sizes/dates/coverage/verification unknown | Existence is not restore proof |
| /integrations | Connectivity | Unconnected | Actual config + API probes | Presence, verified status, errors, launch | Never green from env alone |
| /system/services | Service map | Unconnected | Allowlisted live probes | Bind/path/role/status/time/latency | Internal data under admin capability |
| /system/health | Health | Unconnected | Same probes | Refresh/incidents/inspection | Probe evidence and scope |
| /system/logs | Diagnostics | Unconnected | Sanitized gateway event log | Filter/severity/time/export | No unrestricted shell/log endpoint |
| /system/users | Identity | Unconnected | Current verified session | Current identity and source limitation | Directory enumeration not invented |
| /system/permissions | Authorization | Unconnected | Canonical role/capability package | Actual matrix and session capabilities | Same model used on server |
| /settings | Preferences | Empty tab controls | Session + local preferences | Save/reset/theme/session/sign-out | Browser preferences labeled |
| /ai/fox | Assistant | Unconnected | Existing Vision assistant + source retrieval | Project context, questions, conversation, tool status | No fake tool execution |

## Integration approach

Add a bounded operations adapter on the VPS for read-only service aggregation and durable operator-authored records. Backoffice proxies require canonical capabilities; requests to the adapter are short-lived, signed, organization-bound and method-bound. No arbitrary URL fetching, command execution, database migration, or unrestricted filesystem paths are exposed. Existing service APIs remain authoritative. Existing native Tracker/Vision/Drive components stay intact.

Verify route rendering, permissions, failure and empty states, meaningful controls, persistence, current module regressions, typecheck, build, and production boundaries. Distinguish automated fixture tests from actual live service checks.
