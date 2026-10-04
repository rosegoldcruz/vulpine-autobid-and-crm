import assert from "node:assert/strict"
import test from "node:test"
import { buildDriveUpstreamUrl } from "../apps/backoffice/lib/drive-proxy.ts"

test("Drive upstream URL preserves a configured path prefix", () => {
  assert.equal(
    buildDriveUpstreamUrl("https://api.vulpinehomes.com/documents", "/files").toString(),
    "https://api.vulpinehomes.com/documents/files",
  )
  assert.equal(
    buildDriveUpstreamUrl("https://api.vulpinehomes.com/documents/", "/recent").toString(),
    "https://api.vulpinehomes.com/documents/recent",
  )
})

test("Drive upstream URL still works when the service is mounted at the origin root", () => {
  assert.equal(
    buildDriveUpstreamUrl("http://127.0.0.1:3016", "/files").toString(),
    "http://127.0.0.1:3016/files",
  )
})

