# Drive transfers through a tunnel

Backoffice retains the existing Drive permissions and signed upload tickets. Small uploads use multipart batches bounded to 64 MiB and 100 files. When a ticket advertises `chunkedUploadVersion: 1`, individual files over 64 MiB use 32 MiB requests, so the whole file can exceed the proxy's per-request body limit.

Deploy the document service before the Backoffice release that advertises this capability. Refresh existing browser tabs after updating Backoffice. An older backend/ticket without the capability retains the original multipart behavior; it requires an origin that accepts that request size.

The document service exposes these authenticated POST operations beneath `/upload/chunks`:

- `/start` validates the file metadata and optional relative folder path, and creates a private disk spool.
- `/:id/chunk?offset=...` accepts a bounded binary body. Chunks append in order; a retry of an acknowledged offset does not duplicate bytes.
- `/:id/finish` starts the existing SFTP save and responds immediately.
- `/:id/status` distinguishes saving, completion, and failure. Upload progress does not imply that remote storage has finished saving.

Every operation requires the existing integration credential or an unexpired upload ticket for the same actor and base path. The SDK renews five-minute tickets during long transfers. Session identifiers grant no access by themselves. Folder manifests retain the existing path validation. The server admits at most eight active upload sessions, reserves temporary disk space, and removes abandoned spools after an hour. Configured upload byte limits still apply. Remote saves share the existing transfer concurrency limit.

`DRIVE_SFTP_TRANSFER_CONCURRENCY` optionally improves transfers to an explicitly tested storage server over a higher-latency connection. The default is 1, retaining the original SFTP behavior; values are capped at 16. When enabled, uploads use the SFTP client's `fastPut` with its default packet size and verify the remote byte count. Downloads prefetch standard byte ranges in order, with bounded memory, backpressure, exact length checks, and cancellation of pending reads when the client disconnects. The maximum prefetch is sixteen 256 KiB blocks per transfer.

Test this setting against the actual storage provider with an upload, complete download, and SHA-256 comparison before enabling it. The [SFTP client's documentation](https://github.com/theophilusx/ssh2-sftp-client#fastputlocalpath-remotepath-options--string) explains that concurrent uploads depend on server support. The [Cloudflare request-body limits](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/) apply per request; chunking does not change the account's plan.

Verification:

```sh
corepack pnpm --filter @vulpine/documents-service typecheck
node --import tsx --test services/documents/tests/*.test.ts tests/drive-*.test.ts
corepack pnpm --filter @vulpine/backoffice build
```

The tests cover actor/path isolation, interrupted and oversized chunks, offsets and retries, bounded admission, async save failures, ticket renewal, a 300 MiB client transfer, ordered concurrent range reads, truncation, and cancellation. A real storage round trip is additional deployment evidence; unit tests alone do not establish provider compatibility.
