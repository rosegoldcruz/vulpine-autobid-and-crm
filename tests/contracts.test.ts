import assert from "node:assert/strict"
import test from "node:test"
import { API_CONTRACT_VERSION, normalizeCorrelationId } from "../packages/contracts/src/index.ts"

test("API contract version is explicit", () => {
  assert.equal(API_CONTRACT_VERSION, "2026-09-20")
})

test("correlation IDs preserve valid callers and replace invalid input", () => {
  assert.equal(normalizeCorrelationId("request-1234"), "request-1234")
  assert.match(normalizeCorrelationId("bad"), /^[0-9a-f-]{36}$/)
})
