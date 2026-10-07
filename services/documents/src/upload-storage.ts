import multer from "multer"

/** Bound all in-memory file bytes in one multipart request, including chunked requests. */
export function boundedMemoryStorage(maxBytes: number): multer.StorageEngine {
  const totals = new WeakMap<object, number>()
  return {
    _handleFile(request, file, callback) {
      const chunks: Buffer[] = []
      let size = 0
      let finished = false
      file.stream.on("data", (chunk: Buffer) => {
        if (finished) return
        const bytes = Buffer.from(chunk)
        const total = (totals.get(request) ?? 0) + bytes.length
        totals.set(request, total)
        if (total > maxBytes) {
          finished = true
          chunks.length = 0
          callback(new multer.MulterError("LIMIT_FILE_SIZE"))
          return
        }
        size += bytes.length
        chunks.push(bytes)
      })
      file.stream.on("error", (error: Error) => {
        if (finished) return
        finished = true
        chunks.length = 0
        callback(error)
      })
      file.stream.on("end", () => {
        if (finished) return
        finished = true
        callback(null, { buffer: Buffer.concat(chunks, size), size })
      })
    },
    _removeFile(_request, file, callback) {
      delete (file as Partial<Express.Multer.File>).buffer
      callback(null)
    },
  }
}
