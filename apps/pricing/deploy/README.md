# Protected backoffice deployment

The standalone Vercel application and the VPS use the same catalog, pricing module,
PDF generator and Excel exporter. No SKU transformations are performed.

The backoffice Pricing module loads the VPS app through an authenticated Next.js
route. Every asset, draft and export request requires a verified Zitadel session
and organization. Read access requires `bids.read`; saving and exporting require
`bids.write`. No app files are placed in the backoffice public directory.

The VPS listens only on 127.0.0.1:3021. Its Nginx `/cabinet-pricing/` route requires
short-lived HMAC claims created by the backoffice proxy, bound to subject,
organization, method, path and request body. Existing Operations signing
configuration is reused; secrets are never sent to the browser.

Install the versioned systemd units using source at `/opt/vulpine-platform/apps/pricing`.
From the monorepo root run `corepack pnpm install --frozen-lockfile`,
`corepack pnpm --filter @vulpine/pricing test` and
`corepack pnpm --filter @vulpine/pricing build`. The old standalone source tree is retired.
Drafts are private per organization and user, stored in the systemd StateDirectory,
and use revision checks to reject stale browser saves. Existing source workbooks
are not overwritten. Standalone local browser drafts migrate from v2/v3 into v4;
drafts on a different website origin cannot be accessed by the backoffice.

Excel exports are populated purchase snapshots: Summary Sheet followed by one
Unit Type sheet per unit. They preserve full SKUs and finish names, per-item
rounded purchase prices, repeat counts and automatic toe kicks. Formulas contain
cached totals for viewers that do not recalculate. The original reference workbook
remains unchanged; its legacy lookup formulas are not a second pricing source.

Verification: `npm test` covers original pricing, workbook round trips, unsigned
and wrong-organization rejection, draft isolation/conflicts, and PDF/Excel exports.

### Prepared-proposal pricing and signatures

New/revised drafts use `pricingPolicy: 2`. Historical quote records and stored
PDFs are retained. Use **Create revised draft** rather than editing an issued
record. Customer-ready exports require GC/company, verified delivery address,
actual apartment mix, cabinet line/finish basis and signed transaction tax or a
documented applicable exemption. Draft PDFs explicitly list missing fields.

Handles sell at 333 cents per decorative door/drawer handle; their supplier
cost is separate. Shipping sells at 13,300 cents per actual apartment plus each
named amenity area once. Use a shared `areaId` for finish segments and islands,
or an explicit `areas` list for a combined amenity schedule. Approved freight
rate overrides require an approval reference. Supplier costs are project totals
in cents; unknown costs remain unverified and cannot support a realized-profit
claim. Identical cabinet assemblies across finishes require reconciliation.

`set_bid_details` exposes the same project/scope/charge fields to all pricing
MCP identities. `price_bid` and `get_project_quote` return charge breakdowns and
specific customer-ready errors. `export_bid` supports `type: draft`; customer
export fails on missing facts. New quote saves retain `_calculation` snapshots.

Install the approved signature outside source at
`/etc/vulpine-platform/pricing/daniel-cruz-signature.png`, owner root, group
`vulpine-proposal-assets`, mode 0640; parent directory mode 0750. Install
`deploy/proposal-assets.conf` as a drop-in for both pricing/bidding services.
The server reads it with supplementary group access. Do not commit the asset.
A proposal must carry explicit `signature.approved` and its exact `quoteId`;
new/revised UI drafts clear signature approval. Placement preserves PNG alpha
and aspect ratio. Customer signature/name/date stay blank.

The shared generator maps the complete supplied artwork to 612 × 792 pt Letter
without added side bands,
uses the approved schedule, wraps scope sections, and appends closing artwork
only after schedules, notes, appendices and acceptance. No customer delivery is
performed by this pipeline.
