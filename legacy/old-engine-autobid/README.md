# Vulpine Command Center API

Backend service for the VPS / PM2 side of Vulpine Command Center.

## Required environment

```env
PORT=
DATABASE_URL=
CORS_ALLOWED_ORIGINS=
STORAGE_ROOT=
```

Missing `DATABASE_URL` or `STORAGE_ROOT` fails at request time with the exact missing env var name.

## Cabinet Bid Engine Phase 1

Routes:

```text
GET /health
GET /autobid/cabinet/jobs
POST /autobid/cabinet/jobs
GET /autobid/cabinet/jobs/:id
POST /autobid/cabinet/jobs/:id/workbook
POST /autobid/cabinet/jobs/:id/plans
```

This phase stores cabinet bid jobs and uploaded cabinet source files only. It does not parse workbooks, rasterize PDFs, classify pages, extract takeoff quantities, price bids, call AI providers, export packets, or mark jobs safe to send.

## Migration

Apply explicit SQL manually in the target database:

```text
services/api/migrations/001_cabinet_bid_engine_phase_1.sql
```

Database access is raw SQL through `psql`. No ORM is used.
