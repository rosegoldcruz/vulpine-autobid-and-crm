import assert from "node:assert/strict"
import test from "node:test"
import { capabilitiesForRoles, hasCapability } from "../packages/permissions/src/index.ts"

test("admin receives every capability", () => {
  assert.equal(hasCapability(["admin"], "dashboard.read"), true)
  assert.equal(hasCapability(["admin"], "settings.read"), true)
  assert.equal(hasCapability(["admin"], "settings.manage"), true)
  assert.equal(hasCapability(["admin"], "bids.delete"), true)
  assert.equal(hasCapability(["admin"], "bids.write"), true)
  assert.equal(hasCapability(["admin"], "vision.write"), true)
  assert.equal(hasCapability(["admin"], "drive.read"), true)
  assert.equal(hasCapability(["admin"], "drive.write"), true)
})

test("estimator can operate bids without settings access", () => {
  assert.equal(hasCapability(["estimator"], "bids.write"), true)
  assert.equal(hasCapability(["estimator"], "settings.manage"), false)
  assert.equal(hasCapability(["estimator"], "settings.read"), true)
})

test("unknown roles receive no capabilities", () => {
  assert.deepEqual(capabilitiesForRoles(["unknown"]), [])
})

test("Vision access is read-only by default and write-enabled only for estimators/admins", () => {
  assert.equal(hasCapability(["executive"], "vision.read"), true)
  assert.equal(hasCapability(["executive"], "vision.write"), false)
  assert.equal(hasCapability(["operations"], "vision.read"), true)
  assert.equal(hasCapability(["operations"], "vision.write"), false)
  assert.equal(hasCapability(["estimator"], "vision.write"), true)
  assert.equal(hasCapability(["admin"], "vision.write"), true)
})

test("Drive access follows the canonical role capability map", () => {
  assert.equal(hasCapability(["executive"], "drive.read"), true)
  assert.equal(hasCapability(["executive"], "drive.write"), false)
  assert.equal(hasCapability(["operations"], "drive.write"), true)
  assert.equal(hasCapability(["estimator"], "drive.read"), true)
  assert.equal(hasCapability(["estimator"], "drive.write"), false)
  assert.equal(hasCapability(["admin"], "drive.write"), true)
})
