# Bids Tracker API

This is the authoritative production source. PM2 runs this directory with TRACKER_DATA_DIR=/var/lib/vulpine-tracker/data and TRACKER_UPLOAD_DIR=/var/lib/vulpine-tracker/uploads. The old source and release trees were removed after verified recovery. Data and private recovery archives remain outside Git.

## Access boundary

This service is an API-only backend. The standalone tracker frontend has been
removed; human access is through the ZITADEL-gated Backoffice `/bids/tracker`.
The retired `tracker.vulpine.llc` virtual host returns HTTP 410 for every path;
its versioned tombstone is `infra/nginx/tracker-retired.conf`. Keep that explicit
virtual host to prevent requests falling through to another site.

The service binds loopback. Backoffice calls its API through the existing
integration-authenticated service ingress; requests without the integration
credential fail closed. Preserve the existing database and uploads when deploying
source changes. Do not delete backend storage when retiring a frontend.

The optional email audit importer reads `data/email-audit.json`, containing
`matches`, `unresolved` and optional `companyUpdates` arrays. That customer correspondence stays in ignored,
private runtime storage; it must not be embedded in source or committed. Running
the importer mutates the database and is separate from deploying its source.
