import assert from "node:assert/strict"
import test from "node:test"
import {
  extractZitadelRoles,
  extractZitadelRolesFromAssignments,
  extractZitadelRolesForProject,
  zitadelProjectRolesClaim,
  zitadelRoleClaimKeys,
  ZITADEL_ROLES_CLAIM,
} from "../packages/auth/src/index.ts"

test("ZITADEL project role claims are normalized and allowlisted", () => {
  assert.deepEqual(
    extractZitadelRoles({ [ZITADEL_ROLES_CLAIM]: { estimator: {}, admin: {}, unknown: {} } }),
    ["estimator", "admin"],
  )
})

test("project-specific ZITADEL roles are preferred and normalized", () => {
  const projectId = "384709592371738245"
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const claims = {
    [projectClaim]: { Admin: { "org-1": "vulpine.llc" }, estimator: {} },
  }

  assert.deepEqual(
    extractZitadelRolesForProject(projectId, { [ZITADEL_ROLES_CLAIM]: { sales: {} } }, claims),
    ["admin", "estimator"],
  )
  assert.deepEqual(zitadelRoleClaimKeys(claims), [projectClaim])
})

test("generic role claims remain a safe compatibility fallback", () => {
  assert.deepEqual(extractZitadelRolesForProject("project-1", { [ZITADEL_ROLES_CLAIM]: ["operations"] }), ["operations"])
})

test("server-side ZITADEL role assignments are scoped to the authenticated subject and project", () => {
  const assignments = [
    { projectId: "project-1", userId: "user-1", roleNames: ["admin", "unknown"] },
    { projectId: "project-1", userId: "user-2", roleNames: ["executive"] },
    { projectId: "project-2", userId: "user-1", roleNames: ["sales"] },
  ]

  assert.deepEqual(extractZitadelRolesFromAssignments("project-1", "user-1", assignments), ["admin"])
})
