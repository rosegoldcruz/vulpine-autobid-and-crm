import assert from "node:assert/strict"
import test from "node:test"
import { extractZitadelRoles, ZITADEL_ROLES_CLAIM } from "../packages/auth/src/index.ts"

test("ZITADEL project role claims are normalized and allowlisted", () => {
  assert.deepEqual(
    extractZitadelRoles({ [ZITADEL_ROLES_CLAIM]: { estimator: {}, admin: {}, unknown: {} } }),
    ["estimator", "admin"],
  )
})
