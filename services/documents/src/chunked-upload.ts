import { randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdtemp, rm, statfs } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Transform, type Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { Router, type Request, type Response } from "express"
import { authorizeTransfer } from "./auth.js"
import { resolveUploadPaths } from "./path.js"
import { reserveTransfer, releaseTransfer } from "./transfer-capacity.js"

export const CHUNK_BYTES = 32 * 1024 * 1024
const TTL = 60 * 60_000
class UploadFailure extends Error {
  constructor(public status: number, message: string) { super(message) }
}
type Session = {
  id: string; actor: string; base: string; target: string; size: number; offset: number
  file: string; directory: string; updated: number; busy: boolean
  phase: "receiving" | "saving" | "complete" | "failed"
}
type Save = (files: Array<{ path: string; localPath: string }>) => Promise<unknown>

/** Bounded, private disk spooling. Each request is smaller than the tunnel body limit. */
export class ChunkUploads {
  private sessions = new Map<string, Session>()
  private starting = 0
  private pendingBytes = 0
  constructor(private save: Save, private options: { maxBytes?: number; chunkBytes?: number; root?: string; reserveBytes?: number; ttl?: number } = {}) {}
  async cleanup(now = Date.now()) {
    for (const [id, s] of this.sessions) {
      if (!s.busy && s.phase !== "saving" && now - s.updated > (this.options.ttl ?? TTL)) {
        this.sessions.delete(id)
        await rm(s.directory, { recursive: true, force: true })
      }
    }
  }
  async start(actor: string, base: string, name: unknown, size: unknown, relativePath?: unknown) {
    await this.cleanup()
    if (typeof name !== "string" || !name || typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) throw new UploadFailure(400, "Invalid file metadata.")
    if (this.options.maxBytes && size > this.options.maxBytes) throw new UploadFailure(413, "File exceeds the configured upload limit.")
    let target: string
    try { target = resolveUploadPaths(base, [name], relativePath === undefined ? undefined : JSON.stringify([relativePath]))[0] }
    catch { throw new UploadFailure(400, "Unsafe upload path.") }
    if (name.length > 2000 || /[\x00-\x1f]/.test(name)) throw new UploadFailure(400, "Invalid filename.")
    const active = [...this.sessions.values()].filter(s => s.phase === "receiving" || s.phase === "saving").length
    if (active + this.starting >= 8) throw new UploadFailure(429, "Uploads are busy. Retry shortly.")
    this.starting++; this.pendingBytes += size
    try {
    const disk = await statfs(this.options.root ?? tmpdir())
    const reserved = [...this.sessions.values()].reduce((n, s) => n + (s.phase === "receiving" ? s.size - s.offset : 0), 0)
    if (this.pendingBytes + reserved + (this.options.reserveBytes ?? 2 * 1024 ** 3) > disk.bavail * disk.bsize) throw new UploadFailure(507, "Insufficient temporary upload space.")
    const directory = await mkdtemp(join(this.options.root ?? tmpdir(), "vulpine-chunk-"))
    const s: Session = { id: randomUUID(), actor, base, target, size, offset: 0, directory, file: join(directory, "data"), updated: Date.now(), busy: false, phase: "receiving" }
    const stream = createWriteStream(s.file, { flags: "wx", mode: 0o600 }); await new Promise<void>((resolve, reject) => { stream.once("close", resolve); stream.once("error", reject); stream.end() })
    this.sessions.set(s.id, s)
    return { id: s.id, offset: 0, chunkBytes: this.options.chunkBytes ?? CHUNK_BYTES }
    } finally { this.starting--; this.pendingBytes -= size }
  }
  get(id: string, actor: string, base: string) {
    const s = this.sessions.get(id)
    if (!s || s.actor !== actor || s.base !== base) throw new UploadFailure(404, "Upload session not found.")
    if (!s.busy && s.phase !== "saving" && Date.now() - s.updated > (this.options.ttl ?? TTL)) throw new UploadFailure(410, "Upload session expired. Retry the file.")
    s.updated = Date.now()
    return s
  }
  async chunk(s: Session, offset: number, source: Readable) {
    if (s.busy) throw new UploadFailure(409, "Another chunk is being received.")
    if (s.phase !== "receiving") throw new UploadFailure(409, "File is no longer receiving chunks.")
    if (!Number.isSafeInteger(offset) || offset < 0) throw new UploadFailure(400, "Invalid chunk offset.")
    // A lost response can be retried without appending the same bytes twice.
    if (offset < s.offset) { source.resume(); return { offset: s.offset } }
    if (offset !== s.offset) throw new UploadFailure(409, "Chunk offset does not match.")
    s.busy = true
    const part = join(s.directory, "part")
    let bytes = 0
    try {
      const counter = new Transform({ transform: (data: Buffer, _encoding, done) => {
        bytes += data.length
        done(bytes > (this.options.chunkBytes ?? CHUNK_BYTES) || s.offset + bytes > s.size ? new UploadFailure(413, "Chunk exceeds its declared size.") : null, data)
      } })
      await pipeline(source, counter, createWriteStream(part, { flags: "wx", mode: 0o600 }))
      if (!bytes) throw new UploadFailure(400, "Empty chunk.")
      await pipeline(createReadStream(part), createWriteStream(s.file, { flags: "a", mode: 0o600 }))
      s.offset += bytes; s.updated = Date.now()
      return { offset: s.offset }
    } catch (error) {
      // Failure while appending could leave a partial tail: fail closed, never silently resume it.
      const { stat, truncate } = await import("node:fs/promises")
      if ((await stat(s.file)).size !== s.offset) await truncate(s.file, s.offset)
      throw error
    } finally { s.busy = false; await rm(part, { force: true }) }
  }
  finish(s: Session, done: () => void) {
    if (s.busy || s.offset !== s.size) throw new UploadFailure(409, "The file has not finished uploading.")
    if (s.phase !== "receiving") { done(); return this.status(s) }
    s.phase = "saving"; s.updated = Date.now()
    // Respond immediately; large SFTP transfers must not hold a Cloudflare request open.
    void Promise.resolve().then(() => this.save([{ path: s.target, localPath: s.file }])).then(() => { s.phase = "complete" }, () => { s.phase = "failed" }).finally(async () => {
      s.updated = Date.now(); done(); await rm(s.directory, { recursive: true, force: true }).catch(() => undefined)
    })
    return this.status(s)
  }
  status(s: Session) { return { phase: s.phase, offset: s.offset, uploaded: s.phase === "complete" ? 1 : 0, ...(s.phase === "failed" ? { error: { message: "File storage upload failed. Retry this file." } } : {}) } }
}

export function chunkUploadRouter(save: Save, maxBytes?: number) {
  const router = Router(); const uploads = new ChunkUploads(save, { maxBytes })
  const cleaner = setInterval(() => { void uploads.cleanup().catch(() => undefined) }, 60_000); cleaner.unref()
  router.use((request, response, next) => {
    const path = typeof request.query.path === "string" ? request.query.path : ""
    if (!path || !path.startsWith("/")) { response.status(400).json({ error: { message: "Missing upload path." } }); return }
    if (authorizeTransfer(request, response, "upload", path)) next()
  })
  const wrap = (fn: (request: Request, response: Response) => unknown) => async (request: Request, response: Response) => {
    try { await fn(request, response) } catch (error) {
      const status = error instanceof UploadFailure ? error.status : 500
      if (!response.headersSent) response.status(status).json({ error: { message: status === 500 ? "Document upload failed." : (error as Error).message } })
    }
  }
  const session = (request: Request) => uploads.get(String(request.params.id), request.actorId, String(request.query.path))
  router.post("/capabilities", (_request, response) => { response.json({ version: 1, chunkBytes: CHUNK_BYTES }) })
  router.post("/start", wrap(async (request, response) => {
    const { name, size, relativePath } = request.body ?? {}
    response.json(await uploads.start(request.actorId, String(request.query.path), name, size, relativePath))
  }))
  router.post("/:id/chunk", wrap(async (request, response) => { response.json(await uploads.chunk(session(request), Number(request.query.offset), request)) }))
  router.post("/:id/finish", wrap((request, response) => {
    const s = session(request)
    if (s.phase !== "receiving") { response.json(uploads.status(s)); return }
    if (!reserveTransfer(response)) return
    try { response.status(202).json(uploads.finish(s, () => releaseTransfer(response))) } catch (error) { releaseTransfer(response); throw error }
  }))
  router.post("/:id/status", wrap((request, response) => { response.json(uploads.status(session(request))) }))
  return router
}
