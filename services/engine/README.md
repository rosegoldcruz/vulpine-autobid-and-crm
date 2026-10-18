# Vulpine Engine

Authoritative Engine source and Compose configuration. The production containers now use this monorepo; the old /opt/vulpine-engine tree has been removed after verified recovery and cutover. Deploy with ../../scripts/engine-compose.sh; credentials are in /etc/vulpine-platform/engine, uploads in /var/lib/vulpine-engine-api/uploads and n8n workflow runtime files in /var/lib/vulpine-n8n/workflows.

The service remains Python/FastAPI. It is intentionally not rewritten for workspace consistency.

Unsafe defaults discovered in the standalone source were removed from this import:

- database and Redis URLs are required environment values;
- CORS defaults to no allowed origins and reads an explicit comma-separated allowlist;
- Compose requires database and n8n passwords instead of supplying fallbacks.

The monorepo copy still must not be deployed until environment values, port ownership, migrations, CORS origins, health checks, and a server deployment runbook are verified against the standalone runtime.
