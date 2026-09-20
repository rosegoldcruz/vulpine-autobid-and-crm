# First consolidation milestone

## Scope completed in source

- Canonical monorepo created at `/opt/vulpine-platform` from the existing Command Center Git history.
- Backoffice shell moved to `apps/backoffice` without replacing its visual system.
- pnpm workspace and shared package boundaries established.
- Current Python/FastAPI Engine copied to `services/engine` without environment secrets or runtime data.
- Bids Tracker and Vulpine AI copied as source-only legacy audit snapshots; original repos remain intact.
- Bids Tracker mounted in Backoffice at `/bids/tracker` with real KPI, chart, table-edit, upload, and delete flows.
- Browser calls terminate at a same-origin Backoffice proxy. The proxy enforces ZITADEL session capabilities and calls the server-owned tracker API from the server runtime.

## No-cutover guarantee

This milestone does not modify DNS, Vercel project linkage, PM2 processes, nginx, PostgreSQL, Redis, n8n, SQLite, or any existing standalone repository. It does not copy Bids Tracker runtime data into the monorepo.

## Required runtime configuration

Backoffice requires the empty keys documented in `apps/backoffice/.env.example`. No value is committed. `BIDS_TRACKER_API_URL` must be reachable from the Backoffice server runtime. ZITADEL roles must use the allowlisted role names in `packages/permissions`.

## Production blockers

- No ZITADEL credentials are available in the current shell environment, so an authenticated end-to-end data mutation was not executed.
- The original Bids Tracker Express API has no native authentication. Keep its public endpoint unchanged for rollback, but restrict it at nginx/network level and add integration-token verification before production Backoffice cutover.
- The copied Engine removes development password fallbacks and wildcard CORS, but its environment, ports, migrations, and health behavior still require a dedicated server verification before deployment.
- Vercel linkage and `backoffice.vulpine.llc` environment configuration are intentionally not changed during this no-cutover milestone.

See `vision-next-step.md` for the next implementation slice.
