import assert from "node:assert/strict"
import test from "node:test"
import { capabilitiesForRoles, hasCapability } from "../packages/permissions/src/index.ts"

test("admin receives every capability", () => {
  assert.equal(hasCapability(["admin"], "settings.manage"), true)
  assert.equal(hasCapability(["admin"], "bids.delete"), true)
})

test("estimator can operate bids without settings access", () => {
  assert.equal(hasCapability(["estimator"], "bids.write"), true)
  assert.equal(hasCapability(["estimator"], "settings.manage"), false)
})

test("unknown roles receive no capabilities", () => {
  assert.deepEqual(capabilitiesForRoles(["unknown"]), [])
})
