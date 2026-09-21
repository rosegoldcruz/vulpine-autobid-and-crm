# Vision service boundary

Reusable, server-only Vision domain code extracted from the standalone `/opt/vulpine-vision` source snapshot. It owns deterministic project, upload, workbook/PDF metadata, and workflow operations. It does not expose a deployment framework or browser bundle.

Estimator intelligence remains quarantined: unit mix, takeoff, SKU mapping, pricing, export, and `safeToSend` cannot be enabled by this package. `processJob` stops at `unit_mix_review_required`; blocked mutations throw `ESTIMATOR_INTELLIGENCE_DISABLED`.

Backoffice reaches a deployed Vision API through its authenticated `/api/vision/*` proxy. Valérie/AEON chat and voice code is deliberately excluded pending the shared platform agent runtime migration.

Environment variables are names only in `.env.example`; secrets belong in runtime secret storage. `VISION_DATA_DIR` must be an absolute path when set.
