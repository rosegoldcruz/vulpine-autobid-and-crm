import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("browser session callback never copies raw provider tokens", async () => {
  const source = await readFile(new URL("../apps/backoffice/lib/auth.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /session(?:\.user)?\.(?:accessToken|access_token|refreshToken|refresh_token|idToken|id_token)\s*=/)
  assert.doesNotMatch(source, /token\.(?:accessToken|access_token|refreshToken|refresh_token|idToken|id_token)\s*=/)
})
