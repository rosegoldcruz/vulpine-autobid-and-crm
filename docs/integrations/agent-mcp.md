# Backoffice agent access

Endpoint: `https://backoffice.vulpine.llc/api/mcp` (Streamable HTTP).

The owner's latest explicit grant includes pricing and bid creation/editing,
bids tracker, Cabinet Brain, Bid Engine, takeoffs, Paperclip, automations, Fox,
agents, SKU catalog, proposals, inbox, SMS, dialer, calls, recordings, Valerie,
SOPs, ERPNext, revenue, integrations, services, health, logs, users, permissions
and settings. Drive was subsequently added with owner-approved read/write access. This supersedes the earlier read-only and pricing-only releases.
General leads, contacts, companies, opportunities and project-feed tools remain
excluded. Pricing's `list_projects` means its own saved pricing folders/quotes.
Access does not by itself instruct an agent to send messages, place calls, submit
proposals or order materials.

## Tools and authentication

The gateway forwards the pricing application's 19 native tools to its existing
MCP at `/bidding/agent/mcp`. Agents can create bids, attach source evidence,
set unit mixes and catalog items, calculate, validate, save and export PDF/Excel.
Catalog costs, revisions, source provenance and existing approval gates remain
owned by the pricing engine; the gateway contains no copied pricing math.

Eight additional tools use existing authenticated backends:

- `vulpine_drive`: browse/filter files and folders, preview/download plans, upload
  files and delete files/folders. Small uploads accept base64; large plans use
  the existing five-minute signed multipart upload flow, avoiding the MCP body
  limit. Transfers reuse Drive authentication and path/action-bound tickets.
- `read_aeon_context`: project-selected vault records and engineering continuity,
  with hashes and retrieval time. It does not load an execution skill or begin a
  continuity session. Full private vault browsing is a separate owner web view.
- `backoffice_access`: current identity, grants and supported actions.
- `read_backoffice_module`: operations data with source availability and errors.
- `write_backoffice_record`: existing Fox/SOP record CRUD with stale-write checks.
- `bids_tracker`: list/KPIs, PDF upload, field updates and deletion.
- `cabinet_brain`: JSON operations through the existing route/principal allowlist.
- `backoffice_service`: configured Paperclip, Bid Engine, inbox, Twilio, Valerie,
  ERPNext and ZITADEL provider operations. Provider paths are constrained and
  credential-management endpoints are excluded. Missing authentication fails.

`MCP_CLIENTS_JSON` is a server-only array of `{id, tokenHash, organizationId,
modules, roles}`. Seven independent identities currently have the 28 requested
module grants and the owner-approved admin role. Production stores SHA-256
credential digests. Raw values stay outside Git. Missing/invalid credentials
return 401; absent/malformed registry fails closed. Browser origins require
`MCP_ALLOWED_ORIGINS`. Requests are bounded to 3 MiB; additional backoffice tool results to 500 KB.
Operations signatures bind organization, module, route, method, body and expiry.
Cabinet Brain receives an organization-bound signed principal. Returned credential
fields are redacted; arbitrary outbound hosts and redirects are rejected.

The Bid Engine accepts its private `ENGINE_AGENT_API_KEY` only for its existing
auto-bid API. Operations holds the matching `OPS_ENGINE_API_TOKEN`. Other legacy
Engine APIs remain contained. ERPNext uses a dedicated technical user, provisioned
by `scripts/provision-erp-agent.mjs`, with credentials written directly to its
private operations environment. No credentials are printed or committed.
ZITADEL directory/permission/settings administration remains unavailable until
`OPS_ZITADEL_URL` and `OPS_ZITADEL_MANAGEMENT_TOKEN` are provisioned. Reporting an
agent's own grants is not proof that directory administration works.

## Shared AEON context

`scripts/export-agent-context.mjs` exports only the project-selected notes and
engineering brief into the operations service's protected state directory. The
root-owned `aeon-agent-context` timer refreshes it every minute. This preserves
vault filesystem permissions while allowing the DynamicUser service to return
the approved selection with source hashes and export time. OpenCode and Hermes
have startup reminders pointing to `infra/agents/AEON_CONTEXT.md`. Each runtime
must actually call `read_aeon_context`; transport success does not prove that a
particular model session did so. Muse can discover that same tool directly.

## Local clients

`scripts/agent-mcp.mjs <client-id>` translates MCP stdio messages to the authenticated HTTP endpoint. It reads `~/.config/vulpine-mcp/clients/<client-id>.json` with `{endpoint, token}`. Keep that directory mode 700 and files mode 600. Never put these credentials in repository files or command arguments. The adapter uses Node 22+ native fetch and has no model/provider dependency.

Configuration formats:

- Claude Code and Qwen Code: `mcpServers.vulpine-backoffice = {command: "node", args: [absoluteAdapterPath, clientId]}` in their user settings.
- Codex: `codex mcp add vulpine-backoffice -- node <absoluteAdapterPath> codex`.
- GitHub Copilot CLI: `copilot mcp add vulpine-backoffice -- node <absoluteAdapterPath> copilot`.
- OpenCode: `mcp.vulpine-backoffice = {type: "local", command: ["node", absoluteAdapterPath, "opencode"], enabled: true}`.
- Hermes: `mcp_servers.vulpine-backoffice` with `command: node` and `args: [absoluteAdapterPath, hermes]`.

MetaMuse may continue using its OpenCode connection, per the owner's explicit clarification. The Muse desktop app with the AEON conversation is a separate client and must connect directly to the remote endpoint using its own `muse` identity and credential. It does not depend on OpenCode, Hermes, or the stdio adapter. Do not count OpenCode/Hermes provider configuration as a completed Muse desktop connection.

Restart existing sessions to discover newly configured tools. A transport probe does not certify that a model called a tool correctly.

## Muse desktop — independent direct connection

Muse desktop uses its own `muse` identity, independent of OpenCode and Hermes.
Endpoint and transport are the same as above. Enroll the private Muse credential
only through its native secure API-key connector page, never in chat, source,
command arguments or URLs. The owner supplied a transcript reporting enrollment;
server-side verification independently confirms this identity's live tools and
context access. The desktop account/window itself is outside this server session.
Refresh the connector to discover changed tools.

If a credential was pasted in a separate chat, assess and rotate that credential
through the private enrollment flow; deleting a message does not revoke a key.
No raw value from that reported incident was available in this task's attachment.

## Client boundaries and verification

Codex, Claude Code, Qwen Code, OpenCode, GitHub Copilot CLI and Hermes have local
configs with separate credentials. MetaMuse may continue through OpenCode. Muse
desktop has a separate direct identity. Hosted ChatGPT/Claude, other-device
Cursor, GitHub-hosted agents and standalone Grok/Grokbot accounts are not thereby
enrolled; their actual account/runtime setup remains separately unverified.

Live production verification on 2026-10-18 initialized all seven identities,
discovered 24 tools and 27 grants each, and retrieved the same four selected
vault records. Pricing catalog/saved quotes, the tracker (44 bids), Cabinet Brain,
Paperclip, automations, Bid Engine stats and ERPNext quotations responded. Muse also created, priced and saved a disposable draft, downloaded
verified PDF and Excel exports, then removed only that draft while retaining its
audit trail. A tracker update preserving the existing status passed with 44 bids
retained. Twilio SMS/number/call/recording and Valerie assistant reads passed.
Inbox provider authentication currently returns 401 and needs credential repair. Keep
credential values and customer record content out of connectivity logs.

Relevant regression checks: `tests/mcp.test.ts`, `tests/agent-access.test.ts`,
`services/operations/test/agent-actions.test.mjs`, and Engine authentication tests.
A read probe does not prove provider mutations; verification should exercise a
clearly labeled disposable pricing draft and download its PDF/Excel, while leaving
real customer records and communications untouched.


## Drive and bid deletion verification — 2026-10-18

Owner's final scope is Drive read **and write**, superseding the intermediate
read-only correction. All seven configured identities discovered `vulpine_drive`
and listed real storage. Muse uploaded, previewed, downloaded and deleted a
uniquely named disposable text file; the large-plan multipart transfer-ticket
flow also passed. The verification file was removed. `DRIVE_API_URL` and
`DRIVE_API_TOKEN` reuse the existing server-only Drive connection. Raw service
credentials are never returned to agents. Transfer URLs expire in five minutes.

Pricing now exposes `delete_bid` and `delete_project_quote`, bringing production
tool discovery to 27 (19 pricing plus 8 backoffice tools). Read the current object
and pass `expected_revision`. Auto Bid deletion is owner-scoped; project-quote
deletion is organization-scoped. Active runs block deletion; saved copies are
independent. UI Delete bid buttons use the same backend contracts. Old active
editors do not recreate deleted bids, and old source download links stop working.
These changes are maintained in the independent vulpine-cabinet-pricing repository.

Live cleanup through Muse's MCP identity removed its explicitly labeled demo job
and two Workspace QA quotes. Other records remained. The empty QA project was
moved to the existing project Trash. Disposable database/browser tests use unique
fixture organizations and clean their own rows; no additional customer bids were
created by Drive verification.


Folder uploads are supported by the existing Drive transfer endpoint: include
`paths` as a JSON array of relative filenames, in multipart file order. Nested
parents are created and duplicate basenames in different subfolders stay separate.
The destination-scoped transfer ticket still applies. Unsafe manifests are rejected
before writes. The backoffice Upload folder picker uses this contract and batches
larger selections into 100-file batches with a 250 MiB target; a larger individual
file gets its own batch. Uploads spool to private temporary disk and stream to
SFTP. Single-file downloads stream as well. UI progress and Resume upload retain
remaining files after an acknowledged partial failure while the tab stays open.
The standalone drive.vulpine.llc website is retired (410); Backoffice Drive and
shared storage remain active.
