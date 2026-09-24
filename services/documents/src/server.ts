import express, { type NextFunction, type Request, type Response } from "express"
import multer from "multer"
import { normalizeCorrelationId } from "@vulpine/contracts"
import { latestAccessByPath, logAccess, type AccessAction } from "./access-log.js"
import { authorizeTransfer, requireIntegration } from "./auth.js"
import { optionalEnv, positiveIntegerEnv } from "./config.js"
import { contentDisposition, contentTypeForPath, filenameFromPath, previewKind, zipFilenameFromPath } from "./file-meta.js"
import { joinRemotePath } from "./path.js"
import { listAllItems, listDirectory, readFile, writeFile, zipDirectory } from "./sftp.js"

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: positiveIntegerEnv("DRIVE_UPLOAD_MAX_BYTES", 250 * 1024 * 1024),
    files: 100,
  },
})

app.disable("x-powered-by")
app.use(express.json({ limit: "1mb" }))

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "vulpine-documents", generatedAt: new Date().toISOString() })
})

function uploadCors(request: Request, response: Response, next: NextFunction) {
  const allowedOrigin = optionalEnv("BACKOFFICE_ORIGIN") ?? "https://backoffice.vulpine.llc"
  const origin = request.header("origin")
  if (origin === allowedOrigin) {
    response.set("access-control-allow-origin", allowedOrigin)
    response.set("access-control-allow-methods", "POST, OPTIONS")
    response.set("access-control-allow-headers", "content-type")
    response.set("access-control-max-age", "600")
    response.vary("origin")
  }
  if (request.method === "OPTIONS") {
    response.status(origin === allowedOrigin ? 204 : 403).end()
    return
  }
  next()
}

app.options("/upload", uploadCors)

app.post("/upload", uploadCors, (request, response, next) => {
  const path = typeof request.query.path === "string" ? request.query.path : ""
  if (!path) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing path." } })
    return
  }
  if (authorizeTransfer(request, response, "upload", path)) next()
}, upload.array("files", 100), async (request, response, next) => {
  try {
    const files = (request.files ?? []) as Express.Multer.File[]
    const path = typeof request.query.path === "string" ? request.query.path : ""
    if (request.body?.path !== path) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Upload path does not match its transfer ticket." } })
      return
    }
    if (!files.length) {
      response.status(400).json({ error: { code: "UPLOAD_FILES_REQUIRED", message: "No files provided." } })
      return
    }
    for (const file of files) await writeFile(joinRemotePath(path, file.originalname), file.buffer)
    response.json({ uploaded: files.length })
  } catch (error) {
    next(error)
  }
})

app.get("/preview", async (request, response, next) => {
  const path = typeof request.query.path === "string" ? request.query.path : ""
  if (!path) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing path." } })
    return
  }
  if (!authorizeTransfer(request, response, "preview", path)) return
  if (!["image", "video", "model", "pdf", "text"].includes(previewKind(path))) {
    response.status(415).json({ error: { code: "UNSUPPORTED_FILE_TYPE", message: "No inline preview available." } })
    return
  }
  try {
    const data = await readFile(path)
    await logAccess(path, "view").catch(() => undefined)
    response.set({
      "content-type": contentTypeForPath(path),
      "content-length": String(data.byteLength),
      "content-disposition": contentDisposition("inline", filenameFromPath(path)),
      "cache-control": "private, max-age=60",
    }).send(data)
  } catch (error) {
    next(error)
  }
})

app.get("/download", async (request, response, next) => {
  const path = typeof request.query.path === "string" ? request.query.path : ""
  if (!path) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing path." } })
    return
  }
  if (!authorizeTransfer(request, response, "download", path)) return
  try {
    const isFolder = request.query.type === "folder"
    const data = isFolder ? await zipDirectory(path) : await readFile(path)
    await logAccess(path, "view").catch(() => undefined)
    response.set({
      "content-type": isFolder ? "application/zip" : contentTypeForPath(path),
      "content-length": String(data.byteLength),
      "content-disposition": contentDisposition("attachment", isFolder ? zipFilenameFromPath(path) : filenameFromPath(path)),
      "cache-control": "private, no-store",
    }).send(data)
  } catch (error) {
    next(error)
  }
})

app.use(requireIntegration)

app.get("/files", async (request, response, next) => {
  try {
    response.json(await listDirectory(typeof request.query.path === "string" ? request.query.path : "/"))
  } catch (error) {
    next(error)
  }
})

app.get("/recent", async (_request, response, next) => {
  try {
    const items = await listAllItems()
    const accessMap = await latestAccessByPath(items.map((item) => item.path))
    const recentItems = items.map((item) => {
      const lastAccessedAt = accessMap.get(item.path) ?? null
      const modifiedTime = item.modifiedAt ? new Date(item.modifiedAt).getTime() : 0
      const accessedTime = lastAccessedAt ? new Date(lastAccessedAt).getTime() : 0
      return { ...item, lastAccessedAt, recentAt: modifiedTime >= accessedTime ? item.modifiedAt : lastAccessedAt }
    }).sort((left, right) => new Date(right.recentAt ?? 0).getTime() - new Date(left.recentAt ?? 0).getTime())
    response.json({ items: recentItems, generatedAt: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
})

app.post("/access", async (request, response, next) => {
  try {
    const path = typeof request.body?.path === "string" ? request.body.path : ""
    if (!path) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing path." } })
      return
    }
    const action: AccessAction = request.body?.action === "modify" ? "modify" : "view"
    await logAccess(path, action)
    response.json({ logged: true })
  } catch (error) {
    next(error)
  }
})

app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
  const correlationId = request.correlationId || normalizeCorrelationId(request.header("x-correlation-id"))
  console.error(JSON.stringify({
    event: "documents.request.failed",
    correlationId,
    actor: request.actorId || null,
    method: request.method,
    path: request.path,
    error: error instanceof Error ? error.name : "UnknownError",
  }))
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Document operation failed." },
    correlationId,
  })
})

const host = optionalEnv("DOCUMENTS_HOST") ?? "127.0.0.1"
const port = positiveIntegerEnv("DOCUMENTS_PORT", 3016)

app.listen(port, host, () => {
  console.info(JSON.stringify({ event: "documents.started", host, port }))
})
