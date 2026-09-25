import assert from "node:assert/strict"
import test from "node:test"
import {
  extractZitadelOrganizationIdsFromAssignments,
  extractZitadelRoles,
  extractZitadelRolesFromAssignments,
  extractZitadelRolesForProject,
  resolveZitadelOrganizationId,
  signVisionPrincipalToken,
  verifyVisionPrincipalToken,
  visionPrincipalGrant,
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

test("ZITADEL organization resolution requires one verified project organization", () => {
  const projectId = "project-1"
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const claims = {
    [projectClaim]: { estimator: { "org-1": "vulpine.llc" } },
    "urn:zitadel:iam:user:resourceowner:id": "different-home-org",
  }
  const assignments = [
    { projectId, userId: "user-1", roleNames: ["estimator"], organizationId: "org-1" },
    { projectId, userId: "other-user", roleNames: ["admin"], organizationId: "org-2" },
  ]

  assert.deepEqual(extractZitadelOrganizationIdsFromAssignments(projectId, "user-1", assignments), ["org-1"])
  assert.equal(resolveZitadelOrganizationId(projectId, "user-1", assignments, claims), "org-1")
  assert.equal(resolveZitadelOrganizationId(projectId, "user-1", [], {
    [projectClaim]: { estimator: { "org-1": "one", "org-2": "two" } },
  }), undefined)
  assert.equal(resolveZitadelOrganizationId(projectId, "user-1", [], {}), undefined)
})

test("Vision principal roles and engine scopes are least privilege", () => {
  assert.deepEqual(visionPrincipalGrant(["admin"]), {
    role: "admin",
    scopes: [
      "project:read", "project:upload", "unit_mix:modify", "unit_mix:approve", "sku:override",
      "pricing:change", "qa:approve", "bid:mark_safe", "export:create", "outreach:send",
      "settings:admin", "engineering:inspect",
    ],
  })
  assert.deepEqual(visionPrincipalGrant(["estimator"]), {
    role: "estimator",
    scopes: ["project:read", "project:upload", "unit_mix:modify", "sku:override", "export:create"],
  })
  assert.deepEqual(visionPrincipalGrant(["operations"]), {
    role: "reviewer",
    scopes: ["project:read", "unit_mix:modify", "unit_mix:approve", "sku:override", "pricing:change", "export:create"],
  })
  assert.deepEqual(visionPrincipalGrant(["executive"]), { role: "viewer", scopes: ["project:read"] })
  assert.deepEqual(visionPrincipalGrant(["nbc"]), { role: "viewer", scopes: ["project:read"] })
  assert.equal(visionPrincipalGrant(["finance"]), null)
})

test("Vision principal tokens are exact, short-lived, and tamper evident", () => {
  const token = signVisionPrincipalToken({
    subject: "user-1",
    organizationId: "org-1",
    roles: ["operations"],
    secret: "integration-secret",
    nowSeconds: 1_000,
    ttlSeconds: 60,
    nonce: "nonce-1",
  })
  const [payloadSegment] = token.split(".")
  assert.deepEqual(JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")), {
    v: 1,
    sub: "user-1",
    org: "org-1",
    role: "reviewer",
    scopes: ["project:read", "unit_mix:modify", "unit_mix:approve", "sku:override", "pricing:change", "export:create"],
    iat: 1_000,
    exp: 1_060,
    nonce: "nonce-1",
  })
  assert.deepEqual(verifyVisionPrincipalToken(token, "integration-secret", 1_030), {
    v: 1,
    sub: "user-1",
    org: "org-1",
    role: "reviewer",
    scopes: ["project:read", "unit_mix:modify", "unit_mix:approve", "sku:override", "pricing:change", "export:create"],
    iat: 1_000,
    exp: 1_060,
    nonce: "nonce-1",
  })
  assert.equal(verifyVisionPrincipalToken(`${payloadSegment}.tampered`, "integration-secret", 1_030), null)
  assert.equal(verifyVisionPrincipalToken(token, "wrong-secret", 1_030), null)
  assert.equal(verifyVisionPrincipalToken(token, "integration-secret", 1_060), null)
})
