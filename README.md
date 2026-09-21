# Vulpine Platform

Canonical monorepo for Vulpine's product frontends, authoritative server services, shared contracts, infrastructure definitions, and migration records.

## Product surfaces

- `vulpine.llc` — public website (`apps/web`)
- `backoffice.vulpine.llc` — one internal Backoffice (`apps/backoffice`)
- `portal.vulpine.llc` — external partner and customer portal (`apps/portal`)

Vercel hosts frontend applications only. PostgreSQL, ZITADEL, APIs, Vulpine Engine, Vision, AEON, automation, storage, integrations, and workers remain server-owned.

## Commands

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
pnpm dev
```

The first integrated module is Bids Tracker at `/bids/tracker`. It uses a server-side Backoffice proxy to the existing tracker API; the standalone SQLite service remains authoritative during this milestone.

See `docs/architecture/current-system-map.md` and `docs/migration/first-milestone.md` for boundaries and rollout status.
