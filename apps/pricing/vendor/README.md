# Plan Studio source

`plan-measure-820e495.zip` is the exact user-supplied Plan Measure 2.10.0 archive, upstream commit `820e495ab975f69f3f798274ebd73b7d27febfc4`.

SHA-256: `f4abf40b656e3b5b7c5094e18cc75ed3c8163b76481fca21c2fc770d9ec7c187`

No source or interface changes were made. Build on Node 24 with `npm ci` then `npm run build -- --base=./` in the extracted source directory. Copy the resulting `dist/` contents into `assets/plan-studio/`, and retain the supplied MIT license as `assets/plan-studio/LICENSE.txt`. The relative deployment base is the only build configuration override.

The prebuilt assets are committed so the existing Node 22 pricing server can deploy through its normal build without installing or executing a second application runtime. The main build copies them to `dist/studio/`.

The outer Pricing shell mounts Studio in a same-origin iframe behind the existing Back Office session and signed asset proxy. The iframe stays mounted during view changes. Studio retains its original device-local IndexedDB persistence and backup/export functionality; this integration does not promise cloud sync or automatic transfer into pricing.
