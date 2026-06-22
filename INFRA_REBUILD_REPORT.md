# Vulpine Command Center Infrastructure Rebuild Report

Date: 2026-06-22
Server: CX53-Vulpine-32GB-320GB
Repo: /opt/vulpine-command-center
Branch: main
Remote: git@github.com:rosegoldcruz/vulpine-autobid-and-crm.git

## Summary

Infrastructure stabilization is complete enough to proceed after final product sign-off: Postgres, the Cabinet Bid Engine API, nginx, SSL, NocoDB, n8n, and the Vercel production frontend were all verified.

No Cabinet Bid Engine Phase 2 work was started. `cabinet_knowledge/` was not touched. Zitadel was not recreated. No Google Vertex, Gemini, fake webhook URL, or fake claim was introduced.

## Services

| Component | Status | Verified Result |
|-----------|--------|-----------------|
| PostgreSQL 16 | Running | `PostgreSQL 16.14`; `listen_addresses=localhost`; config at `/etc/postgresql/16/main/postgresql.conf` |
| Cabinet API backend | Running | PM2 service `vulpine-command-center-api` online; `GET http://127.0.0.1:4000/health` -> `200 {"status":"ok"}` |
| nginx | Running | `nginx -t` successful; reverse proxy active for API and n8n |
| NocoDB | Running | Container `vulpine-nocodb` up; `GET http://127.0.0.1:8080` -> `200` |
| n8n | Running | Container `vulpine-n8n` up; `GET http://127.0.0.1:5678` -> `200`; `GET https://n8n.vulpinehomes.com` -> `200` |
| SSL | Configured | Let's Encrypt cert covers `api.vulpinehomes.com` and `n8n.vulpinehomes.com`; expires 2026-09-20 |
| Vercel frontend | Deployed | Production deploy succeeded and was aliased to `https://crm.vulpinehomes.com`; `GET https://crm.vulpinehomes.com` -> `200` |

## Public URLs Verified

| URL | Result |
|-----|--------|
| `http://api.vulpinehomes.com/health` | `200 {"status":"ok"}` |
| `https://api.vulpinehomes.com/health` | `200 {"status":"ok"}` |
| `https://n8n.vulpinehomes.com` | `200` |
| `https://crm.vulpinehomes.com` | `200` |

NocoDB was intentionally not exposed publicly because DNS for `nocodb.vulpinehomes.com` resolved to `216.150.1.1` and `216.150.1.65`, not this VPS (`167.233.89.33`). Local NocoDB remains available at `http://127.0.0.1:8080`.

## Database

| Item | Value |
|------|-------|
| PostgreSQL version | `PostgreSQL 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)` |
| Cabinet database | `vulpine_command_center` |
| Cabinet user | `vulpine_command_center_user` |
| NocoDB database | `nocodb` |
| NocoDB user | `nocodb_user` |
| n8n database | `n8n` |
| n8n user | `n8n_user` |
| Listen address | `localhost` |
| hba file | `/etc/postgresql/16/main/pg_hba.conf` |
| config file | `/etc/postgresql/16/main/postgresql.conf` |

Postgres was tightened from `listen_addresses='*'` to `listen_addresses='localhost'`, then restarted. Docker services use `network_mode: host` and connect over `127.0.0.1`, so Postgres is not intentionally exposed publicly.

## Docker Services

| Service | Compose File | Env File | Notes |
|---------|--------------|----------|-------|
| NocoDB | `/opt/vulpine-nocodb/docker-compose.yml` | `/opt/vulpine-nocodb/.env` | Env file mode `0600`; keys: `NC_DB`, `NC_AUTH_JWT_SECRET` |
| n8n | `/opt/vulpine-n8n/docker-compose.yml` | `/opt/vulpine-n8n/.env` | Env file mode `0600`; existing persisted encryption key preserved from Docker volume |

The NocoDB and n8n compose files no longer embed secrets inline. Credentials were moved to root-readable env files. The n8n encryption key was preserved from the existing `vulpine-n8n_n8n_data` volume to avoid invalidating persisted encrypted data.

## nginx / SSL

| Host | Upstream | SSL |
|------|----------|-----|
| `api.vulpinehomes.com` | `127.0.0.1:4000` | Enabled and verified |
| `n8n.vulpinehomes.com` | `127.0.0.1:5678` | Enabled and verified |
| `nocodb.vulpinehomes.com` | Not configured | Blocked by DNS pointing away from VPS |

Certificate details:

```text
Certificate Name: api.vulpinehomes.com
Domains: api.vulpinehomes.com n8n.vulpinehomes.com
Expiry Date: 2026-09-20 13:27:54+00:00
Certificate Path: /etc/letsencrypt/live/api.vulpinehomes.com/fullchain.pem
Private Key Path: /etc/letsencrypt/live/api.vulpinehomes.com/privkey.pem
```

## Vercel

| Item | Result |
|------|--------|
| CLI version | `54.14.5` |
| Auth | `rosegoldcruz` |
| Production env key | `NEXT_PUBLIC_API_BASE_URL` exists for Production; value is encrypted by Vercel |
| Production deploy | Succeeded |
| Production deployment | `https://vulpine-autobid-and-9gtg9moe0-elohim.vercel.app` |
| Alias | `https://crm.vulpinehomes.com` |

Vercel output confirmed the production build completed successfully and the deployment was aliased to `crm.vulpinehomes.com`.

## Verification Commands Run

The normal terminal entered a broken alternate-screen state during inspection, so later host checks were executed through the workspace Python executor using `subprocess` with controlled output. Secret values were not printed; env files were reported by keys only.

Commands/checks executed:

```sh
git status --short
pm2 status
curl-equivalent GET http://127.0.0.1:4000/health
curl-equivalent GET http://api.vulpinehomes.com/health
curl-equivalent GET https://api.vulpinehomes.com/health
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail=80 vulpine-nocodb
docker logs --tail=80 vulpine-n8n
ss -ltnp
sudo -u postgres psql -tAc 'show listen_addresses;'
sudo -u postgres psql -tAc 'select version();'
sudo -u postgres psql -tAc 'show hba_file;'
sudo -u postgres psql -tAc 'show config_file;'
docker compose config
docker compose up -d
docker restart vulpine-nocodb vulpine-n8n
nginx -t
systemctl reload nginx
certbot --version
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email -d api.vulpinehomes.com -d n8n.vulpinehomes.com
certbot certificates
npx vercel --version
npx vercel whoami
npx vercel env ls
npx vercel --prod --yes
curl-equivalent GET https://n8n.vulpinehomes.com
curl-equivalent GET https://crm.vulpinehomes.com
```

Final health results:

```text
PM2: vulpine-command-center-api online
API local: 200 {"status":"ok"}
API public HTTPS: 200 {"status":"ok"}
NocoDB local: 200
n8n local: 200
n8n public HTTPS: 200
Frontend public HTTPS: 200
nginx -t: successful
Docker: vulpine-nocodb and vulpine-n8n up
git status --short: clean before report update
```

## Remaining Blockers

| Blocker | Impact | Required Action |
|---------|--------|-----------------|
| `nocodb.vulpinehomes.com` DNS points away from VPS | NocoDB was not exposed publicly | Point DNS to `167.233.89.33`, then add nginx/SSL route if public NocoDB is intended |
| Missing required env var: `N8N_WEBHOOK_URL` | Workflow production webhook URL not configured | Set only after the real public n8n URL and workflow webhook are finalized |
| n8n internal Python task runner warning | Python-code n8n nodes may need external runner setup | Configure external task runner only if Python task execution is required |

## Secrets Inventory

Secret values were not printed and are not committed.

| File | Mode | Purpose |
|------|------|---------|
| `/opt/vulpine-command-center/services/api/.env` | `0600` | Backend API runtime env |
| `/opt/vulpine-nocodb/.env` | `0600` | NocoDB Postgres connection and JWT secret |
| `/opt/vulpine-n8n/.env` | `0600` | n8n Postgres connection and encryption key |

## Next Step

Only after this verified infrastructure state: Cabinet Bid Engine Phase 2 workbook ingestion.
