# Vulpine Platform

Canonical monorepo for Vulpine's product frontends, authoritative server services, shared contracts, infrastructure definitions, and migration records.

## Applications and services

- `apps/backoffice`: ZITADEL-gated Backoffice, MCP, Drive and service integration UI
- `apps/pricing`: cabinet pricing, proposals, saved bids and bidding agent
- `apps/cabinet-brain`: plan ingestion, Cabinet Brain and its authoritative workflow
- `apps/ai`: existing Engine frontend
- `apps/leads`: preserved Leads application (not deployed before consolidation)
- `services/documents`, `services/bids-tracker`, `services/operations`, `services/engine`
- `services/twilio`: preserved SMS/voice console with its container deployment
- `packages/*`: shared authentication, permissions, configuration, contracts and SDK

Vulpine Supply and /home are outside this consolidation and remain untouched.
Runtime data and credentials stay outside tracked source. Vendor applications
retain their own lifecycles.

## Commands

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build                         # Backoffice
corepack pnpm test                          # platform and service checks
corepack pnpm --filter @vulpine/pricing build
corepack pnpm --filter @vulpine/pricing test
corepack pnpm --filter @vulpine/cabinet-brain build
corepack pnpm --filter @vulpine/cabinet-brain test # isolated build and tests
python3 scripts/verify-consolidation.py
scripts/engine-compose.sh config --quiet
```

[Consolidation evidence, runtime/state locations and removed copies](docs/architecture/consolidation-status.md)
are recorded with machine-readable recovery references in infra/consolidation/result.json.
