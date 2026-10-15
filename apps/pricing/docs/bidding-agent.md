# Vulpine bidding agent access

Pricing: https://backoffice.vulpine.llc/api/cabinet-pricing/index.html

Remote MCP endpoint: https://api.vulpinehomes.com/bidding/mcp

Protected-resource metadata: https://api.vulpinehomes.com/bidding/.well-known/oauth-protected-resource

## Implementation

The official MCP SDK serves Streamable HTTP. Ten tools use the existing pricing engine and PDF/Excel generators: `create_bid_job`, `get_bid_job`, `extract_takeoff`, `set_unit_mix`, `search_catalog`, `update_bid_items`, `price_bid`, `validate_bid`, `save_bid`, `export_bid`.

Postgres database `vulpine_bidding` holds owned jobs, CAS revisions, source evidence, audit records, queued runs, catalog snapshots and expiring exports. Existing workspace files remain intact; `agent/import-workspace.mjs --run` imports additive snapshots. It is idempotent for an unchanged workspace.

The Obsidian page `projects/Vulpine Pricing and Agent Access.md` is indexed in the existing vault and synced to Postgres every five minutes. Only this explicit page is included; personal vault content is excluded. Authorized MCP readers can retrieve it through `vulpine://pricing-memory`. Memory notes cannot change pricing rules. The dedicated daily database backup timer writes private archives to `/var/backups/vulpine-bidding` and verifies their archive manifests; this is a local backup, not offsite disaster recovery.

Auto Bid in Pricing starts the persistent server worker. Saved bids open in the ordinary Pricing interface through `?bid=<id>`. Edits to these jobs save back to Postgres without overwriting the original workspace draft. The worker uses the OpenAI Responses API and the same tool handlers exposed by MCP. Agents cannot submit prices, margins or arbitrary SKUs. Human edits retain the normal pricing controls.

Uploads accept a schedule PDF up to 2 MB, or text/CSV. PDF text extraction uses installed `pdftotext`; scanned plans without text require a human takeoff. Plan-derived quantities are flagged and block agent export until a human reviews them in the source evidence panel. The assistant never sends customer messages or places orders. Export links are unguessable bearer capabilities, expire after 15 minutes, and are not access-logged by Nginx. Downloaded files remain on the recipient's device.

## Verified and blocked

The database/tool integration test covers ownership and organization isolation, read-only permission enforcement, stale revisions, unknown SKU and price-input rejection, canonical pricing, two-page PDF, XLSX, official SDK tool discovery, and authenticated Streamable HTTP tool calls. Existing pricing/export regressions remain separate in `npm test`.

The supplied Longmont II workbook was also exercised through the new tools: 85 units, purchase $129,994.21, sell $166,658.68 at 22%, and a two-page customer PDF. The current saved workspace is a later snapshot with different quantities; its own $130,735.93 purchase and $167,609.56 sell totals were preserved exactly during import. These are separate snapshots, not interchangeable totals.

The real OpenAI worker acceptance request returned HTTP 429 `credit_balance_exhausted` on 2026-10-14 (Phoenix). No completed live AI run is claimed. Restore API credits in https://platform.openai.com/settings/organization/billing before rerunning `TEST_OPENAI=1 node --env-file=/etc/vulpine-bidding/runtime.env --test tests/bidding.integration.mjs`. API billing is separate from ChatGPT subscriptions. A smaller model such as `gpt-6-luna` can reduce experiment costs after funding; it cannot bypass an exhausted balance.

Remote Zitadel OAuth client provisioning is still required. Do not claim external ChatGPT, Claude or MCP Inspector OAuth tests passed. The endpoint rejects remote access while `ZITADEL_MCP_AUDIENCE` and `ZITADEL_MCP_CLIENT_IDS` are absent. Existing Back Office sessions continue using its verified Zitadel session and signed internal requests.

## Zitadel setup required

Create dedicated OAuth clients for ChatGPT and Claude with authorization-code + PKCE S256 and refresh-token support, using the exact redirect URIs displayed by each client. Configure the bidding resource audience, allowed client IDs, project role claims and scopes `bids.read` / `bids.write`. Tokens must contain the configured audience, issuer, expiry, subject, authorized client ID and organization-bound project roles. The verifier accepts JWT access tokens; configure Zitadel accordingly. Do not reuse ID tokens or expose the internal HMAC secret. Restrict write access to admin, estimator, operations and nbc roles; executive, finance and sales remain read-only. Add only required browser origins to `MCP_ALLOWED_ORIGINS`.

Store credentials only in `/etc/vulpine-bidding/runtime.env`, root-owned mode 0600. Restart `vulpine-bidding` after configuration. Test a real issued token's scope and organization claims before connecting production clients. Dynamic client registration has not been enabled; use explicitly registered OAuth clients.

## Client connection steps (after OAuth provisioning)

ChatGPT web: in an eligible Business or Enterprise/Edu workspace, open Plugins → plus → Add custom MCP server. Enter the endpoint above, configure OAuth, review the warning, create the plugin and authenticate. Review the ten tools, install, then make a real read/write draft test in a new conversation. The current documentation says custom MCP connections are web-only; Pro is limited to read/fetch. https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

Claude: Customize → Connectors → Add custom connector. Enter the same endpoint, select OAuth with your registered client, authenticate and enable it in the conversation. Team/Enterprise owners configure the organization connector first. Anthropic documents remote connectors across web, desktop and mobile, but this Vulpine connection has not been tested on those clients. https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

For phone bidding through Vulpine, sign into Back Office in the phone browser, open Pricing → Auto Bid, enter the project/supplier/instructions and create the draft. Review progress and exceptions, open the saved bid, and download the resulting PDF/Excel links. This path still requires the OpenAI API balance blocker to be resolved for AI population.

## Deployment and checks

Use the cabinet repository main branch and the existing Back Office recovery integration branch; do not deploy stale main from the platform repository. Install locked dependencies, build assets, install `deploy/vulpine-bidding.service`, and include `deploy/bidding-nginx.conf` in the existing HTTPS virtual host. Raise only cabinet source-upload ingress to 3 MB. Keep Postgres bound to loopback.

Run `npm test`, `npm run build`, then the real Postgres integration test. The optional live OpenAI test intentionally fails if the API cannot complete the workflow. It does not substitute mocked completions. QA records are removed only from their generated QA organization.
