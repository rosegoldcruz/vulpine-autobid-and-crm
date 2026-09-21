import { isVulpineRole, type VulpineRole } from "@vulpine/permissions"

export const ZITADEL_ROLES_CLAIM = "urn:zitadel:iam:org:project:roles" as const

type Claims = Record<string, unknown>

export function extractZitadelRoles(...sources: Array<Claims | null | undefined>): VulpineRole[] {
  const found = new Set<VulpineRole>()

  for (const source of sources) {
    if (!source) continue
    const claim = source[ZITADEL_ROLES_CLAIM]
    if (Array.isArray(claim)) {
      claim.filter((value): value is string => typeof value === "string").forEach((role) => {
        if (isVulpineRole(role)) found.add(role)
      })
    } else if (claim && typeof claim === "object") {
      Object.keys(claim).forEach((role) => {
        if (isVulpineRole(role)) found.add(role)
      })
    }
  }

  return [...found]
}

export type BackofficeIdentity = {
  subject: string
  email?: string | null
  name?: string | null
  roles: VulpineRole[]
}
