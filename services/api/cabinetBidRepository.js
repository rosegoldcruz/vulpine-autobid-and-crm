const { queryJson, runSql, sqlLiteral, sqlNumber } = require("./db")

const JOB_COLUMNS = `
  id,
  name,
  customer_name,
  project_name,
  project_address,
  cabinet_scope_type,
  status,
  safe_to_send,
  pricing_source_type,
  pricing_source_file,
  pricing_source_hash,
  pricing_source_version,
  created_at,
  updated_at
`

const FILE_COLUMNS = `
  id,
  cabinet_bid_job_id,
  file_type,
  original_filename,
  storage_key,
  mime_type,
  size_bytes,
  sha256_hash,
  upload_status,
  created_at
`

async function listJobs() {
  return queryJson(
    `SELECT COALESCE(json_agg(row_to_json(j)), '[]'::json)
     FROM (
       SELECT ${JOB_COLUMNS}
       FROM cabinet_bid_jobs
       ORDER BY created_at DESC
     ) j;`,
    [],
  )
}

async function createJob(input) {
  return queryJson(
    `WITH inserted AS (
       INSERT INTO cabinet_bid_jobs (
         name,
         customer_name,
         project_name,
         project_address,
         cabinet_scope_type,
         pricing_source_type,
         pricing_source_file,
         pricing_source_hash,
         pricing_source_version
       ) VALUES (
         ${sqlLiteral(input.name)},
         ${sqlLiteral(input.customer_name)},
         ${sqlLiteral(input.project_name)},
         ${sqlLiteral(input.project_address)},
         ${sqlLiteral(input.cabinet_scope_type)},
         ${sqlLiteral(input.pricing_source_type)},
         ${sqlLiteral(input.pricing_source_file)},
         ${sqlLiteral(input.pricing_source_hash)},
         ${sqlLiteral(input.pricing_source_version)}
       )
       RETURNING ${JOB_COLUMNS}
     )
     SELECT row_to_json(inserted) FROM inserted;`,
    null,
  )
}

async function getJob(id) {
  return queryJson(
    `SELECT row_to_json(payload)
     FROM (
       SELECT
         (${selectJobByIdSql(id)}) AS job,
         COALESCE((
           SELECT json_agg(row_to_json(f))
           FROM (
             SELECT ${FILE_COLUMNS}
             FROM cabinet_bid_job_files
             WHERE cabinet_bid_job_id = ${sqlLiteral(id)}
             ORDER BY created_at DESC
           ) f
         ), '[]'::json) AS files
     ) payload;`,
    null,
  )
}

async function jobExists(id) {
  const result = await queryJson(
    `SELECT json_build_object('exists', EXISTS (
       SELECT 1 FROM cabinet_bid_jobs WHERE id = ${sqlLiteral(id)}
     ));`,
    { exists: false },
  )
  return Boolean(result.exists)
}

async function addFileAndUpdateStatus(jobId, file, nextStatus) {
  return queryJson(
    `BEGIN;
     INSERT INTO cabinet_bid_job_files (
       cabinet_bid_job_id,
       file_type,
       original_filename,
       storage_key,
       mime_type,
       size_bytes,
       sha256_hash,
       upload_status
     ) VALUES (
       ${sqlLiteral(jobId)},
       ${sqlLiteral(file.file_type)},
       ${sqlLiteral(file.original_filename)},
       ${sqlLiteral(file.storage_key)},
       ${sqlLiteral(file.mime_type)},
       ${sqlNumber(file.size_bytes)},
       ${sqlLiteral(file.sha256_hash)},
       'stored'
     );
     UPDATE cabinet_bid_jobs
     SET status = ${sqlLiteral(nextStatus)}, safe_to_send = FALSE, updated_at = NOW()
     WHERE id = ${sqlLiteral(jobId)};
     COMMIT;
     SELECT row_to_json(payload)
     FROM (
       SELECT
         (${selectJobByIdSql(jobId)}) AS job,
         COALESCE((
           SELECT json_agg(row_to_json(f))
           FROM (
             SELECT ${FILE_COLUMNS}
             FROM cabinet_bid_job_files
             WHERE cabinet_bid_job_id = ${sqlLiteral(jobId)}
             ORDER BY created_at DESC
           ) f
         ), '[]'::json) AS files
     ) payload;`,
    null,
  )
}

async function addFilesAndUpdateStatus(jobId, files, nextStatus) {
  const inserts = files.map((file) => (
    `INSERT INTO cabinet_bid_job_files (
       cabinet_bid_job_id,
       file_type,
       original_filename,
       storage_key,
       mime_type,
       size_bytes,
       sha256_hash,
       upload_status
     ) VALUES (
       ${sqlLiteral(jobId)},
       ${sqlLiteral(file.file_type)},
       ${sqlLiteral(file.original_filename)},
       ${sqlLiteral(file.storage_key)},
       ${sqlLiteral(file.mime_type)},
       ${sqlNumber(file.size_bytes)},
       ${sqlLiteral(file.sha256_hash)},
       'stored'
     );`
  )).join("\n")

  return queryJson(
    `BEGIN;
     ${inserts}
     UPDATE cabinet_bid_jobs
     SET status = ${sqlLiteral(nextStatus)}, safe_to_send = FALSE, updated_at = NOW()
     WHERE id = ${sqlLiteral(jobId)};
     COMMIT;
     SELECT row_to_json(payload)
     FROM (
       SELECT
         (${selectJobByIdSql(jobId)}) AS job,
         COALESCE((
           SELECT json_agg(row_to_json(f))
           FROM (
             SELECT ${FILE_COLUMNS}
             FROM cabinet_bid_job_files
             WHERE cabinet_bid_job_id = ${sqlLiteral(jobId)}
             ORDER BY created_at DESC
           ) f
         ), '[]'::json) AS files
     ) payload;`,
    null,
  )
}

async function markUploadFailed(jobId, status) {
  await runSql(
    `UPDATE cabinet_bid_jobs
     SET status = ${sqlLiteral(status)}, safe_to_send = FALSE, updated_at = NOW()
     WHERE id = ${sqlLiteral(jobId)};`,
  )
}

function selectJobByIdSql(id) {
  return `SELECT row_to_json(j)
          FROM (
            SELECT ${JOB_COLUMNS}
            FROM cabinet_bid_jobs
            WHERE id = ${sqlLiteral(id)}
          ) j`
}

module.exports = {
  addFileAndUpdateStatus,
  addFilesAndUpdateStatus,
  createJob,
  getJob,
  jobExists,
  listJobs,
  markUploadFailed,
}
