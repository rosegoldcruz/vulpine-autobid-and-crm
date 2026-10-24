import assert from "node:assert/strict"
import test from "node:test"
import express from "express"
import { signDriveTransferTicket } from "@vulpine/auth"
import { chunkUploadRouter } from "../src/chunked-upload.js"

test("chunk HTTP routes require upload authorization and bind sessions to actor and ticket path", async () => {
  const original = process.env.DRIVE_API_TOKEN
  process.env.DRIVE_API_TOKEN = "isolated-chunk-auth-test-secret"
  const app = express(); app.use(express.json()); app.use("/upload/chunks", chunkUploadRouter(async () => {}))
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve))
  const address = server.address(); assert.ok(address && typeof address !== "string")
  const base = `http://127.0.0.1:${address.port}/upload/chunks/`
  const post = (operation: string, actor?: string, path = "/Plans", body: unknown = {}) => {
    const url = new URL(operation, base); url.searchParams.set("path", path)
    if (actor) url.searchParams.set("ticket", signDriveTransferTicket({ action: "upload", path, subject: actor }, process.env.DRIVE_API_TOKEN!))
    return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  }
  try {
    assert.equal((await post("capabilities")).status, 401)
    assert.equal((await post("start")).status, 401)
    const start = await post("start", "owner", "/Plans", { name: "empty", size: 0 }); assert.equal(start.status, 200)
    const { id } = await start.json() as { id: string }
    assert.equal((await post(`${id}/status`, "another-user")).status, 404)
    assert.equal((await post(`${id}/status`, "owner", "/Other")).status, 404)
    assert.equal((await post(`${id}/finish`, "another-user")).status, 404)
    assert.equal((await post(`${id}/finish`, "owner")).status, 202)
    const response = await post(`${id}/status`, "owner"); assert.equal(response.status, 200)
    assert.equal((await response.json() as { phase: string }).phase, "complete")
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); if (original === undefined) delete process.env.DRIVE_API_TOKEN; else process.env.DRIVE_API_TOKEN = original }
})
