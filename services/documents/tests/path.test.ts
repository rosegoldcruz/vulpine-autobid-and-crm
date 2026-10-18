import assert from "node:assert/strict"
import test from "node:test"
import { joinRemotePath, normalizeRemotePath, parentPath, resolveUploadPaths } from "../src/path.js"

test("remote paths strip traversal segments", () => {
  assert.equal(normalizeRemotePath("/projects/../secrets/./bid.pdf"), "/projects/secrets/bid.pdf")
  assert.equal(parentPath("/projects/alpha/bid.pdf"), "/projects/alpha")
})

test("uploaded filenames cannot create nested paths", () => {
  assert.equal(joinRemotePath("/projects", "../bid.pdf"), "/projects/..bid.pdf")
  assert.throws(() => joinRemotePath("/projects", ".."), /Invalid filename/)
})

test("remote reads preserve literal backslashes in Unix filenames", () => {
  assert.equal(normalizeRemotePath("/\\home\\backup\\image.png"), "/\\home\\backup\\image.png")
})

test("folder manifests preserve nested paths and reject unsafe or mismatched entries before writing", () => {
  assert.deepEqual(resolveUploadPaths("/Bids", ["plan.pdf", "plan.pdf"], JSON.stringify(["Project A/Plans/plan.pdf", "Project A/Revisions/plan.pdf"])), ["/Bids/Project A/Plans/plan.pdf", "/Bids/Project A/Revisions/plan.pdf"])
  assert.deepEqual(resolveUploadPaths("/", ["plan.pdf"], undefined), ["/plan.pdf"])
  for (const relative of ["../private", "/absolute.pdf", "Project/../../outside", "Project//file", "Project\\file", "C:/file", "Project/./file", "Project/", "bad\0name"]) {
    assert.throws(() => resolveUploadPaths("/Bids", ["file"], JSON.stringify([relative])))
  }
  assert.throws(() => resolveUploadPaths("/Bids", ["file"], "[]"))
  assert.throws(() => resolveUploadPaths("/Bids", ["file"], "not json"))
  assert.throws(() => resolveUploadPaths("/Bids", ["file", "file"], '["same/file", "same/file"]'))
})
