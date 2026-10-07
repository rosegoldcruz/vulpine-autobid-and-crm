import assert from "node:assert/strict"
import test from "node:test"
import SftpClient from "ssh2-sftp-client"
import { deleteItem, listDirectory } from "../src/sftp.js"
import { validateDeletePath } from "../src/path.js"
import { createHash } from "node:crypto"

test("deletion rejects root, traversal, malformed paths and missing paths", () => {
  for (const path of [undefined, null, "", "/", "relative.txt", "/a/../b", "/a/./b", "/a//b", "/a/", "/a\0b"]) {
    assert.throws(() => validateDeletePath(path), /valid item path/)
  }
  assert.equal(validateDeletePath("/Projects/Bid #1.pdf"), "/Projects/Bid #1.pdf")
})

test("deletion checks remote type, deletes files and folders and closes failed connections", async (t) => {
  const original = { ...process.env }
  process.env.SFTP_HOST = "qa.invalid"
  process.env.SFTP_USERNAME = "qa"
  process.env.SFTP_PASSWORD = "qa-placeholder"
  process.env.SFTP_HOST_KEY_SHA256 = `SHA256:${createHash("sha256").update("test-host-key").digest("base64").replace(/=+$/, "")}`
  const deleted: string[] = []
  let type: false | "d" | "l" | "-" = "-"
  const removed: string[] = []
  let closed = 0
  t.mock.method(SftpClient.prototype, "connect", async () => undefined)
  t.mock.method(SftpClient.prototype, "end", async () => { closed += 1 })
  t.mock.method(SftpClient.prototype, "exists", async () => type)
  t.mock.method(SftpClient.prototype, "delete", async (path: string) => { deleted.push(path) })
  t.mock.method(SftpClient.prototype, "rmdir", async (path: string, recursive: boolean) => {
    assert.equal(recursive, true)
    removed.push(path)
  })
  // Keep this test independent of persistent storage.
  process.env.DATABASE_URL = "postgresql://qa:qa@127.0.0.1:1/qa"
  try {
    t.mock.method(SftpClient.prototype, "list", async () => [{ name: "\\home\\backup\\image.png", type: "-", size: 10 }, { name: ".", type: "d", size: 0 }])
    const listing = await listDirectory("/")
    assert.equal(listing.items.length, 1)
    assert.equal(listing.items[0].path, "/\\home\\backup\\image.png")
    await deleteItem("/qa.txt")
    for (const invalidType of [false, "d", "l"] as const) {
      type = invalidType
      await assert.rejects(deleteItem("/blocked"), /Only existing files/)
    }
    assert.deepEqual(deleted, ["/qa.txt"])
    assert.equal(closed, 5)
    t.mock.method(SftpClient.prototype, "delete", async () => { throw new Error("Permission denied") })
    type = "-"
    await assert.rejects(deleteItem("/denied.txt"), /Permission denied/)
    assert.equal(closed, 6)
    type = "d"
    await deleteItem("/qa-folder", true)
    assert.deepEqual(removed, ["/qa-folder"])
    for (const invalidType of [false, "-", "l"] as const) {
      type = invalidType
      await assert.rejects(deleteItem("/blocked", true), /Only existing folders/)
    }
    assert.deepEqual(removed, ["/qa-folder"])
    assert.equal(closed, 10)
  } finally {
    for (const key of ["SFTP_HOST", "SFTP_USERNAME", "SFTP_PASSWORD", "SFTP_HOST_KEY_SHA256", "DATABASE_URL"]) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})
