# Current system map

The verified application source/runtime/data map is maintained in
[Completed consolidation](consolidation-status.md). It supersedes the initial
2026-09-20 source snapshots and the partial-migration audit.

First-party source lives in apps/, services/ and packages/ under the canonical
monorepo. PM2/systemd processes use that source; Engine and ERPNext Compose
configuration lives here. Runtime data, credentials, backups and third-party
software remain outside tracked source.

/home and all Vulpine Supply-related locations were excluded from the migration.
