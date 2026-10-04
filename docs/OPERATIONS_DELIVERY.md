# Vulpine Backoffice implementation handoff — October 4, 2026

This is a working breadth-first integration release, **not a claim that every requested autonomous workflow is finished**. It preserves the existing Backoffice shell and the native Tracker, Cabinet Brain and Drive. Provider records remain authoritative. No production bid was edited, no customer message was sent, and no provider database migration was run.

## What each route does now

All new record workspaces support source-labelled records, search, status/source filters, details, CSV/JSON export, refresh, explicit loading/error/empty states and mobile layouts. Write controls use the same canonical capabilities as the server. Operator records have server persistence, audit identity, stale-edit protection and confirmation before deletion. They are not silently synchronized to external providers.

| Route | Delivered | Boundary / remaining work |
|---|---|---|
| `/` | Live commercial metrics, service probes, Paperclip work, full module directory | Bid pipeline is not accounting revenue |
| `/projects` | 44 ledger references, tenant-scoped Brain project, source links, editable operator project notes/next actions | Source identities remain separate; no automatic entity merge or full project task system |
| `/projects/documents` | Existing native Drive browser, transfers and authorized upload controls | Same storage and permissions as Drive |
| `/projects/activity` | Brain audit, Paperclip activity, operator audit | Not every external system emits events here |
| `/bids/tracker` | Existing bid register preserved | Existing edit/upload behavior unchanged |
| `/bids/vision` | Existing Plan Room, review, execution and QA preserved | Remains the authoritative estimating workflow |
| `/bids/engine` | Actual engine stats/projects and scoped Brain runs | Execution stays in Brain; no second estimator |
| `/bids/takeoffs` | Scoped canonical takeoff records and Brain review links | Empty when this organization's projects have no takeoff records |
| `/bids/pricing` | 2,187 source catalog rows plus scoped estimate lines | Catalog unit cost is not a certified selling price |
| `/bids/proposals` | Ledger references and scoped generated export metadata | Historical ledger rows do not prove QA release approval |
| `/bids/catalog` | Searchable SKU dimensions, catalog values, detail/export | Read-only; workbook authority is unchanged |
| `/crm` | GHL contact/opportunity adapter and explicit connection result | Existing credential returns HTTP 401 |
| `/crm/leads` | Agency prospect add/import/edit/delete, operator-reported stages, pipeline view, evidence-based priority assessment, preview/next-action fields | Autonomous discovery, website inspection and preview generation are not connected |
| `/crm/opportunities` | GHL view plus durable local deal drafts, stages, values, next actions | Provider access currently blocked; drafts are not provider deals |
| `/crm/companies` | 30 actual tracker company relationships, GHL adapter, local drafts | No automatic deduplication across providers |
| `/crm/contacts` | GHL adapter and useful local contact drafts | GHL directory requires a valid credential |
| `/sales/campaigns` | Persisted subject/body/sequence/suppression drafts, edit/pause/review/export | No sending, tracking or scheduling claims |
| `/finance` | Explicit won/lost/open values, projected profit and coverage from 44 bids | Recognized revenue remains Unknown; no accounting connection |
| `/ai/fox` | Existing project assistant/chat and approved query tools, saved conversation drafts, source knowledge | Requires an authorized Brain project; no general autonomous control-plane actions |
| `/ai/hermes` | Live runtime availability with access boundary explained | Authenticated session/conversation adapter and public launch URL still needed |
| `/ai/agents` | Existing Paperclip agent registry and runtime details | Changes remain in Paperclip |
| `/ai/paperclip` | Real agents, issues, approvals, activity and authenticated launch | Existing instance/database unchanged |
| `/ai/providers` | Server configuration presence and Ollama model query | Presence is not provider health, spend or usage verification |
| `/ai/automations` | Existing Paperclip routines and launch | No routine is invented when the source is empty; n8n routine administration not integrated |
| `/communications/inbox` | GHL conversation adapter | GHL 401; Gmail not integrated |
| `/communications/sms` | 57 actual Twilio message records and delivery/error details | Read-only; no send action |
| `/communications/dialer` | Four actual Twilio number records and capabilities; voice-console source and embed included in GitHub at the user's request | Live console deployment still requires its HTTPS URL and server configuration |
| `/communications/calls` | First 100 actual Twilio calls, duration/status/detail | Provider pagination beyond 100 and native dialing remain |
| `/communications/recordings` | Twilio recording metadata adapter; currently zero records | Authenticated audio playback/transcripts not implemented |
| `/communications/valerie` | Five actual Vapi assistants plus Twilio call history | No autonomous dialing or voice-agent editing |
| `/knowledge` | 134 canonical vault documents, text preview, source path and export | Original vault files never changed |
| `/knowledge/search` | Real full-text vault search with provenance | Not a universal cross-provider semantic index |
| `/knowledge/sops` | 11 source procedures/skills plus editable operator drafts | Original SOP file publishing/versioning is separate |
| `/knowledge/intelligence` | 52 source research/company/concept documents plus drafts | Document-derived, not invented AI findings |
| `/drive` | Existing file workspace preserved | Pending user proxy fixes left unstaged |
| `/operations/jobs` | Canonical Brain runs and Paperclip work | Retry/cancel remain in their owning workflows |
| `/operations/events` | Actual Brain/Paperclip/operator audit records | Not a new event bus |
| `/operations/notifications` | Failed probes, Paperclip work and approvals; header bell routes here | No fabricated unread count; acknowledgement/dispatch not implemented |
| `/operations/backups` | Actual local backup directory metadata | Contents restricted; restore and offsite coverage Unknown |
| `/integrations` | Eight runtime probes and provider configuration inspection | No credential editor or automatic reconnection |
| `/system/services` | Allowlisted live endpoint probes, role, HTTP status, timing | Probe scope is explicitly HTTP availability only |
| `/system/health` | Same live health evidence with refresh/filter | No historical uptime SLA claim |
| `/system/logs` | Sanitized adapter diagnostics | Bounded in-memory source errors, not all host/service logs |
| `/system/users` | Current verified identity, organization, roles, capabilities | ZITADEL directory enumeration/admin not configured |
| `/system/permissions` | Canonical role-to-capability matrix and current assignments | No second permission source |
| `/settings` | Working theme preference/reset, safe session details, sign out | No inert profile/billing/security tabs |

Counts are observed source snapshots, not guarantees that external data cannot change.

## Architecture and data protection

- One new dependency-free operations adapter listens on `127.0.0.1:3020`, exposed through `/operations/` on the existing HTTPS API ingress.
- Backoffice checks its canonical capability before signing a 60-second organization/module/method/body-bound request. Unsigned and wrong-organization requests fail closed. Draft mutations additionally require the configured public same-origin URL.
- Existing Vision SQLite is opened read-only and queried through the verified organization. Other tenants and historical test tenants are excluded.
- Operator drafts use an atomic organization-scoped JSON store in `/var/lib/vulpine-operations`, with a single-process write queue. This is bounded draft persistence, not a new provider database. Backup/restore coverage for this new store still needs operational ownership.
- Runtime credentials remain in a root-only environment file; browser responses use selected fields, not integration credentials. Vercel receives only the adapter URL and encrypted signing secret.
- No new ZITADEL application, project or role was created. Existing authentication semantics remain. Unconfigured production native pages now lock rather than displaying the development preview shell.
- No DNS, certificate, existing embedded Postgres, workbook, pricing rule or historical bid was changed.

## Verification and known limits

- Root unit/service suites passed; the adapter separately verifies HMAC boundaries, validation, explicit scoring, durable CRUD, audit actor, conflicts and forbidden delivery.
- Lint, all workspace typechecks and production build passed.
- Isolated authenticated browser QA covers all 46 routes, generic client rendering, mobile navigation, no horizontal overflow, record persistence/edit/delete, catalog filtering/export, source failure, safe session JSON, cross-origin denial, insufficient-role denial, and post-cookie-removal denial.
- Existing Tracker mobile editing and Brain desktop/mobile review tests pass with intercepted **test-only** fixtures. Those fixtures never enter production storage.
- Live adapter GET checks verify the actual sources listed above. Production unauthenticated checks verify the external access boundary. A fresh human ZITADEL login and production write workflow are not falsely claimed by local test sessions.
- Browser plugin unavailable: repository Playwright was used. Primary viewport checks: desktop and 390×844 mobile.

## Required external follow-through

1. Restore the existing GHL credential/location access; do not create duplicate contacts as a workaround. Local drafts remain usable meanwhile.
2. Deploy/configure the included voice console before enabling real send/dial actions; no outbound communications were tested against customers. Its five API regression tests passed against isolated storage and mocked Twilio actions.
3. Supply an authorized Hermes conversation API/session integration and public HTTPS launch address.
4. Add the actual accounting source before recognized revenue reporting.
5. Extend agency discovery, preview generation and delivery after the real provider/approval contracts are established. Current lead scoring is explicitly operator-evidence-based.
6. Assign backup/restore ownership for operator draft state; local backup directory existence is not restore verification.

The original route matrix remains the planning baseline; this document records what was actually delivered and what was not.
