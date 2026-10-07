import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import SftpClient from "ssh2-sftp-client"
import { readFile, zipDirectory } from "../src/sftp.js"

test("remote download and folder limits reject oversized metadata and growing streams", async (t) => {
  const original = { ...process.env }
  Object.assign(process.env, {
    SFTP_HOST: "qa.invalid", SFTP_USERNAME: "qa", SFTP_PASSWORD: "test-only-password",
    SFTP_HOST_KEY_SHA256: `SHA256:${createHash("sha256").update("test-host-key").digest("base64").replace(/=+$/, "")}`,
    DRIVE_DOWNLOAD_MAX_BYTES: "512", FOLDER_DOWNLOAD_MAX_FILES: "2", DATABASE_URL: "postgresql://qa:qa@127.0.0.1:1/qa",
  })
  t.after(() => {
    for (const key of ["SFTP_HOST", "SFTP_USERNAME", "SFTP_PASSWORD", "SFTP_HOST_KEY_SHA256", "DRIVE_DOWNLOAD_MAX_BYTES", "FOLDER_DOWNLOAD_MAX_FILES", "DATABASE_URL"]) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  })
  t.mock.method(SftpClient.prototype, "connect", async () => undefined)
  t.mock.method(SftpClient.prototype, "end", async () => undefined)
  let size = 513
  let streamSize = 3
  let reads = 0
  t.mock.method(SftpClient.prototype, "stat", async () => ({ isFile: true, size }))
  t.mock.method(SftpClient.prototype, "createReadStream", () => { reads += 1; return Readable.from([Buffer.alloc(streamSize)]) })
  await assert.rejects(readFile("/oversized.bin"), { code: "DOWNLOAD_TOO_LARGE" })
  assert.equal(reads, 0)
  size = 3
  assert.equal((await readFile("/allowed.bin")).length, 3)
  streamSize = 513
  await assert.rejects(readFile("/changed.bin"), { code: "DOWNLOAD_TOO_LARGE" })
  streamSize = 300
  const beforeFolder = reads
  t.mock.method(SftpClient.prototype, "list", async () => [{ name: "a.bin", type: "-", size: 300 }, { name: "b.bin", type: "-", size: 300 }])
  await assert.rejects(zipDirectory("/folder"), { code: "DOWNLOAD_TOO_LARGE" })
  assert.equal(reads - beforeFolder, 1)
  t.mock.method(SftpClient.prototype, "list", async () => [{ name: "next", type: "d", size: 0 }])
  await assert.rejects(zipDirectory("/directories"), /too many directories/)
  streamSize = 3
  t.mock.method(SftpClient.prototype, "list", async () => [{ name: "a.bin", type: "-", size: 3 }])
  const zip = await zipDirectory("/allowed-folder")
  assert.equal(zip.subarray(0, 2).toString(), "PK")
})
