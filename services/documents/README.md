# Vulpine Documents service

Server-owned document and storage API extracted from the standalone Vulpine Drive application.

Backoffice authenticates the user with ZITADEL and enforces canonical `drive.read` / `drive.write`
capabilities. Metadata requests remain server-to-server. Backoffice issues short-lived, action/path-scoped
transfer tickets for uploads, previews, and downloads so large file bytes do not pass through Vercel and
the browser never receives the master integration credential.

## Runtime

- Default bind: `127.0.0.1:3016`
- Public ingress: `https://api.vulpinehomes.com/documents/*`
- Authoritative storage: the existing SFTP Storage Box
- Access history: the existing `vault_ui.access_log` PostgreSQL table

## Required server environment

```text
DRIVE_API_TOKEN
SFTP_HOST
SFTP_PORT
SFTP_USERNAME
SFTP_PASSWORD
DATABASE_URL
BACKOFFICE_ORIGIN
```

Metadata routes require `x-vulpine-integration-key`. Transfer routes accept either that server-side key or
a five-minute HMAC ticket scoped to the authenticated subject, action, and exact Drive path. Upload CORS is
restricted to `BACKOFFICE_ORIGIN` (production default: `https://backoffice.vulpine.llc`).
