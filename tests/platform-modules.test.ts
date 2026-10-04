import assert from "node:assert/strict"
import test from "node:test"
import { capabilities, hasCapability, roles } from "../packages/permissions/src/index.ts"
import { canAccessModule, moduleForPath, platformModules, visiblePlatformModules } from "../apps/backoffice/lib/platform-modules.ts"
import { visibleSectionsForRoles } from "../apps/backoffice/lib/backoffice-access.ts"

test("every registered module has a unique real route and canonical capability", () => {
  assert.equal(new Set(platformModules.map((module) => module.id)).size, platformModules.length)
  assert.equal(new Set(platformModules.map((module) => module.path)).size, platformModules.length)
  for (const module of platformModules) {
    assert.equal(moduleForPath(module.path)?.id, module.id)
    assert.ok(capabilities.includes(module.capability))
    assert.ok(module.purpose.length && module.boundary.length)
  }
  assert.equal(moduleForPath("/unknown-module"), undefined)
  assert.equal(moduleForPath("/ai/hermes/unknown"), undefined)
  assert.equal(moduleForPath("/dashboard")?.id, "dashboard")
})

test("sidebar and server-route authorization agree for every role and module", () => {
  for (const role of [...roles, "unknown"]) {
    const sidebar = visibleSectionsForRoles([role])
    for (const module of platformModules) {
      const expected = hasCapability([role], module.capability)
      assert.equal(canAccessModule([role], module.id), expected)
      assert.equal(sidebar.includes(module.id), expected, `${role}: ${module.id}`)
    }
  }
  assert.deepEqual(visiblePlatformModules([]), [])
  assert.deepEqual(visiblePlatformModules(["unassigned"]), [])
})

test("expanded surfaces preserve live modules and restrict administration", () => {
  assert.equal(moduleForPath("/bids/tracker")?.id, "bidstracker")
  assert.equal(moduleForPath("/bids/vision")?.id, "vision")
  assert.equal(moduleForPath("/drive")?.id, "drive")
  assert.equal(canAccessModule(["estimator"], "providers"), false)
  assert.equal(canAccessModule(["sales"], "backups"), false)
  assert.equal(canAccessModule(["admin"], "permissions"), true)
  assert.equal(visiblePlatformModules(["admin"]).length, platformModules.length)
})
