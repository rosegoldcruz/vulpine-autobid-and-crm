import assert from "node:assert/strict"
import test from "node:test"
import { DriveClient } from "../packages/sdk/src/index.ts"

test("Drive deletion encodes the file path and uses DELETE", async () => {
  const drive = new DriveClient("/api/drive", async (url, init) => {
    assert.equal(url, "/api/drive/files?path=%2FBids%2Ffile%20%231.txt")
    assert.equal(init?.method, "DELETE")
    return Response.json({ ok: true, data: { deleted: true }, meta: {} })
  })
  assert.deepEqual(await drive.deleteItem("/Bids/file #1.txt"), { deleted: true })
})

test("Drive deletion surfaces backend errors", async () => {
  const drive = new DriveClient("/api/drive", async () => Response.json({ ok: false, error: { code: "FORBIDDEN", message: "Missing write permission" }, meta: {} }, { status: 403 }))
  await assert.rejects(drive.deleteItem("/qa.txt"), /Missing write permission/)
})

test("folder deletion explicitly requests recursive folder removal", async () => {
  const drive = new DriveClient("/api/drive", async (url, init) => {
    assert.equal(url, "/api/drive/files?path=%2FBids&type=folder")
    assert.equal(init?.method, "DELETE")
    return Response.json({ ok: true, data: { deleted: true }, meta: {} })
  })
  await drive.deleteItem("/Bids", true)
})
