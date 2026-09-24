import assert from "node:assert/strict"
import test from "node:test"
import { joinRemotePath, normalizeRemotePath, parentPath } from "../src/path.js"

test("remote paths strip traversal segments", () => {
  assert.equal(normalizeRemotePath("/projects/../secrets/./bid.pdf"), "/projects/secrets/bid.pdf")
  assert.equal(parentPath("/projects/alpha/bid.pdf"), "/projects/alpha")
})

test("uploaded filenames cannot create nested paths", () => {
  assert.equal(joinRemotePath("/projects", "../bid.pdf"), "/projects/..bid.pdf")
  assert.throws(() => joinRemotePath("/projects", ".."), /Invalid filename/)
})
