# Vulpine cabinet pricing

Private Shaker and Euro purchase-price configurator using the fixed 0.204 factor. Includes complete cabinets, components, scribe, trim, molding, crown, fillers, panels, toe kicks, kits and other priced catalog entries. The original email-shareable Excel is available from the site.

## Run

Requires Node.js 22 or later. PDF generation uses the pinned pdf-lib package, bundled locally into the deployed site. No application credentials are required in the frontend.

```
npm ci
npm test
npm run build
```

Serve `dist/` with a static HTTP server. Deploy to Vercel as an Other/static project with `npm run build` and output directory `dist`. All app resources use the site root.

## Access

Keep the GitHub repository private. Vercel Authentication must cover **All Deployments**, including the production domain, before publishing any files. Privacy is enforced by the Vercel project setting, not by robots.txt. Do not disable protection or create public bypass links. No credentials belong in this repository, build output, or browser code.

## Pricing and quotes

`src/catalog.json` is the single site pricing source: 288 Shaker records and 222 Euro records, including aliases and combined Shaker pantry/oven assemblies. All numeric prices already have the 0.204 factor applied and are rounded to cents. Never multiply again. Euro cabinet costs include box plus the selected front tier. Complete Shaker PC/OC prices include BOX plus FFD; separate components also remain selectable.

The workflow is Configure units -> Review & margin -> Generate PDF. Each unit type has its own cabinet quantities, finish selections, toe-kick mode and repeat count. Duplicate layouts, edit quantities or set repeat/item quantities to zero to exclude them. Drafts persist in localStorage on that browser/device only. Required accessories must exist within the same unit. Automatic toe kicks use retained template widths and 96-inch sticks per unit and finish; verify cuts and waste. Manual TK8 entries are suppressed while Auto is enabled.

Gross margin choices range from 1% through 50% in both a dropdown and radio group, with all scenarios available for comparison. Selling price is purchase cost / (1 - margin), rounded to cents per item before multiplying quantities. The displayed realized margin accounts for cent rounding. Margin is not markup.

PDF output uses the user's four-page `10112026.pdf` proposal design. `assets/proposal-template.pdf` preserves its artwork and labels while removing old date and preparer text for dynamic filling. Pages 1, 2, populated 3, and 4 print in that order. Schedule overflow continues before the closing page; internal financial reports or full-length notes appear before the closing page as needed. Page 3 fills product/unit/quantity/price/total/count fields and the investment summary and snapshot. Hardware counts remain estimates, with no added handle price. General specification fields refer to the selected catalog; no unsupported construction specifications are invented.

The preparer dropdown contains Daniel Cruz and Mike Musonda. Generation dates are stamped beneath the top-right gold line; validity is always 45 local calendar days from the actual generation click, independent of a stale draft date. Customer PDFs exclude purchase costs/profit, supplier schedules use purchase prices, and internal PDFs include financial detail with an optional 50-scenario appendix. PDFs generate locally, download directly, and expose a Gmail compose link. The user attaches the PDF and sends it manually; no email or order is automatically submitted.

No additional markup, tax, freight, assembly or installation is applied. Priced service entries count only when added explicitly. Missing prices stay unavailable: Euro BLS36-Tray, and Mountain Timber MIRROR2430, MIRROR3030, WMC3030, WMC3036 and WMC3042. Slim Shaker glass doors cannot be quoted. Confirm the Euro B24FHD door layout with the vendor.

Source editions: `HighlandCabinetryCO_ShakerCatalog_v8-03252026re.pdf`, pricing pages 35–39; `EURO-CATALOG-v3.11.10.25-RE.pdf`, PDF pricing pages 15–25. These are fixed catalog editions, not a live pricing feed.
