# Completed runtime consolidation — 2026-10-18

Canonical source and deployment project: `/opt/vulpine-platform`. First-party
production services now execute this project's code, rather than copies in old
application/release directories. `/home` and every Vulpine Supply-related tree
were excluded and untouched. Third-party applications and the organizational
vault remain in their existing locations.

| Application | Monorepo source | Runtime and preserved state | Verification |
| --- | --- | --- | --- |
| Backoffice, MCP, pricing/Drive integration UI | apps/backoffice | Vercel production | Deployment dpl_4kec6QSLjdk1w2N3gUnE64z24DgA READY; seven existing agent identities discover 27 tools. |
| Pricing and bidding worker | apps/pricing | Existing systemd services; existing PostgreSQL and /var/lib/vulpine-cabinet-pricing retained | Build and 26 tests; live saved projects and both health endpoints pass. |
| Cabinet Brain | apps/cabinet-brain | PM2 from this directory; /var/lib/vulpine-vision/autobidder | Build and 197 isolated tests; authenticated real project read passes. |
| AI frontend | apps/ai | PM2 from this directory | Build and live HTTP 200. |
| Leads application | apps/leads | Buildable source; was not a live service before migration | Production build passes; no new public deployment or agent CRM feed added. |
| Documents/Drive API | services/documents | PM2 vulpine-documents-platform, loopback 3017; existing SFTP and PostgreSQL retained | Live nested upload/download/delete and unsafe-manifest rejection pass; fixture removed. |
| Bids Tracker API | services/bids-tracker | PM2 from this directory; /var/lib/vulpine-tracker/data and uploads | Eight tests; authenticated API retains all 44 bids. |
| Engine, PostgreSQL, Redis and n8n | services/engine with infra/deploy override | Same Compose project, original images/environment/named volumes; uploads and workflows moved intact to /var/lib | Container parity verified; Engine/automation health and two auth tests pass. |
| Operations read models | services/operations | systemd from this directory | Ten tests; canonical Brain read model and Engine authentication work. |
| Twilio console | services/twilio | Previously dormant; container image and external-state Compose configuration now in monorepo | Five tests, Docker build, real image root and authenticated login pass. No calls/messages sent. |
| ERPNext | infra/erpnext | Already used canonical Compose; vendor image/data retained | No migration of vendor code or volumes required. |

Shared JavaScript dependencies use the root pnpm workspace/store and lockfile.
Application-specific framework versions remain where needed. Production credentials
stay in `/etc/vulpine-apps`, `/etc/vulpine-operations`, `/etc/vulpine-bidding` and
`/etc/vulpine-platform/engine` (plus preserved AI build settings under
/etc/vulpine-platform/ai); no raw values were added to Git. SQLite, uploads,
workflow runtime files and existing database volumes remain outside tracked source.

Pricing, Cabinet Brain and Tracker source history was imported after removing
runtime databases/secrets from imported paths. Exact original history is also
preserved in private, verified Git bundles. The initial Brain history filter
wrongly excluded an API route named uploads; the route and its complete source
history were restored, and the full isolated suite passes. Old checkout changes
were reconciled against the newer source; their exact originals remain in recovery.

## Verified recovery and removal

Recovery root: `/opt/vulpine-backups/consolidation-20261018T145741Z`. Nineteen source archives passed compressed
stream integrity and SHA256 checks. Needed original source files were verified
against the archives; SQLite recovery passed integrity_check and PostgreSQL
custom dumps passed pg_restore manifest verification. Private runtime configuration
and PostgreSQL role recovery are included. No off-host backup claim is made.

Each application tree was checked for active process, PM2, systemd and container
references before removal. `infra/consolidation/result.json` identifies every
removed location, its replacement and its verified recovery archive/hash. Eighteen
application/release directories and two obsolete root files were removed:

- `/opt/vulpine-cabinet-pricing`
- `/opt/vulpine-vision`
- `/opt/vulpine-bids-tracker`
- `/opt/vulpine-drive`
- `/opt/vulpine-engine`
- `/opt/vulpine-ai`
- `/opt/vulpine-leads`
- `/opt/twilio-app`
- `/opt/cabinet-backoffice-check`
- `/opt/vulpine-mcp-workspace-check`
- `/opt/vulpine-bidding-check`
- `/opt/vulpine-releases`
- `/opt/security-stage/platform`
- `/opt/security-releases/2026-10-07/vulpine-documents-2`
- `/opt/security-releases/2026-10-07/vulpine-drive-3`
- `/opt/security-releases/2026-10-07/vulpine-drive-2`
- `/opt/security-releases/2026-10-07/vulpine-ai`
- `/opt/security-releases/2026-10-07/vulpine-drive`
- `/opt/autonomous-lead-to-client-pipeline.zip`
- `/opt/package-lock.json`

The standalone Drive and Tracker hostnames remain retired (410); their gated
Backoffice modules and stored data remain active. Historical Drive frontend source
is retained only under legacy/drive; it is not a deployed standalone application.
The obsolete duplicate legacy/vulpine-ai source copy was replaced by apps/ai.

Run `python3 scripts/verify-consolidation.py` for current runtime/path checks.
Use `scripts/engine-compose.sh` for Engine deployments; private PM2 settings are
loaded through infra/deploy/ecosystem.platform.config.cjs. Tests/builds must not
replace an active Next build: Cabinet Brain's test command uses an isolated copy.

Existing provider limits are separate from consolidation: inbox authorization and
ZITADEL management enrollment still require valid provider credentials. Hosted
AI accounts on other devices are not configured by this server migration.
