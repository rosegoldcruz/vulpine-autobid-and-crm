# Plan Studio source

`plan-measure-820e495.zip` is the exact user-supplied Plan Measure 2.10.0 archive, upstream commit `820e495ab975f69f3f798274ebd73b7d27febfc4`.

SHA-256: `f4abf40b656e3b5b7c5094e18cc75ed3c8163b76481fca21c2fc770d9ec7c187`

Vulpine source overrides are versioned in `plan-studio-overrides/`. After extracting the upstream archive, copy the contents of that directory over the extracted source (preserving paths). Build on Node 24 with `npm ci` then `npm run build -- --base=./` in the extracted source directory. Copy the resulting `dist/` contents into `assets/plan-studio/`, and retain the supplied MIT license as `assets/plan-studio/LICENSE.txt`. The relative deployment base is the only build configuration override.

The prebuilt assets are committed so the existing Node 22 pricing server can deploy through its normal build without installing or executing a second application runtime. The main build copies them to `dist/studio/`.

The outer Pricing shell exposes a Pricing / Plan Studio toggle behind the existing Back Office session and signed asset proxy. Hosted mode opens Studio as a full workspace after pending pricing saves finish; a deployment-only navigation strip returns to Pricing. Standalone mode embeds it. The supplied app is extended by the versioned source overrides. Studio retains its original device-local IndexedDB persistence and backup/export functionality; this integration does not promise cloud sync or automatic transfer into pricing.


## Large PDF, folder and ZIP imports

The overrides raise the PDF ceiling to 1 GiB (shown as 1 GB in the UI), add multiple-file and folder selection, recursive folder drag-and-drop, and streaming ZIP extraction. PDFs are saved as separate library projects with relative path names; importing a batch does not replace the active plan. ZIP input is limited to 1 GiB, expanded PDF content to 2 GiB per batch, and batches to 500 PDFs. Non-PDF entries are skipped; nested ZIPs inside archives are not expanded. Device memory and browser storage quota may impose lower practical limits, especially on phones. Persistence remains browser-local.

Run `npx vitest run src/services/planImport.test.ts src/services/pdf.test.ts src/services/persistence.test.ts src/services/projectFile.test.ts src/app/ProjectLibraryDialog.test.tsx` in the overlaid source before rebuilding. Existing content-hashed assets are retained for already-open browser sessions.
