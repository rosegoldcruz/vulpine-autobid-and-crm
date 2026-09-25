# Cabinet Brain source-lineage and integration recovery

## Frozen source points

| Purpose | Repository | Branch / commit |
|---|---|---|
| Production Backoffice baseline | `/opt/vulpine-platform` | `main` at `772252751756ef0dece0f9a999a89cc575f94f02` |
| Backoffice rollback | `/opt/vulpine-platform` | `rollback/backoffice-pre-cabinet-brain-20260925` at `772252751756ef0dece0f9a999a89cc575f94f02` |
| Integration release | `/opt/vulpine-platform` | `codex/cabinet-brain-integration-recovery` |
| Preserved 47-requirement source | `/opt/vulpine-vision` | `recovery/cabinet-brain-47-source-20260925`, snapshot `13801e4492b08d1dfc7fae8c11a818810a6067c1` |

The repositories have unrelated Git roots and no merge base. `/opt/vulpine-vision`
started as a separate Google AI Studio/Vite application. The platform repository
previously extracted a quarantined subset at `e50923c`, but the later Cabinet Brain
implementation remained in the standalone repository. The recovery is therefore a
structured integration, not a merge or cherry-pick.

## Production boundary

- `backoffice.vulpine.llc` remains the Next.js Backoffice application in
  `apps/backoffice`, deployed by the existing Vercel project
  `vulpine-autobid-and-crm`.
- `/bids/vision` remains the canonical Cabinet Brain route inside the existing
  Command Center shell and navigation.
- The preserved Cabinet Brain engine remains server-side in `/opt/vulpine-vision`,
  served by the existing `vulpine-vision` PM2 process on `127.0.0.1:3000` and the
  existing `api.vulpinehomes.com` ingress.
- Backoffice remains authoritative for ZITADEL/NextAuth authentication. It sends a
  short-lived HMAC-signed principal containing the verified subject, organization,
  role and exact scopes. The engine verifies both the Bearer credential and signed
  principal and uses the signed organization for tenant ownership.
- Existing Bids Tracker, Drive, CRM shell, routes, Vercel project, domain, and
  platform authentication are preserved.

## Deliberate reconciliation

Migrated into Backoffice:

- workspace, blueprint viewer/studio, review, QA, workflow, queue, settings,
  notifications, assistant/chat/voice, export, outreach, and pipeline surfaces;
- an explicit method/path gateway with query forwarding and streaming/binary
  passthrough;
- verified ZITADEL organization propagation and least-privilege engine scopes.

Retained in the engine runtime:

- canonical schemas and ordered non-destructive SQLite migrations;
- ingestion, PDF rasterization, workbook parsing, workflow compiler, agents,
  evidence, measurements, persistence, exports, analytics, and provider boundaries;
- persistent uploads, renders, artifacts, and audit records under the existing VPS
  storage root.

Not migrated:

- the standalone root website, local login/session UI, Google AI Studio/Vite
  prototype, duplicate package/bootstrap files, and unauthenticated legacy mutation
  routes.

## Deployment safety

Before the engine restart, preserve the SQLite database (including WAL/SHM while
the service is stopped) and record the PM2 process definition. Run `nginx -t`
before reloading the ingress. The engine migrations are additive and tracked in
`schema_migrations`; no table or column drop is authorized by this recovery.

The evidence status for every source requirement is recorded separately in
`requirement-source-map.json`. `PARTIAL` and external-provider blockers are retained
honestly rather than being converted into false production-verification claims.
