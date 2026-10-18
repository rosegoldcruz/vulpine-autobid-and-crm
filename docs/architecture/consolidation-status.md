# Consolidation status — verified 2026-10-18

The canonical platform repository is `/opt/vulpine-platform`, but repository and
runtime consolidation are incomplete. The Backoffice shell does not establish
that every integrated service lives in this repository. Release directories are
running deployments, not automatically disposable duplicate source.

| Component | Canonical/current source | Observed live runtime | Remaining boundary |
| --- | --- | --- | --- |
| Backoffice, MCP and Drive UI | platform/apps/backoffice | Vercel production | Production deployment sourced from platform; current Drive folder-upload code is deployed. |
| Documents storage API | platform/services/documents | PM2: /opt/security-releases/2026-10-07/vulpine-documents-2 | Live source copied from platform; deployment still uses a separate release. |
| Tracker API | platform/services/bids-tracker | PM2: /opt/vulpine-releases/platform-2026-10-07/tracker/server.js, working directory security-2026-10-07/tracker | Release and persistent SQLite/uploads must be mapped before removal. |
| Cabinet Brain / Vision | Separate versioned integration | PM2: /opt/vulpine-releases/security-2026-10-07/vision-2 | Not fully migrated into platform. |
| Pricing and bidding worker | /opt/vulpine-cabinet-pricing | Two systemd services in that repository | Active independent GitHub repository; not yet consolidated into platform. |
| Operations integration | platform/services/operations | systemd in canonical source directory | Already runs from platform. |
| Engine API | platform/services/engine | Docker Compose uses canonical source mounts | Persistent uploads still mount /opt/vulpine-engine/uploads. |
| PostgreSQL and n8n | Existing engine Compose lifecycle | Docker labels reference /opt/vulpine-engine | DB mounts init.sql; n8n mounts n8n_workflows from old tree; named data volumes retained. |
| ERPNext | platform/infra/erpnext | Canonical Compose configuration, persistent Docker volumes | Data remains outside Git by design. |
| AI frontend | /opt/vulpine-ai and its historical release | PM2: /opt/security-releases/2026-10-07/vulpine-ai | Active old frontend; not a confirmed deletion candidate. |
| Quartz / Obsidian | Separate vendor viewer and organizational vault | Separate lifecycle | Shared knowledge and vendor code, not duplicate Drive storage. |
| Paperclip | /opt/paperclip | Separate systemd service | Vendor application, not a platform copy. |

`/opt/vulpine-drive` has no active standalone frontend: hostname returns 410.
Retiring that frontend did not remove Backoffice Drive or its SFTP files.
`vulpine-mcp-workspace-check` is an old pricing checkout with five tracked modified
files; it cannot be discarded based only on its name. Other backup/recovery/check
folders have not yet been proven redundant. No folders were deleted in this audit.

Remaining consolidation requires source/history reconciliation, reproducible
release deployment from the canonical repository, consumer-reference checks,
persistent-data separation and verified service cutovers. Only then can redundant
source/checkouts be removed. Moving data or shutting down active services merely
to reduce the number of folders would not complete consolidation.

## Drive failure corrected during this audit

The service DATABASE_URL connected successfully but had no vault_ui.access_log.
Root storage listing worked while Recent and access-history writes failed with
PostgreSQL 42P01. Added an idempotent SQL migration and documented migrate command;
applied to the running service database without changing stored files. Repeated
migration and transactional write/read/rollback passed. Live listing, access
logging, Recent (2500 bounded entries) and a literal-backslash folder listing
returned HTTP 200. The screenshot's missing folder button is consistent with older browser code.
The deployed Drive component SHA1 exactly matches canonical source containing
Upload folder and progress/resume; the current production deployment remains dpl_DxkqTmyQXx6U2xZ1T1JEdecTdvrz.
The user's existing browser tab must reload to obtain deployed UI changes.
