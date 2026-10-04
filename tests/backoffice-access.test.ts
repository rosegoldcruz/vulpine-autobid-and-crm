import assert from "node:assert/strict"
import test from "node:test"
import { visibleSectionsForRoles } from "../apps/backoffice/lib/backoffice-access.ts"

test("sidebar sections derive from the canonical role capability map", () => {
  const originalSections = ["dashboard", "phone", "autobid", "bidstracker", "vision", "drive", "settings"]
  assert.deepEqual(visibleSectionsForRoles(["estimator"]).filter((id) => originalSections.includes(id)), [
    "dashboard",
    "phone",
    "autobid",
    "bidstracker",
    "vision",
    "drive",
    "settings",
  ])
  assert.deepEqual(visibleSectionsForRoles(["unknown"]), [])
})
