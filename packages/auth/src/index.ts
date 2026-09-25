import { hasCapability, isVulpineRole, type VulpineRole } from "@vulpine/permissions"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

export const ZITADEL_ROLES_CLAIM = "urn:zitadel:iam:org:project:roles" as const
export const ZITADEL_PROJECT_ROLES_SCOPE = "urn:iam:org:project:roles" as const
export const ZITADEL_PROJECTS_ROLES_SCOPE = "urn:zitadel:iam:org:projects:roles" as const
export const ZITADEL_API_AUDIENCE_SCOPE = "urn:zitadel:iam:org:project:id:zitadel:aud" as const

type Claims = Record<string, unknown>

export function zitadelProjectRolesClaim(projectId: string): string {
  return `urn:zitadel:iam:org:project:${projectId}:roles`
}

function addRoles(found: Set<VulpineRole>, claim: unknown) {
  const roleNames = Array.isArray(claim)
    ? claim.filter((value): value is string => typeof value === "string")
    : claim && typeof claim === "object"
      ? Object.keys(claim)
      : []

  for (const roleName of roleNames) {
    const normalized = roleName.trim().toLowerCase()
    if (isVulpineRole(normalized)) found.add(normalized)
  }
}

export function extractZitadelRoles(...sources: Array<Claims | null | undefined>): VulpineRole[] {
  const found = new Set<VulpineRole>()

  for (const source of sources) {
    if (!source) continue
    addRoles(found, source[ZITADEL_ROLES_CLAIM])
  }

  return [...found]
}

export function extractZitadelRolesForProject(
  projectId: string,
  ...sources: Array<Claims | null | undefined>
): VulpineRole[] {
  const found = new Set<VulpineRole>()
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const hasProjectSpecificClaim = sources.some((source) => source?.[projectClaim] !== undefined)

  for (const source of sources) {
    if (!source) continue
    addRoles(found, hasProjectSpecificClaim ? source[projectClaim] : source[ZITADEL_ROLES_CLAIM])
  }

  return [...found]
}

export function extractZitadelRolesFromAssignments(
  projectId: string,
  subject: string,
  assignments: Array<Claims | null | undefined>,
): VulpineRole[] {
  const found = new Set<VulpineRole>()

  for (const assignment of assignments) {
    if (!assignment) continue
    if (assignment.projectId !== projectId || assignment.userId !== subject) continue
    addRoles(found, assignment.roleNames ?? assignment.roleKeys ?? assignment.roles)
  }

  return [...found]
}

function normalizedOrganizationId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function roleClaimOrganizationIds(projectId: string, ...sources: Array<Claims | null | undefined>): string[] {
  const found = new Set<string>()
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const hasProjectSpecificClaim = sources.some((source) => source?.[projectClaim] !== undefined)

  for (const source of sources) {
    if (!source) continue
    const claim = source[hasProjectSpecificClaim ? projectClaim : ZITADEL_ROLES_CLAIM]
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) continue
    for (const [roleName, assignments] of Object.entries(claim)) {
      if (!isVulpineRole(roleName.trim().toLowerCase())) continue
      if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) continue
      for (const organizationId of Object.keys(assignments)) {
        const normalized = normalizedOrganizationId(organizationId)
        if (normalized) found.add(normalized)
      }
    }
  }
  return [...found]
}

function resourceOwnerOrganizationIds(...sources: Array<Claims | null | undefined>): string[] {
  const found = new Set<string>()
  for (const source of sources) {
    const organizationId = normalizedOrganizationId(source?.["urn:zitadel:iam:user:resourceowner:id"])
    if (organizationId) found.add(organizationId)
  }
  return [...found]
}

export function extractZitadelOrganizationIdsFromAssignments(
  projectId: string,
  subject: string,
  assignments: Array<Claims | null | undefined>,
): string[] {
  const found = new Set<string>()
  for (const assignment of assignments) {
    if (!assignment || assignment.projectId !== projectId || assignment.userId !== subject) continue
    if (!extractZitadelRolesFromAssignments(projectId, subject, [assignment]).length) continue
    const organizationId = normalizedOrganizationId(assignment.organizationId ?? assignment.orgId)
    if (organizationId) found.add(organizationId)
  }
  return [...found]
}

/** Resolve one verified ZITADEL organization or fail closed on absence/ambiguity. */
export function resolveZitadelOrganizationId(
  projectId: string,
  subject: string,
  assignments: Array<Claims | null | undefined>,
  ...sources: Array<Claims | null | undefined>
): string | undefined {
  const projectOrganizations = new Set([
    ...roleClaimOrganizationIds(projectId, ...sources),
    ...extractZitadelOrganizationIdsFromAssignments(projectId, subject, assignments),
  ])
  if (projectOrganizations.size) {
    return projectOrganizations.size === 1 ? [...projectOrganizations][0] : undefined
  }

  const resourceOwners = resourceOwnerOrganizationIds(...sources)
  return resourceOwners.length === 1 ? resourceOwners[0] : undefined
}

export function zitadelRoleClaimKeys(...sources: Array<Claims | null | undefined>): string[] {
  const keys = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      if (key === ZITADEL_ROLES_CLAIM || /^urn:zitadel:iam:org:project:[^:]+:roles$/.test(key)) keys.add(key)
    }
  }
  return [...keys]
}

export type BackofficeIdentity = {
  subject: string
  email?: string | null
  name?: string | null
  roles: VulpineRole[]
}

export const visionPrincipalScopes = [
  "project:read",
  "project:upload",
  "unit_mix:modify",
  "unit_mix:approve",
  "sku:override",
  "pricing:change",
  "qa:approve",
  "bid:mark_safe",
  "export:create",
  "outreach:send",
  "settings:admin",
  "engineering:inspect",
] as const

export type VisionPrincipalScope = (typeof visionPrincipalScopes)[number]
export type VisionPrincipalRole = "admin" | "estimator" | "reviewer" | "viewer"

const scopesByVisionRole: Record<VisionPrincipalRole, readonly VisionPrincipalScope[]> = {
  admin: visionPrincipalScopes,
  estimator: ["project:read", "project:upload", "unit_mix:modify", "sku:override", "export:create"],
  reviewer: ["project:read", "unit_mix:modify", "unit_mix:approve", "sku:override", "pricing:change", "export:create"],
  viewer: ["project:read"],
}

export function visionPrincipalGrant(inputRoles: readonly string[]): {
  role: VisionPrincipalRole
  scopes: VisionPrincipalScope[]
} | null {
  const normalized = new Set(inputRoles.map((role) => role.trim().toLowerCase()))
  const role: VisionPrincipalRole | null = normalized.has("admin")
    ? "admin"
    : normalized.has("estimator")
      ? "estimator"
      : normalized.has("operations")
        ? "reviewer"
        : hasCapability([...normalized], "vision.read")
          ? "viewer"
          : null
  return role ? { role, scopes: [...scopesByVisionRole[role]] } : null
}

export type VisionPrincipalTokenPayload = {
  v: 1
  sub: string
  org: string
  role: VisionPrincipalRole
  scopes: VisionPrincipalScope[]
  iat: number
  exp: number
  nonce: string
}

function visionPrincipalSignature(payloadSegment: string, secret: string) {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url")
}

export function signVisionPrincipalToken(input: {
  subject: string
  organizationId: string
  roles: readonly string[]
  secret: string
  nowSeconds?: number
  ttlSeconds?: number
  nonce?: string
}): string {
  const subject = input.subject.trim()
  const organizationId = input.organizationId.trim()
  if (!subject || !organizationId || !input.secret) throw new Error("Vision principal token identity and secret are required.")
  const grant = visionPrincipalGrant(input.roles)
  if (!grant) throw new Error("Vision principal token requires a recognized Vision role.")
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000)
  const ttlSeconds = input.ttlSeconds ?? 60
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
    throw new Error("Vision principal token lifetime is invalid.")
  }
  const payload: VisionPrincipalTokenPayload = {
    v: 1,
    sub: subject,
    org: organizationId,
    role: grant.role,
    scopes: grant.scopes,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    nonce: input.nonce?.trim() || randomUUID(),
  }
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadSegment}.${visionPrincipalSignature(payloadSegment, input.secret)}`
}

export function verifyVisionPrincipalToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): VisionPrincipalTokenPayload | null {
  const [payloadSegment, suppliedSignature, ...extra] = token.split(".")
  if (!payloadSegment || !suppliedSignature || extra.length || !secret || !Number.isSafeInteger(nowSeconds)) return null
  const expectedSignature = visionPrincipalSignature(payloadSegment, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as Partial<VisionPrincipalTokenPayload>
    if (
      payload.v !== 1
      || typeof payload.sub !== "string" || !payload.sub
      || typeof payload.org !== "string" || !payload.org
      || !["admin", "estimator", "reviewer", "viewer"].includes(payload.role || "")
      || !Array.isArray(payload.scopes)
      || payload.scopes.some((scope) => !(visionPrincipalScopes as readonly string[]).includes(scope))
      || typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat)
      || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp)
      || payload.iat > nowSeconds + 30
      || payload.exp <= nowSeconds
      || payload.exp <= payload.iat
      || payload.exp - payload.iat > 300
      || typeof payload.nonce !== "string" || !payload.nonce
    ) return null
    const role = payload.role as VisionPrincipalRole
    const expectedScopes = scopesByVisionRole[role]
    if (payload.scopes.length !== expectedScopes.length || expectedScopes.some((scope) => !payload.scopes!.includes(scope))) return null
    return payload as VisionPrincipalTokenPayload
  } catch {
    return null
  }
}

export type DriveTransferAction = "upload" | "preview" | "download"

export type DriveTransferTicketPayload = {
  version: 1
  action: DriveTransferAction
  path: string
  subject: string
  expiresAt: number
}

function driveTicketSignature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

export function signDriveTransferTicket(
  input: Omit<DriveTransferTicketPayload, "version" | "expiresAt"> & { expiresAt?: number },
  secret: string,
) {
  const payload: DriveTransferTicketPayload = {
    version: 1,
    action: input.action,
    path: input.path,
    subject: input.subject,
    expiresAt: input.expiresAt ?? Date.now() + 5 * 60_000,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encodedPayload}.${driveTicketSignature(encodedPayload, secret)}`
}

export function verifyDriveTransferTicket(
  ticket: string,
  secret: string,
  expectedAction: DriveTransferAction,
  expectedPath: string,
): DriveTransferTicketPayload | null {
  const [encodedPayload, providedSignature, ...extra] = ticket.split(".")
  if (!encodedPayload || !providedSignature || extra.length) return null
  const expectedSignature = driveTicketSignature(encodedPayload, secret)
  const provided = Buffer.from(providedSignature)
  const expected = Buffer.from(expectedSignature)
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<DriveTransferTicketPayload>
    if (
      payload.version !== 1
      || payload.action !== expectedAction
      || payload.path !== expectedPath
      || typeof payload.subject !== "string"
      || !payload.subject
      || typeof payload.expiresAt !== "number"
      || payload.expiresAt <= Date.now()
      || payload.expiresAt > Date.now() + 10 * 60_000
    ) return null
    return payload as DriveTransferTicketPayload
  } catch {
    return null
  }
}
