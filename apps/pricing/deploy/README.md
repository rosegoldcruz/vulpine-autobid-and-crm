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
