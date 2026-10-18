import { createWriteStream } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import multer from "multer"

const directories = new WeakMap<object, Promise<string>>()
const totals = new WeakMap<object, number>()

/** Spool multipart bytes to private disk; file size never becomes Node heap size. */
export function temporaryUploadStorage(maxBytes?: number): multer.StorageEngine {
  return {
    _handleFile(request, file, callback) {
      let directory = directories.get(request)
      if (!directory) { directory = mkdtemp(join(tmpdir(), "vulpine-upload-")); directories.set(request, directory) }
      void (async () => {
        const destination = await directory
        const filename = randomUUID()
        const path = join(destination, filename)
        let size = 0
        const counter = new Transform({ transform(chunk: Buffer, _encoding, done) {
          size += chunk.length
          const total = (totals.get(request) ?? 0) + chunk.length
          totals.set(request, total)
          done(maxBytes && total > maxBytes ? new multer.MulterError("LIMIT_FILE_SIZE") : null, chunk)
        } })
        try {
          await pipeline(file.stream, counter, createWriteStream(path, { flags: "wx", mode: 0o600 }))
          callback(null, { destination, filename, path, size })
        } catch (error) {
          await rm(path, { force: true })
          callback(error as Error)
        }
      })().catch(error => callback(error as Error))
    },
    _removeFile(_request, file, callback) { void rm(file.path, { force: true }).then(() => callback(null), callback) },
  }
}

export async function cleanupUpload(request: object) {
  const directory = directories.get(request)
  if (directory) {
    directories.delete(request)
    totals.delete(request)
    await rm(await directory, { recursive: true, force: true })
  }
}
