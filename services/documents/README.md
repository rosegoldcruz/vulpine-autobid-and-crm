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
- Access history: `vault_ui.access_log` in the documents service PostgreSQL database

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

Before starting a new deployment, run `corepack pnpm --filter @vulpine/documents-service migrate`
with the same server environment as the running documents service. The idempotent
SQL migration creates only its access-history schema/type/table/index; it does not
move or delete stored files. Merely configuring DATABASE_URL does not apply it.

Metadata routes require `x-vulpine-integration-key`. Transfer routes accept either that server-side key or
a five-minute HMAC ticket scoped to the authenticated subject, action, and exact Drive path. Upload and preview CORS are
restricted to `BACKOFFICE_ORIGIN` (production default: `https://backoffice.vulpine.llc`).

Previews stream directly from SFTP and support single HTTP byte ranges and HEAD requests. Stored Unix filenames retain literal backslashes; upload filename sanitization remains separate. Binary formats are returned as bytes for authenticated browser viewers. Unknown formats use a text or hexadecimal preview.


## Folder uploads

The Drive page offers **Upload folder** on desktop and mobile. The browser sends
its directory-relative paths in a `paths` JSON array, in the same order as the
multipart `files`, alongside the existing destination `path`. Parent directories
are created recursively on SFTP; equal filenames in different subfolders remain
separate. Requests without `paths` keep the existing flat-file behavior.

The server validates the entire relative-path manifest before writing: reject
absolute paths, traversal segments, backslashes, control characters, duplicate
paths and mismatched file counts. Upload authentication, destination-scoped tickets,
transfer slots remain enforced. The client batches selections into at most 100
files, targeting 250 MiB per batch; an individual larger file uses its own batch.
Uploads stream into private temporary files and then SFTP, with cleanup on success
and failure. One SFTP connection handles each batch. No artificial upload size
limit applies by default; operators can set DRIVE_UPLOAD_MAX_BYTES when needed.
Single-file downloads stream; folder ZIP downloads retain their configured bounds.
The UI shows browser byte-transfer progress, then a distinct saving-to-Drive
state while the server writes the batch to SFTP. Completed-file counts advance
after batch acknowledgement. The UI can resume the remaining selection after
a failure, including a server-acknowledged partial batch. Keep the tab open; this
is session resume, not cross-reload or byte-range resume. Browser directory selection supplies files and their
ancestor folders; empty directories are not included by that picker.

MCP agents can use the same upload transfer URL and optional multipart `paths`
manifest. No storage credential is included in a transfer URL.
