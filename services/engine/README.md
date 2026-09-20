# Vulpine Engine

Source-only import from `/opt/vulpine-engine` at the start of the platform consolidation. The standalone repository and its running services remain untouched and authoritative until a separately verified server cutover.

The service remains Python/FastAPI. It is intentionally not rewritten for workspace consistency.

Unsafe defaults discovered in the standalone source were removed from this import:

- database and Redis URLs are required environment values;
- CORS defaults to no allowed origins and reads an explicit comma-separated allowlist;
- Compose requires database and n8n passwords instead of supplying fallbacks.

The monorepo copy still must not be deployed until environment values, port ownership, migrations, CORS origins, health checks, and a server deployment runbook are verified against the standalone runtime.
