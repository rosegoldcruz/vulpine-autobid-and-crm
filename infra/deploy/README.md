# Managed runtime consolidation

## Cabinet Brain lifecycle

Cabinet Brain remains an independently versioned production integration while its
business database, uploads, evidence and render storage remain in place. Only the
PM2-managed production server owns port 3000. Development and test servers must
bind loopback and have a supervisor with bounded teardown.

The Brain repository's `scripts/next-lifecycle.py` executes Next directly instead
of leaving an npm/shell/server chain. On Linux it sets a kernel parent-death
signal. The integration test waits for actual exit and escalates after five
seconds; it drains output pipes. Both ordinary shutdown and an abruptly killed
runner are exercised against an actual Next listener with isolated test storage.

Install `next-process-monitor.service` and `.timer` in systemd, then enable the
timer. The monitor reads process identity and PM2 metadata without printing
environments. It recognizes named systemd services and reports unmanaged Next
servers as failures. It never kills a process. Inspect ownership, ports, active
connections and service references before cleanup. A successful HTTP probe alone
does not establish absence of duplicate workers.

## Engine API cutover

Use the **existing** Compose project name. Never run a fresh project or replace
database, Redis or n8n volumes to consolidate source code.

Set `ENGINE_API_ENV_FILE` to the existing approved private API environment file
and `ENGINE_UPLOAD_ROOT` to the existing persistent upload directory. Supply the
existing administrative Compose environment with `--env-file`; never print
`docker compose config` or `docker inspect` environments in logs.

```sh
docker compose --project-name vulpine-engine \
  --env-file "$ENGINE_COMPOSE_ENV_FILE" \
  --file services/engine/docker-compose.yml \
  --file infra/deploy/engine-runtime.override.yml \
  config --quiet
docker compose --project-name vulpine-engine \
  --env-file "$ENGINE_COMPOSE_ENV_FILE" \
  --file services/engine/docker-compose.yml \
  --file infra/deploy/engine-runtime.override.yml \
  up --detach --no-deps --no-build api
```

Before cutover, record container identities, environment equality evidence,
source parity, upload hashes and protected-route behavior privately. Afterwards,
verify only the API container changed, PostgreSQL/Redis/n8n IDs and volumes are
unchanged, environment values match exactly, canonical code mounts are read-only,
and health and authorization responses retain their contracts. Roll back using
the recorded previous source mounts and the same image and environment.

The external credential files are retained pending the owner's credential
review. Source consolidation does not authorize rotation, replacement or deletion
of credentials, or changes to SSH access. Do not delete a previous source tree
until all unique code, persistent state and remaining consumer references have
been checked.
