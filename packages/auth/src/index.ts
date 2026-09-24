import { isVulpineRole, type VulpineRole } from "@vulpine/permissions"
import { createHmac, timingSafeEqual } from "node:crypto"

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
