import { createHash, timingSafeEqual } from "node:crypto"

export function sftpHostVerifier(fingerprint: string) {
  if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint)) {
    throw new Error("Missing or invalid required env var: SFTP_HOST_KEY_SHA256")
  }
  const expected = Buffer.from(fingerprint)
  return (key: Buffer) => {
    const actual = Buffer.from(`SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
}
