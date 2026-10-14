# Vulpine cabinet pricing

Private Shaker and Euro purchase-price configurator using the fixed 0.204 factor. Includes complete cabinets, components, scribe, trim, molding, crown, fillers, panels, toe kicks, kits and other priced catalog entries. The original email-shareable Excel is available from the site.

## Run

Requires Node.js 22 or later. No runtime dependencies or application credentials.

```
npm test
npm run build
```

Serve `dist/` with a static server, or open `dist/index.html` directly for offline pricing. The Excel download link uses the hosted site root. Deploy to Vercel as an Other/static project with `npm run build` and output directory `dist`.

## Access

Keep the GitHub repository private. Vercel Authentication must cover **All Deployments**, including the production domain, before publishing any files. Privacy is enforced by the Vercel project setting, not by robots.txt. Do not disable protection or create public bypass links. No credentials belong in this repository, build output, or browser code.

## Pricing and quotes

`src/catalog.json` is the single site pricing source: 288 Shaker records and 222 Euro records, including aliases and combined Shaker pantry/oven assemblies. All numeric prices already have the 0.204 factor applied and are rounded to cents. Never multiply again. Euro cabinet costs include box plus the selected front tier. Complete Shaker PC/OC prices include BOX plus FFD; separate components also remain selectable.

The quote can contain multiple finishes. Add required matching components before export. Automatic toe kicks use retained template cabinet widths and 96-inch sticks, grouped by finish; verify cuts and waste. Manual TK8 entries are suppressed while automatic mode is enabled. CSV export and printing operate locally in the browser. Export quotes before refreshing or closing the page.

No additional markup, tax, freight, assembly or installation is applied. Priced service entries count only when added explicitly. Missing prices stay unavailable: Euro BLS36-Tray, and Mountain Timber MIRROR2430, MIRROR3030, WMC3030, WMC3036 and WMC3042. Slim Shaker glass doors cannot be quoted. Confirm the Euro B24FHD door layout with the vendor.

Source editions: `HighlandCabinetryCO_ShakerCatalog_v8-03252026re.pdf`, pricing pages 35–39; `EURO-CATALOG-v3.11.10.25-RE.pdf`, PDF pricing pages 15–25. These are fixed catalog editions, not a live pricing feed.
