import assert from "node:assert/strict"
import test from "node:test"
import { DriveClient } from "../packages/sdk/src/index.ts"

test("a 300 MiB file uses bounded requests, renews tickets, and waits for remote save", async () => {
  const bytes = 300 * 1024 * 1024
  const file = new File(["fixture"], "large-plan.pdf")
  Object.defineProperty(file, "size", { value: bytes })
  Object.defineProperty(file, "webkitRelativePath", { value: "Project/large-plan.pdf" })
  file.slice = (start = 0, end = bytes) => { const blob = new Blob(["chunk"]); Object.defineProperty(blob, "size", { value: end - start }); return blob }
  const requests: number[] = []; let offset = 0; let tickets = 0; let lostResponse = false; let startBody: unknown
  const id = "12345678-1234-1234-1234-123456789abc"
  const drive = new DriveClient("/api/drive", async (input, init) => {
    const url = String(input)
    if (url.endsWith("/upload-ticket")) {
      tickets++
      return Response.json({ ok: true, data: { uploadUrl: "https://api.test/documents/upload?path=%2FPlans&ticket=" + tickets, expiresAt: new Date().toISOString(), chunkedUploadVersion: 1 }, meta: {} })
    }
    if (url.includes("/start?")) { startBody = JSON.parse(String(init?.body)); return Response.json({ id, offset: 0, chunkBytes: 32 * 1024 * 1024 }) }
    if (url.includes("/chunk?")) {
      const size = (init!.body as Blob).size; assert.ok(size <= 32 * 1024 * 1024)
      const requested = Number(new URL(url).searchParams.get("offset"))
      if (requested === offset) { requests.push(size); offset += size }
      if (!lostResponse) { lostResponse = true; throw new Error("response lost after accepted chunk") }
      return Response.json({ offset })
    }
    if (url.includes("/finish?")) return Response.json({ phase: "saving", uploaded: 0 }, { status: 202 })
    if (url.includes("/status?")) return Response.json({ phase: "complete", uploaded: 1 })
    throw new Error("Unexpected request " + url)
  })
  const progress: string[] = []
  assert.deepEqual(await drive.upload("/Plans", [file], undefined, x => progress.push(x.phase)), { uploaded: 1 })
  assert.equal(offset, bytes); assert.equal(requests.length, 10); assert.ok(tickets > 1)
  assert.deepEqual(startBody, { name: "large-plan.pdf", size: bytes, relativePath: "Project/large-plan.pdf" })
  assert.equal(progress.at(-1), "saving")
})

test("small file batches stay below the tunnel body limit", async () => {
  const file = new File(["fixture"], "plan.pdf"); Object.defineProperty(file, "size", { value: 40 * 1024 * 1024 })
  const counts: number[] = []
  const drive = new DriveClient("/api/drive", async (input, init) => {
    if (String(input).endsWith("/upload-ticket")) return Response.json({ ok: true, data: { uploadUrl: "https://api.test/upload", chunkedUploadVersion: 1 }, meta: {} })
    const count = (init!.body as FormData).getAll("files").length; counts.push(count); return Response.json({ uploaded: count })
  })
  assert.deepEqual(await drive.upload("/", [file, file, file]), { uploaded: 3 }); assert.deepEqual(counts, [1, 1, 1])
})
