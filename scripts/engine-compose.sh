#!/bin/sh
set -eu
cd /opt/vulpine-platform
export ENGINE_API_ENV_FILE=/etc/vulpine-platform/engine/api.env
export ENGINE_UPLOAD_ROOT=/var/lib/vulpine-engine-api/uploads
export ENGINE_N8N_WORKFLOWS=/var/lib/vulpine-n8n/workflows
exec docker compose --project-name vulpine-engine \
  --env-file /etc/vulpine-platform/engine/compose.env \
  --file services/engine/docker-compose.yml \
  --file infra/deploy/engine-runtime.override.yml "$@"
