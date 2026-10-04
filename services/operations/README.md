# Operations adapter

Bounded integration adapter for the current Vulpine Backoffice. Node 22+; no dependencies or database migrations. Listens on loopback. Nginx exposes only signed requests through the existing API ingress; NextAuth/canonical capabilities are enforced by Backoffice before signing.

Required: `OPS_SIGNING_SECRET` (32+ random bytes), `OPS_ORGANIZATION_ID` (verified Vulpine ZITADEL organization), `OPS_STORAGE_PATH`, `OPS_PORT`.

Optional sources: `OPS_TRACKER_URL`, `OPS_ENGINE_URL`, `OPS_VISION_URL`, `OPS_VISION_DATABASE` (read-only existing SQLite), `OPS_DOCUMENTS_URL`, `OPS_PAPERCLIP_URL`, `OPS_PAPERCLIP_COMPANY_ID`, `OPS_HERMES_URL`, `OPS_OLLAMA_URL`, `OPS_N8N_URL`, `OPS_VAULT_PATH`, `OPS_BACKUP_PATH`, `OPS_GHL_URL`, `OPS_TWILIO_URL`, `OPS_VAPI_URL`. Public launch URLs use the corresponding `OPS_*_PUBLIC_URL`. GHL/Twilio/Vapi use their existing server credentials; model credential values are never returned. A configured credential is not a successful probe.

Frontend server variables: `OPERATIONS_API_URL`, `OPERATIONS_API_SECRET`. Never prefix these with `NEXT_PUBLIC_`.

Persistence is an organization-scoped atomic JSON store for operator-created drafts and audit events only. Original provider records, bids, workbook prices, takeoffs and approvals remain owned by existing systems. Optimistic concurrency prevents stale overwrite. This single-process adapter serializes writes. Back up its state directory alongside other service data before adopting it as a long-term draft store. No bulk outbound delivery is implemented.

`pnpm --filter @vulpine/operations test` exercises authentication, scope isolation, CRUD, audit identity, stale writes, pricing distinctions and forbidden delivery. Test records use temporary isolated storage and never reach production sources.

The optional Vision read model opens the existing SQLite database in read-only mode and filters every query through its verified organization ID. It does not run migrations or access other tenants. Mutations remain in Cabinet Brain's existing authenticated workflow.

Model configuration uses boolean `OPS_<PROVIDER>_CONFIGURED` flags, not copies of model keys. Provider availability/usage is not implied by those flags. Organization data is restricted to the configured organization; requests for another organization fail closed.

Deployment templates are included for the loopback systemd service and the existing HTTPS Nginx vhost. Runtime secrets belong in `/etc/vulpine-operations/runtime.env` (root-only), not this repository. Validate with `nginx -t` before reloading. Only this new service needs restarting when its adapter code changes.

Authenticated browser QA uses `tests/support/run-operations-e2e.mjs`, optional read-only source configuration via `OPERATIONS_TEST_SOURCE_ENV`, a separate port (3021), a temporary draft directory, and an isolated NextAuth secret. Run the browser suite with `OPERATIONS_AUTH_QA=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3199 pnpm test:e2e`. No test session is accepted by production.

Lead scoring is explicitly **operator-evidence v1**: website gap (missing 60 / weak 35 / adequate 0), a contact channel (20), and review presence (20). It requires written evidence and a recognized website status. It is not a crawl, AI assessment, or verified delivery event. Pipeline status changes are operator-reported.
