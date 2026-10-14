#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
: "${ERP_SITE_NAME:?Missing required env var: ERP_SITE_NAME}"
docker compose exec -T backend bench --site "$ERP_SITE_NAME" backup --with-files
