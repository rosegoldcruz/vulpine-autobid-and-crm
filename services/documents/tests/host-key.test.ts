import assert from "node:assert/strict"
import test from "node:test"
import { createHash, generateKeyPairSync } from "node:crypto"
import { createRequire } from "node:module"
import SftpClient from "ssh2-sftp-client"
import { sftpHostVerifier } from "../src/host-key.js"

const require = createRequire(createRequire(import.meta.url).resolve("ssh2-sftp-client"))
const { Server } = require("ssh2")

test("SFTP host verification requires a pin and only accepts the pinned public key", () => {
  for (const pin of ["", "SHA256:invalid", "00".repeat(32)]) assert.throws(() => sftpHostVerifier(pin), /SFTP_HOST_KEY_SHA256/)
  const key = Buffer.from("test public host key")
  const pin = `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`
  const verifier = sftpHostVerifier(pin)
  assert.equal(verifier(key), true)
  assert.equal(verifier(Buffer.from("different public host key")), false)
})

test("mismatched SSH server host key rejects connection before password authentication", async (t) => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  let authenticationRequests = 0
  const server = new Server({ hostKeys: [privateKey.export({ type: "pkcs1", format: "pem" })] }, (connection: any) => {
    connection.on("error", () => undefined)
    connection.on("authentication", (context: any) => { authenticationRequests += 1; context.reject() })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise<void>((resolve) => server.close(resolve)))
  const client = new SftpClient("host-key-negative-test")
  const pin = `SHA256:${createHash("sha256").update("different known host key").digest("base64").replace(/=+$/, "")}`
  await assert.rejects(client.connect({ host: "127.0.0.1", port: server.address().port, username: "test-only-user", password: "test-only-password", hostVerifier: sftpHostVerifier(pin), readyTimeout: 2_000, retries: 0 }), /Host denied|host key|fingerprint/i)
  await client.end().catch(() => undefined)
  assert.equal(authenticationRequests, 0)
})
