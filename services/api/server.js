// Load .env file before any requires
try {
  const fs = require("node:fs")
  const path = require("node:path")
  const envPath = path.join(__dirname, ".env")
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8")
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
} catch (_) { /* env loading is best-effort */ }

const http = require("node:http")
const { URL } = require("node:url")
const {
  addFileAndUpdateStatus,
  addFilesAndUpdateStatus,
  createJob,
  getJob,
  jobExists,
  listJobs,
  markUploadFailed,
} = require("./cabinetBidRepository")
const { requiredEnv } = require("./db")
const { storeCabinetFile } = require("./fileStorage")
const { parseMultipart } = require("./multipart")

const WORKBOOK_EXTENSIONS = new Set([".xlsx", ".csv"])
const WORKBOOK_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
])
const PLAN_EXTENSIONS = new Set([".pdf"])
const PLAN_MIME_TYPES = new Set(["application/pdf"])
const WORKBOOK_MAX_BYTES = 50 * 1024 * 1024
const PLAN_MAX_BYTES = 250 * 1024 * 1024
const PLAN_BATCH_MAX_BYTES = 2 * 1024 * 1024 * 1024
const PLAN_BATCH_MAX_FILES = 100
const BODY_MAX_BYTES = PLAN_BATCH_MAX_BYTES + 50 * 1024 * 1024

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function applyCors(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(payload))
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message })
}

function normalizeJobInput(input) {
  const name = String(input.name || "").trim()
  if (!name) {
    throw new Error("Cabinet bid job name is required")
  }
  return {
    name,
    customer_name: cleanNullable(input.customer_name),
    project_name: cleanNullable(input.project_name),
    project_address: cleanNullable(input.project_address),
    cabinet_scope_type: cleanNullable(input.cabinet_scope_type),
    pricing_source_type: cleanNullable(input.pricing_source_type),
    pricing_source_file: cleanNullable(input.pricing_source_file),
    pricing_source_hash: cleanNullable(input.pricing_source_hash),
    pricing_source_version: cleanNullable(input.pricing_source_version),
  }
}

function cleanNullable(value) {
  const cleaned = String(value || "").trim()
  return cleaned || null
}

function hasExtension(filename, extension) {
  return String(filename || "").toLowerCase().endsWith(extension)
}

function validateWorkbook(upload) {
  if (!upload) throw new Error("Cabinet workbook file is required")
  const extension = getExtension(upload.filename)
  if (!WORKBOOK_EXTENSIONS.has(extension)) {
    throw new Error("Cabinet workbook must be a .xlsx or .csv file")
  }
  if (!WORKBOOK_MIME_TYPES.has(upload.mimeType)) {
    throw new Error("Cabinet workbook MIME type is not allowed")
  }
  if (upload.data.length > WORKBOOK_MAX_BYTES) {
    throw new Error("Cabinet workbook exceeds 50 MB")
  }
}

function validatePlans(files) {
  if (!files.length) {
    throw new Error("At least one cabinet plan PDF is required")
  }
  if (files.length > PLAN_BATCH_MAX_FILES) {
    throw new Error("Cabinet plan upload exceeds 100 files")
  }

  let totalBytes = 0
  for (const file of files) {
    const extension = getExtension(file.filename)
    if (!PLAN_EXTENSIONS.has(extension)) {
      throw new Error("Cabinet plan files must be .pdf")
    }
    if (!PLAN_MIME_TYPES.has(file.mimeType)) {
      throw new Error("Cabinet plan MIME type must be application/pdf")
    }
    if (file.data.length > PLAN_MAX_BYTES) {
      throw new Error("A cabinet plan PDF exceeds 250 MB")
    }
    totalBytes += file.data.length
  }

  if (totalBytes > PLAN_BATCH_MAX_BYTES) {
    throw new Error("Cabinet plan batch exceeds 2 GB")
  }
}

async function handleRequest(req, res) {
  applyCors(req, res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || "/", "http://localhost")
  const pathname = url.pathname.replace(/\/$/, "") || "/"

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok" })
    return
  }

  if (req.method === "GET" && pathname === "/autobid/cabinet/jobs") {
    sendJson(res, 200, { jobs: await listJobs() })
    return
  }

  if (req.method === "POST" && pathname === "/autobid/cabinet/jobs") {
    const input = normalizeJobInput(await readJson(req))
    const job = await createJob(input)
    sendJson(res, 201, { job })
    return
  }

  const jobDetailMatch = /^\/autobid\/cabinet\/jobs\/([^/]+)$/.exec(pathname)
  if (req.method === "GET" && jobDetailMatch) {
    const detail = await getJob(jobDetailMatch[1])
    if (!detail?.job) {
      sendError(res, 404, "Cabinet bid job not found")
      return
    }
    sendJson(res, 200, detail)
    return
  }

  const workbookMatch = /^\/autobid\/cabinet\/jobs\/([^/]+)\/workbook$/.exec(pathname)
  if (req.method === "POST" && workbookMatch) {
    const jobId = workbookMatch[1]
    await ensureJob(jobId)
    try {
      const upload = parseSingleUpload(req, await readBody(req, BODY_MAX_BYTES))
      validateWorkbook(upload)
      const storedFile = await storeCabinetFile(jobId, "cabinet_workbook", upload)
      const detail = await addFileAndUpdateStatus(jobId, storedFile, "cabinet_workbook_uploaded")
      sendJson(res, 201, detail)
    } catch (error) {
      await markUploadFailed(jobId, "cabinet_workbook_ingestion_failed")
      throw error
    }
    return
  }

  const plansMatch = /^\/autobid\/cabinet\/jobs\/([^/]+)\/plans$/.exec(pathname)
  if (req.method === "POST" && plansMatch) {
    const jobId = plansMatch[1]
    await ensureJob(jobId)
    try {
      const uploads = parseUploadBatch(req, await readBody(req, BODY_MAX_BYTES))
      validatePlans(uploads)
      const storedFiles = []
      for (const upload of uploads) {
        storedFiles.push(await storeCabinetFile(jobId, "cabinet_plan_pdf", upload))
      }
      const detail = await addFilesAndUpdateStatus(jobId, storedFiles, "cabinet_plans_uploaded")
      sendJson(res, 201, detail)
    } catch (error) {
      await markUploadFailed(jobId, "cabinet_plan_ingestion_failed")
      throw error
    }
    return
  }

  sendError(res, 404, "Not found")
}

function parseSingleUpload(req, body) {
  const uploads = parseUploadBatch(req, body)
  if (uploads.length !== 1) {
    throw new Error("Exactly one cabinet workbook file is required")
  }
  return uploads[0]
}

function parseUploadBatch(req, body) {
  const contentType = req.headers["content-type"] || ""
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Expected multipart/form-data upload")
  }
  return parseMultipart(contentType, body).filter((part) => part.filename)
}

function getExtension(filename) {
  const match = /\.[^.]+$/.exec(String(filename || "").toLowerCase())
  return match ? match[0] : ""
}

async function readJson(req) {
  const body = await readBody(req, 2 * 1024 * 1024)
  if (!body.length) return {}
  return JSON.parse(body.toString("utf8"))
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error("Request body exceeds allowed size"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

async function ensureJob(jobId) {
  if (!(await jobExists(jobId))) {
    const error = new Error("Cabinet bid job not found")
    error.statusCode = 404
    throw error
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const status = error.statusCode || 400
    sendError(res, status, error.message || "Cabinet Bid Engine API error")
  })
})

const port = Number(process.env.PORT || 3001)
if (require.main === module) {
  requiredEnv("PORT")
  server.listen(port, () => {
    console.log(`Vulpine Command Center API listening on ${port}`)
  })
}

module.exports = {
  server,
}
