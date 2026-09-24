# Vulpine Documents service

Server-owned document and storage API extracted from the standalone Vulpine Drive application.

The service is not called directly by browsers. Backoffice authenticates the user with ZITADEL,
enforces canonical `drive.read` / `drive.write` capabilities, then proxies an integration-authenticated
request to this service.

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
```

All routes except `/health` require `x-vulpine-integration-key`. The browser never receives this key.
