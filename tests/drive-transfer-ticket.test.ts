import assert from "node:assert/strict"
import test from "node:test"
import { signDriveTransferTicket, verifyDriveTransferTicket } from "../packages/auth/src/index.ts"

const secret = "test-only-drive-transfer-secret"

test("Drive transfer tickets are scoped to action and path", () => {
  const ticket = signDriveTransferTicket({ action: "download", path: "/proposal.pdf", subject: "user-1" }, secret)
  assert.equal(verifyDriveTransferTicket(ticket, secret, "download", "/proposal.pdf")?.subject, "user-1")
  assert.equal(verifyDriveTransferTicket(ticket, secret, "preview", "/proposal.pdf"), null)
  assert.equal(verifyDriveTransferTicket(ticket, secret, "download", "/other.pdf"), null)
})

test("Drive transfer tickets reject tampering and expiration", () => {
  const expired = signDriveTransferTicket({
    action: "upload",
    path: "/",
    subject: "user-1",
    expiresAt: Date.now() - 1,
  }, secret)
  assert.equal(verifyDriveTransferTicket(expired, secret, "upload", "/"), null)

  const valid = signDriveTransferTicket({ action: "upload", path: "/", subject: "user-1" }, secret)
  assert.equal(verifyDriveTransferTicket(`${valid}x`, secret, "upload", "/"), null)
})
