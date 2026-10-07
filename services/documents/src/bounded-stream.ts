import type { Readable } from "node:stream"

export async function readBoundedStream(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > maxBytes) {
      throw Object.assign(new Error("Download exceeds the configured byte limit."), { code: "DOWNLOAD_TOO_LARGE", status: 413 })
    }
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, size)
}
