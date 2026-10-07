import assert from "node:assert/strict"
import test from "node:test"
import { Readable } from "node:stream"
import express from "express"
import multer from "multer"
import { boundedMemoryStorage } from "../src/upload-storage.js"
import { readBoundedStream } from "../src/bounded-stream.js"
import { releaseTransfer, reserveTransfer } from "../src/transfer-capacity.js"
import { EventEmitter } from "node:events"

test("a disconnected caller retains its transfer slot until upstream work settles", () => {
  const response = () => Object.assign(new EventEmitter(), { locals: {}, status() { return this }, set() { return this }, json() { return this } }) as unknown as express.Response
  const first = response()
  const second = response()
  const third = response()
  try {
    assert.equal(reserveTransfer(first), true)
    assert.equal(reserveTransfer(second), true)
    first.emit("close")
    assert.equal(reserveTransfer(third), false)
    releaseTransfer(first)
    assert.equal(reserveTransfer(third), true)
    releaseTransfer(first)
    assert.equal(reserveTransfer(response()), false)
  } finally {
    for (const current of [first, second, third]) releaseTransfer(current)
  }
})

test("stream reader rejects growth beyond its byte limit and preserves valid files", async () => {
  assert.deepEqual(await readBoundedStream(Readable.from([Buffer.from("abc"), Buffer.from("de")]), 5), Buffer.from("abcde"))
  const oversized = Readable.from([Buffer.from("abc"), Buffer.from("def")])
  await assert.rejects(readBoundedStream(oversized, 5), { code: "DOWNLOAD_TOO_LARGE", status: 413 })
  assert.equal(oversized.destroyed, true)
})

test("multipart memory storage caps aggregate bytes across individually valid files", async (t) => {
  const app = express()
  let accepted = 0
  app.post("/upload", multer({ storage: boundedMemoryStorage(10), limits: { fileSize: 10, files: 2 } }).array("files"), (_request, response) => { accepted += 1; response.json({ ok: true }) })
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 500).end()
  })
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)) })
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  for (const [contents, status] of [[['abcd', 'efgh'], 200], [['abcdef', 'ghijkl'], 413]] as const) {
    const boundary = "test-upload-boundary"
    const body = contents.map((content) => `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n${content}\r\n`).join("") + `--${boundary}--\r\n`
    // A streamed body has no Content-Length: exercise the aggregate cap for chunked uploads.
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body.slice(0, 100))); controller.enqueue(new TextEncoder().encode(body.slice(100))); controller.close() } })
    const response: globalThis.Response = await fetch(`http://127.0.0.1:${address.port}/upload`, { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, body: stream, duplex: "half" } as RequestInit)
    assert.equal(response.status, status)
  }
  assert.equal(accepted, 1)
})
