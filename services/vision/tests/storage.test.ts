import assert from "node:assert/strict"
import test from "node:test"
import { writeBinary } from "../src/storage.js"

test("storage rejects path traversal", async () => {
  await assert.rejects(() => writeBinary("../escape.txt", Buffer.from("no")), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "INVALID_STORAGE_PATH")
    return true
  })
})
