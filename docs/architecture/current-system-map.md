# Current system map

Inspected 2026-09-20 from the working trees under `/opt`. Runtime evidence and source take precedence over older prose.

| Source | Current implementation and state | Runtime/data assumption | Canonical target | First-milestone treatment |
| --- | --- | --- | --- | --- |
| `/opt/vulpine-vision` | Next.js 15 App Router; document ingestion, bid workflow, Leads handoff, AEON/LLM work; working tree already has uncommitted changes | File-backed job/upload data is configurable; server-side document libraries; estimator intelligence remains quarantined | `apps/backoffice/app/bids/vision` plus `services/vision` | Inspected only. No source copied yet to avoid absorbing an actively modified tree. |
| `/opt/vulpine-leads` | Next.js 15 UI; local JSON persistence and seeded prototype records | `data/db.json` is prototype persistence, not authoritative | `apps/backoffice/app/crm/leads` | Inspected only; JSON is explicitly excluded from canonical data planning. |
| `/opt/vulpine-drive` | Next.js 14; NextAuth/ZITADEL; PostgreSQL metadata; SFTP/storage; PM2 port 3014 | ZITADEL OIDC and server-side storage/database access | Backoffice Drive module plus `services/documents`; shared auth under `packages/auth` | ZITADEL claim/config patterns extracted into shared auth and permission packages. Storage code is not moved yet. |
| `/opt/vulpine-engine` | Python/FastAPI; PostgreSQL; Redis; n8n; automation and autobid services | Docker Compose exposes Postgres, Redis, n8n, API; standalone source has development credential/CORS defaults | `services/engine` | Source copied without `.env` or runtime state. Unsafe credential/CORS defaults were removed in the copy only. Standalone runtime remains untouched. |
| `/opt/vulpine-bids-tracker` | Express 4, SQLite, PDF extraction, workbook/profit enrichment, static dashboard; working tree already modified | PM2 service on port 4400; `data/bids.db` is authoritative transitional data | Backoffice `/bids/tracker`; later server API consolidation | Source-only snapshot under `legacy/bids-tracker`; runtime DB/uploads excluded. Backoffice uses a protected server-side proxy to the standalone API. |
| `/opt/vulpine-ai` | Next.js 14 frontend for `/api/v1/auto-bid`; overlaps current Vision/Engine scope | Frontend-only API client; contains local environment state outside the snapshot | Audit useful UI into Backoffice bids modules | Source-only snapshot under `legacy/vulpine-ai`; not a workspace or deployment target. |
| cloned Command Center | Next.js 16, React 19, Tailwind 4; dark Vulpine shell and an earlier Node cabinet API prototype | Previously structured as a single root frontend with a VPS API prototype | `apps/backoffice`; prototype retained under `legacy/old-engine-autobid` | Git history preserved. Visual shell remains the Backoffice foundation. |
| `/opt/hermes-webui` | Vendor-managed Python/Node project, Git branch behind upstream | Separate runtime and release lifecycle | `vendor/hermes` boundary only | No source merged. |
| `/opt/quartz` | Vendor-managed Quartz project with local working-tree changes | Separate static documentation runtime | `vendor/quartz` boundary only | No source merged. |

## Locked deployment boundary

```text
Vercel
  apps/web
  apps/backoffice
  apps/portal

Vulpine server
  PostgreSQL / Redis / ZITADEL
  Engine / Vision / AEON
  APIs / workers / n8n
  documents / integrations / business rules
```

The Bids Tracker Backoffice API route is a browser-to-server authorization and proxy boundary. It does not make Vercel the data owner and does not relocate SQLite.

## Conflicts resolved

- The cloned repo references `crm.vulpinehomes.com` and `apps/web`; the explicit consolidation goal supersedes those names with `backoffice.vulpine.llc` and `apps/backoffice`.
- The cloned repo contains an older Node cabinet API. It is retained under `legacy/old-engine-autobid`, not treated as the authoritative Engine.
- Existing Vision and Bids Tracker working trees contain user changes. They were never modified or reset.
