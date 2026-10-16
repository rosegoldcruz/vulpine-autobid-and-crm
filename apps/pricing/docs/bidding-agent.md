# Vulpine bidding agent access

Pricing: https://backoffice.vulpine.llc/api/cabinet-pricing/index.html

Remote MCP endpoint: https://api.vulpinehomes.com/bidding/mcp

Protected-resource metadata: https://api.vulpinehomes.com/bidding/.well-known/oauth-protected-resource

## Implementation

The official MCP SDK serves Streamable HTTP. Seventeen tools use the existing pricing engine and PDF/Excel generators: `create_bid_job`, `get_bid_job`, `extract_takeoff`, `set_unit_mix`, `search_catalog`, `update_bid_items`, `price_bid`, `validate_bid`, `save_bid`, `export_bid`, `list_bid_jobs`, `list_projects`, `get_project_quote`, `get_project_document`, `save_bid_to_project`, `set_bid_margin`, `set_project_quote_margin`.

Postgres database `vulpine_bidding` holds owned jobs, CAS revisions, source evidence, audit records, queued runs, catalog snapshots and expiring exports. Existing workspace files remain intact; `agent/import-workspace.mjs --run` imports additive snapshots. It is idempotent for an unchanged workspace.

Every new job revision retains its payload in `bid_job_revisions` for recovery. Recovery is currently an administrative database operation; the UI does not yet expose a revision browser.

`extract_takeoff` accepts either an existing `source_id`, or `name`, `expected_revision` and exactly one of `text` / `pdf_base64`. Uploads require write permission and advance the job revision. Both the mobile upload and MCP tool use the same PDF extraction implementation.

The Obsidian page `projects/Vulpine Pricing and Agent Access.md` is indexed in the existing vault and synced to Postgres every five minutes. Only this explicit page is included; personal vault content is excluded. Authorized MCP readers can retrieve it through `vulpine://pricing-memory`. Memory notes cannot change pricing rules. The dedicated daily database backup timer writes private archives to `/var/backups/vulpine-bidding` and verifies their archive manifests; this is a local backup, not offsite disaster recovery.

Auto Bid in Pricing starts the persistent server worker. Saved bids open in the ordinary Pricing interface through `?bid=<id>`. Edits to these jobs save back to Postgres without overwriting the original workspace draft. The worker uses the OpenAI Responses API and the same tool handlers exposed by MCP. Agents cannot submit catalog prices or arbitrary SKUs. They can set user-requested margins through the dedicated revision-checked tools. Human edits retain the normal pricing controls.

Uploads accept a schedule PDF up to 2 MB, or text/CSV. PDF text extraction uses installed `pdftotext`; scanned plans without text require a human takeoff. Plan-derived quantities are flagged and block agent export until a human reviews them in the source evidence panel. The assistant never sends customer messages or places orders. Export links are unguessable bearer capabilities, expire after 15 minutes, and are not access-logged by Nginx. Downloaded files remain on the recipient's device.

## Verified and blocked

The database/tool integration test covers ownership and organization isolation, read-only permission enforcement, stale revisions, unknown SKU and price-input rejection, canonical pricing, five-page PDF, XLSX, official SDK tool discovery, and authenticated Streamable HTTP tool calls. Existing pricing/export regressions remain separate in `npm test`.

The supplied Longmont II workbook was also exercised through the new tools: 85 units, purchase $129,994.21, sell $166,658.68 at 22%, and a five-page customer PDF. The current saved workspace is a later snapshot with different quantities; its own $130,735.93 purchase and $167,609.56 sell totals were preserved exactly during import. These are separate snapshots, not interchangeable totals.

The real OpenAI worker acceptance request returned HTTP 429 `credit_balance_exhausted` on 2026-10-14 (Phoenix). No completed live AI run is claimed. Restore API credits in https://platform.openai.com/settings/organization/billing before rerunning `TEST_OPENAI=1 node --env-file=/etc/vulpine-bidding/runtime.env --test tests/bidding.integration.mjs`. API billing is separate from ChatGPT subscriptions. A smaller model such as `gpt-6-luna` can reduce experiment costs after funding; it cannot bypass an exhausted balance.

ChatGPT OAuth was connected on 2026-10-15 (Phoenix) as **Vulpine Pricing MCP – ChatGPT**. A real ChatGPT conversation listed the project workspace, opened Longmont quote `VP-20261015-LII-HCI-ABC114` revision 7, then retrieved the existing archived QA customer PDF because Longmont had no retained PDF. QA quote `VP-20261015-9A5A1204` remained revision 9; its PDF belongs to revision 4. The stored bytes' independently calculated SHA256 matched the MCP result. No quote was created, restored, repriced or modified. Claude and MCP Inspector have not been tested. Existing Back Office sessions continue using signed internal requests.

## Zitadel configuration

Use dedicated authorization-code + PKCE S256 clients with refresh-token support and the exact redirect URI shown by the client. Enable JWT access tokens and access-token role claims. Tokens must pass signature, audience, issuer, expiry, subject, allowed client ID, and organization-bound project-role checks. A separate API application using Basic authentication verifies the token at Zitadel's introspection endpoint. It must be active and match the JWT subject/client. This server-side verifier credential is never provided to ChatGPT.

Zitadel omits scopes from JWT access tokens and drops unrecognized custom scopes such as `bids.read`. Use the supported scopes `openid`, `offline_access`, `urn:zitadel:iam:org:project:id:<project-id>:aud`, and `urn:zitadel:iam:org:projects:roles` as ChatGPT base scopes. The server requires the audience and role scopes in the introspection response, then maps organization-bound pricing roles to internal `bids.read` / `bids.write` permissions. Admin, estimator, operations and nbc can write; executive, finance and sales remain read-only. Other roles are denied. Do not reuse ID tokens or expose the internal HMAC secret. Add only required browser origins to `MCP_ALLOWED_ORIGINS`.

Store `ZITADEL_ISSUER`, `ZITADEL_MCP_AUDIENCE`, `ZITADEL_MCP_CLIENT_IDS`, `ZITADEL_INTROSPECTION_CLIENT_ID`, `ZITADEL_INTROSPECTION_CLIENT_SECRET`, and `MCP_ALLOWED_ORIGINS` in `/etc/vulpine-bidding/runtime.env`, root-owned mode 0600. Restart `vulpine-bidding` after configuration. Health reports configured only when all required OAuth settings exist. Dynamic client registration is disabled; use explicitly registered clients. Never log bearer tokens, verifier secrets, or complete token claims.

## Client connection steps (after OAuth provisioning)

ChatGPT web: open Plugins ? Add ? Add custom MCP server, enter the MCP endpoint, select OAuth, and enter the explicitly registered client ID under Advanced OAuth settings. Configure the supported audience and role scopes above as base scopes, then connect. The installed plugin is named **Vulpine Pricing MCP ? ChatGPT**. Use it in a new conversation to list projects, open saved quotes, and retrieve retained PDFs. Only pricing/bidding tools are exposed. The acceptance test covered read operations; it did not execute live quote writes or test the mobile ChatGPT app.

Claude: Customize → Connectors → Add custom connector. Enter the same endpoint, select OAuth with your registered client, authenticate and enable it in the conversation. Team/Enterprise owners configure the organization connector first. Anthropic documents remote connectors across web, desktop and mobile, but this Vulpine connection has not been tested on those clients. https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

For phone bidding through Vulpine, sign into Back Office in the phone browser, open Pricing → Auto Bid, enter the project/supplier/instructions and create the draft. Review progress and exceptions, open the saved bid, and download the resulting PDF/Excel links. This path still requires the OpenAI API balance blocker to be resolved for AI population.

## Deployment and checks

Use the cabinet repository main branch and the existing Back Office recovery integration branch; do not deploy stale main from the platform repository. Install locked dependencies, build assets, install `deploy/vulpine-bidding.service`, and include `deploy/bidding-nginx.conf` in the existing HTTPS virtual host. Raise only cabinet source-upload ingress to 3 MB. Keep Postgres bound to loopback.

Run `npm test`, `npm run build`, then the real Postgres integration test. The optional live OpenAI test intentionally fails if the API cannot complete the workflow. It does not substitute mocked completions. QA records are removed only from their generated QA organization.


## Project workspace integration (2026-10-15)

`list_projects` and `get_project_quote` access the same organization-scoped Postgres history as the pricing sidebar. `list_bid_jobs` lists the caller's own Auto Bid jobs. `save_bid_to_project` requires write permission, a current saved job revision, and successful validation. It creates a separate editable quote snapshot and stores a customer PDF in the matching project. Each call creates a new snapshot; do not retry blindly. It never replaces a human quote or sends the document. Agent provenance is retained with the snapshot. The internal single-job worker does not receive the organization-wide discovery tools.

Verified against real Postgres and the official MCP SDK: fifteen-tool discovery, project listing, teammate access within the same organization, cross-organization denial, read-only write rejection, stale job protection, saved PDF retention, and signed internal HTTP calls. The external ChatGPT OAuth read-only test also passed as described above.

`get_project_document` retrieves the exact saved PDF/Excel bytes through a 15-minute download link, after checking both organization and quote membership. It supports read-only users and does not regenerate historical files.

## Agent margin editing

`create_bid_job` accepts an optional integer `margin` from 1 to 50 (percentage, not fraction); 20 is only the default. `set_bid_margin` accepts `job_id`, `expected_revision`, and `margin`, preserves costs/items, increments the revision, and marks the draft unsaved. Reprice and save before export. `set_project_quote_margin` accepts `quote_id`, `expected_revision`, and `margin`; it saves a new shared quote revision and returns recalculated totals. Both require write permission. Existing PDF bytes remain attached to their original revisions; changing a margin does not rewrite a previously issued document. Read-only users, cross-organization access, invalid percentages, and stale revisions are rejected. The internal worker may change its assigned bid margin only on an explicit user request.

## Draft export without source-review blocking

Plan-derived unit-mix and quantity review warnings no longer prevent export_bid or save_bid_to_project. Save the current revision first. These tools accept optional scope_notes (up to 10,000 characters) for supplier-pricing gaps, unresolved dimensions, finishes and exclusions. PDFs use the same unmodified Vulpine branded template as the pricing workspace. Draft / priced-scope-only disclosures and review warnings appear in project notes, without banner overlays on the branded pages. Excel exports retain the same disclosure in their project notes. Export does not clear exceptions, approve quantities, send a proposal, change margin, or substitute products. Catalog and pricing errors, stale revisions, tax validation and permission checks still block invalid exports.

## Approved customer appearance

The user selected VP-20261015-9A5A1204_Workspace_QA_customer.pdf as the default visual reference. Customer exports retain the existing gold/black cover, branded introduction, unit-summary schedule and separate project summary/signatures. The Longmont II Lee 20-unit reference has an additional custom itemized schedule; it is not substituted for the selected default summary format. Both MCP export routes call the shared generateQuote renderer directly, with scope disclosures in notes rather than an added page-wide warning strip.
