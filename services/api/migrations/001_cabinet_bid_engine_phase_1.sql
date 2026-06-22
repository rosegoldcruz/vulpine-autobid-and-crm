CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cabinet_bid_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_name TEXT,
  project_name TEXT,
  project_address TEXT,
  cabinet_scope_type TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  safe_to_send BOOLEAN NOT NULL DEFAULT FALSE,
  pricing_source_type TEXT,
  pricing_source_file TEXT,
  pricing_source_hash TEXT,
  pricing_source_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cabinet_bid_jobs_status_check CHECK (
    status IN (
      'created',
      'cabinet_workbook_uploaded',
      'cabinet_plans_uploaded',
      'cabinet_workbook_ingestion_failed',
      'cabinet_plan_ingestion_failed',
      'cabinet_processing_error'
    )
  )
);

CREATE TABLE IF NOT EXISTS cabinet_bid_job_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_bid_job_id UUID NOT NULL REFERENCES cabinet_bid_jobs(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'stored',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cabinet_bid_job_files_file_type_check CHECK (
    file_type IN ('cabinet_workbook', 'cabinet_plan_pdf')
  ),
  CONSTRAINT cabinet_bid_job_files_upload_status_check CHECK (
    upload_status IN ('stored', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_cabinet_bid_jobs_status
  ON cabinet_bid_jobs(status);

CREATE INDEX IF NOT EXISTS idx_cabinet_bid_job_files_job_id
  ON cabinet_bid_job_files(cabinet_bid_job_id);

CREATE INDEX IF NOT EXISTS idx_cabinet_bid_job_files_sha256
  ON cabinet_bid_job_files(sha256_hash);
