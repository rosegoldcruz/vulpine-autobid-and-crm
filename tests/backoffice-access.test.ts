import assert from "node:assert/strict"
import test from "node:test"
import { visibleSectionsForRoles } from "../apps/backoffice/lib/backoffice-access.ts"

test("sidebar sections derive from the canonical role capability map", () => {
  assert.deepEqual(visibleSectionsForRoles(["estimator"]), [
    "dashboard",
    "autobid",
    "bidstracker",
    "vision",
    "drive",
    "settings",
  ])
  assert.deepEqual(visibleSectionsForRoles(["unknown"]), [])
})
