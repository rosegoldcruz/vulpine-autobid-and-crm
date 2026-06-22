# Vulpine Command Center — Infrastructure Rebuild Report

Date: 2026-06-22
Server: CX53-Vulpine-32GB-320GB
Repo: /opt/vulpine-command-center
Commit: 6d54e86
Branch: main
Remote: git@github.com:rosegoldcruz/vulpine-autobid-and-crm.git

## Summary

### What Was Rebuilt

| Component | Status | Details |
|-----------|--------|---------|
| PostgreSQL 16 | Installed & running | Fresh database `vulpine_command_center`, user `vulpine_command_center_user` |
| Cabinet Bid Engine tables | Created | `cabinet_bid_jobs`, `cabinet_bid_job_files` with indexes and constraints |
| Backend API (PM2) | Running | `services/api/server.js` on port 4000, managed by PM2 as `vulpine-command-center-api` |
| nginx | Installed & running | Reverse proxy for `api.vulpinehomes.com` → `127.0.0.1:4000` |
| Docker | Available (29.6.0) | Compose v5.1.4 |
| Vercel env | Set | `NEXT_PUBLIC_API_BASE_URL=https://api.vulpinehomes.com` for production |
| Storage root | Created | `/var/lib/vulpine-command-center/uploads` (root:root, 750) |
| .env.example files | Created | `services/api/.env.example`, root `.env.example` |

### What Was Preserved

| Component | Status |
|-----------|--------|
| Zitadel tenant | Preserved. Existing keys in legacy `.env` not touched. No new Zitadel tenant created. |
| `cabinet_knowledge/` | Not touched. |
| Frontend shell | Not redesigned. Existing dark shell style preserved. |
| Email Blaster | Not touched. |
| GitHub repo | Same remote, same branch. |

### What Was Not Touched

| Component | Reason |
|-----------|--------|
| Vercel deployment | No deployment triggered. Build verified locally. |
| SSL / certbot | nginx configured for HTTP only. HTTPS requires certbot + domain DNS verification. |
| PM2 frontend | Frontend runs on Vercel, not PM2. |

## Env Inventory

### Keys Present (services/api/.env — root-readable, chmod 600)

```
PORT
DATABASE_URL
CORS_ALLOWED_ORIGINS
STORAGE_ROOT
```

### Keys Set in Vercel

```
NEXT_PUBLIC_API_BASE_URL=https://api.vulpinehomes.com
```

### Keys Missing

| Key | Required By | Status |
|-----|-------------|--------|
| None currently | — | All backend-required env keys are present. |

### Zitadel Keys Preserved (in legacy .env, not loaded by backend)

```
ZITADEL_ISSUER
ZITADEL_CLIENT_ID
ZITADEL_CLIENT_SECRET
```

These are in the legacy `.env` at repo root. The backend does not load them. When auth is wired, they must be placed in the correct frontend env (Vercel) or backend env as appropriate.

## Database

| Item | Value |
|------|-------|
| PostgreSQL version | 16.14 |
| Database name | `vulpine_command_center` |
| User | `vulpine_command_center_user` |
| Host | 127.0.0.1:5432 |
| Tables created | `cabinet_bid_jobs`, `cabinet_bid_job_files` |
| Migration applied | `services/api/migrations/001_cabinet_bid_engine_phase_1.sql` |
| Job count | 0 (fresh database) |
| Additional databases | `vulpine_commands_center_nocodb`, `vulpine_commands_center_n8n` (created, not yet populated) |

## Backend

| Item | Value |
|------|-------|
| PM2 service name | `vulpine-command-center-api` |
| Status | online |
| Port | 4000 |
| Health check | `GET /health` → `200 {"status":"ok"}` |
| Storage root | `/var/lib/vulpine-command-center/uploads` |
| Backend env file | `/opt/vulpine-command-center/services/api/.env` (root-readable, chmod 600) |
| Auto-start on reboot | `pm2 startup` configured |

## NocoDB

| Item | Value |
|------|-------|
| Docker Compose | `/opt/vulpine-nocodb/docker-compose.yml` |
| Status | Deployment files created. Container networking issue unresolved. |
| URL | Not yet verified. Port 8080. |
| Database | `vulpine_commands_center_nocodb` created and ready. |
| Blocker | Container crashes with NestJS module initialization error. Likely needs Postgres connection debugging — may require `127.0.0.1` in NC_DB URL or individual env vars. |
| Secrets | In `/opt/vulpine-nocodb/docker-compose.yml`, root-readable. |

## n8n

| Item | Value |
|------|-------|
| Docker Compose | `/opt/vulpine-n8n/docker-compose.yml` |
| Status | Deployment files created. Container networking issue unresolved. |
| URL | Not yet verified. Port 5678. |
| Database | `vulpine_commands_center_n8n` created and ready. |
| Blocker | Container crashes on startup. Likely Postgres connection host/port issue. |
| Webhook status | `N8N_WEBHOOK_URL` not yet created. Must be generated inside n8n after first successful start. |
| Secrets | In `/opt/vulpine-n8n/docker-compose.yml`, root-readable. |

## Auth / Zitadel

| Item | Value |
|------|-------|
| Zitadel integration code | None found in the repository. Auth is placeholder-only. |
| Auth files found | No real auth implementation. `components/cards/vulpine-command-center.tsx` has placeholder UI text. |
| Required Zitadel env keys | `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` |
| Keys present | All three in legacy `.env` at repo root. |
| Keys missing | None (from what code requires — auth code doesn't exist yet). |
| Callback URLs to configure | `https://crm.vulpinehomes.com/api/auth/callback/zitadel`, `http://localhost:3000/api/auth/callback/zitadel` |
| Frontend routes protected | None. |
| Backend endpoints protected | None. The API has no auth verification. |

## Frontend / Vercel

| Item | Value |
|------|-------|
| Vercel CLI | Authenticated as `rosegoldcruz` |
| Project | `elohim/vulpine-autobid-and-crm` |
| `NEXT_PUBLIC_API_BASE_URL` | Set to `https://api.vulpinehomes.com` for Production |
| Deploy status | Not triggered. Build verified locally with `npm run build`. |
| Blocker | None. Deploy can be triggered via Vercel dashboard or `vercel --prod`. |

## Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| NocoDB container startup | NocoDB not accessible | Debug Postgres connection from Docker container. Try `network_mode: host` with `127.0.0.1`. |
| n8n container startup | n8n not accessible | Same Postgres connection issue. May need `DB_POSTGRESDB_HOST=127.0.0.1` with host network. |
| SSL not configured | `api.vulpinehomes.com` is HTTP only | Requires certbot + domain DNS verification. |
| Vercel deploy not triggered | Frontend not live with new env | Run `vercel --prod` or deploy from dashboard. |
| eslint not installed | `npm run lint` fails | Install eslint or remove lint script from verification path. |

## Next Step

**Cabinet Bid Engine Phase 2**: deterministic cabinet workbook ingestion from `cabinet_knowledge` and job-level workbook override logic. This requires the backend API to be stable (which it is) and the frontend to be deployed with `NEXT_PUBLIC_API_BASE_URL` pointing to the live backend.

**Immediate infrastructure fix**: Debug and start NocoDB and n8n Docker containers with correct Postgres connectivity (host network mode + 127.0.0.1).
