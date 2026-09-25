import type { NextAuthOptions } from "next-auth"
import type { OAuthUserConfig } from "next-auth/providers/oauth"
import ZitadelProvider from "next-auth/providers/zitadel"
import {
  extractZitadelRolesFromAssignments,
  extractZitadelRolesForProject,
  resolveZitadelOrganizationId,
  zitadelProjectRolesClaim,
  zitadelRoleClaimKeys,
  ZITADEL_API_AUDIENCE_SCOPE,
  ZITADEL_PROJECT_ROLES_SCOPE,
  ZITADEL_PROJECTS_ROLES_SCOPE,
  ZITADEL_ROLES_CLAIM,
} from "@vulpine/auth"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import { capabilitiesForRoles } from "@vulpine/permissions"

const issuer = optionalServerEnv(serverEnvNames.zitadelIssuer) ?? ""
const clientId = optionalServerEnv(serverEnvNames.zitadelClientId) ?? ""
const clientSecret = optionalServerEnv(serverEnvNames.zitadelClientSecret)
const audience = optionalServerEnv(serverEnvNames.zitadelAudience)
const nextAuthSecret = optionalServerEnv(serverEnvNames.nextAuthSecret)

type Claims = Record<string, unknown>

function decodeJwtClaims(rawToken: unknown): Claims | undefined {
  if (typeof rawToken !== "string") return undefined
  const payload = rawToken.split(".")[1]
  if (!payload) return undefined
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return parsed && typeof parsed === "object" ? parsed as Claims : undefined
  } catch {
    return undefined
  }
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return value.split(" ").filter(Boolean)
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function assignedRoleNames(projectId: string, ...sources: Array<Claims | undefined>): string[] {
  const result = new Set<string>()
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const hasProjectSpecificClaim = sources.some((source) => source?.[projectClaim] !== undefined)
  for (const source of sources) {
    if (!source) continue
    const claim = hasProjectSpecificClaim ? source[projectClaim] : source[ZITADEL_ROLES_CLAIM]
    if (Array.isArray(claim)) {
      stringValues(claim).forEach((role) => result.add(role))
    } else if (claim && typeof claim === "object") {
      Object.keys(claim).forEach((role) => result.add(role))
    }
  }
  return [...result]
}

function assignedOrganizations(projectId: string, ...sources: Array<Claims | undefined>) {
  const organizations = new Map<string, string | undefined>()
  const projectClaim = zitadelProjectRolesClaim(projectId)
  const hasProjectSpecificClaim = sources.some((source) => source?.[projectClaim] !== undefined)
  for (const source of sources) {
    if (!source) continue
    const resourceOwnerId = source["urn:zitadel:iam:user:resourceowner:id"]
    const resourceOwnerDomain = source["urn:zitadel:iam:user:resourceowner:primary_domain"]
    if (typeof resourceOwnerId === "string") {
      organizations.set(resourceOwnerId, typeof resourceOwnerDomain === "string" ? resourceOwnerDomain : undefined)
    }

    const claim = hasProjectSpecificClaim ? source[projectClaim] : source[ZITADEL_ROLES_CLAIM]
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) continue
    for (const assignment of Object.values(claim)) {
      if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) continue
      for (const [organizationId, domain] of Object.entries(assignment)) {
        organizations.set(organizationId, typeof domain === "string" ? domain : organizations.get(organizationId))
      }
    }
  }
  return [...organizations].map(([id, domain]) => ({ id, ...(domain ? { domain } : {}) }))
}

function record(value: unknown): Claims | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Claims : undefined
}

async function responseJson(response: Response): Promise<Claims | undefined> {
  if (!response.ok) return undefined
  try {
    return record(await response.json())
  } catch {
    return undefined
  }
}

async function inspectZitadelProject(accessToken: string, projectId: string) {
  const baseUrl = issuer.replace(/\/$/, "")
  const commonHeaders = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  }
  const [projectResponse, rolesResponse, assignmentsResponse] = await Promise.all([
    fetch(`${baseUrl}/zitadel.project.v2.ProjectService/GetProject`, {
      method: "POST",
      headers: { ...commonHeaders, "connect-protocol-version": "1" },
      body: JSON.stringify({ projectId }),
      signal: AbortSignal.timeout(5_000),
    }),
    fetch(`${baseUrl}/zitadel.project.v2.ProjectService/ListProjectRoles`, {
      method: "POST",
      headers: { ...commonHeaders, "connect-protocol-version": "1" },
      body: JSON.stringify({ projectId }),
      signal: AbortSignal.timeout(5_000),
    }),
    fetch(`${baseUrl}/auth/v1/usergrants/me/_search`, {
      method: "POST",
      headers: commonHeaders,
      body: "{}",
      signal: AbortSignal.timeout(5_000),
    }),
  ])

  const [projectBody, rolesBody, assignmentsBody] = await Promise.all([
    responseJson(projectResponse),
    responseJson(rolesResponse),
    responseJson(assignmentsResponse),
  ])
  const project = record(projectBody?.project)
  const projectRoles = Array.isArray(rolesBody?.projectRoles) ? rolesBody.projectRoles : []
  const assignments = Array.isArray(assignmentsBody?.result) ? assignmentsBody.result : []

  return {
    projectId,
    assertRolesOnAuthentication: typeof project?.projectRoleAssertion === "boolean" ? project.projectRoleAssertion : null,
    projectRoleKeys: projectRoles
      .map((role) => record(role)?.key)
      .filter((key): key is string => typeof key === "string"),
    userRoleAssignments: assignments
      .map(record)
      .filter((assignment): assignment is Claims => assignment?.projectId === projectId)
      .map((assignment) => ({
        projectId: typeof assignment.projectId === "string" ? assignment.projectId : null,
        userId: typeof assignment.userId === "string" ? assignment.userId : null,
        roleNames: stringValues(assignment.roleKeys ?? assignment.roles),
        organizationId: typeof assignment.orgId === "string" ? assignment.orgId : null,
        organizationDomain: typeof assignment.orgDomain === "string" ? assignment.orgDomain : null,
      })),
    inspectionStatus: {
      project: projectResponse.status,
      projectRoles: rolesResponse.status,
      userRoleAssignments: assignmentsResponse.status,
    },
  }
}

if (optionalServerEnv(serverEnvNames.nextAuthUrl)) {
  process.env.NEXTAUTH_URL = optionalServerEnv(serverEnvNames.nextAuthUrl)
}

const providerOptions = {
  issuer,
  clientId,
  client: {
    token_endpoint_auth_method: clientSecret ? "client_secret_post" : "none",
  },
  authorization: {
    params: {
      scope: ["openid", "email", "profile", audience ? `urn:zitadel:iam:org:project:id:${audience}:aud` : ""]
        .concat(audience ? [ZITADEL_PROJECT_ROLES_SCOPE, ZITADEL_PROJECTS_ROLES_SCOPE, ZITADEL_API_AUDIENCE_SCOPE] : [])
        .filter(Boolean)
        .join(" "),
    },
  },
  ...(clientSecret ? { clientSecret } : {}),
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  providers: [ZitadelProvider(providerOptions as OAuthUserConfig<unknown>)],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile, account }) {
      const profileClaims = profile && typeof profile === "object" ? profile as Record<string, unknown> : undefined
      if (profileClaims || account) {
        const idTokenClaims = decodeJwtClaims(account?.id_token)
        const accessTokenClaims = decodeJwtClaims(account?.access_token)
        const claimSources = [profileClaims, idTokenClaims, accessTokenClaims]
        const subject = profileClaims?.sub ?? idTokenClaims?.sub ?? accessTokenClaims?.sub ?? token.sub
        let projectInspection: Awaited<ReturnType<typeof inspectZitadelProject>> | undefined

        // Authorization first trusts NextAuth's validated ID token and provider userinfo.
        // If ZITADEL omits role claims, its authenticated /me grants response is the
        // authoritative server-side fallback for this same subject and project.
        const claimRoles = audience ? extractZitadelRolesForProject(audience, profileClaims, idTokenClaims) : []

        if (audience && account?.access_token) {
          try {
            projectInspection = await inspectZitadelProject(account.access_token, audience)
            console.info(JSON.stringify({
              event: "zitadel.authorization.project-inspection",
              ...projectInspection,
            }))
          } catch (error) {
            console.warn(JSON.stringify({
              event: "zitadel.authorization.project-inspection",
              projectId: audience,
              inspectionError: error instanceof Error ? error.name : "UnknownError",
            }))
          }
        }

        const assignmentRoles = audience && typeof subject === "string" && projectInspection
          ? extractZitadelRolesFromAssignments(audience, subject, projectInspection.userRoleAssignments)
          : []
        token.roles = [...new Set([...claimRoles, ...assignmentRoles])]
        token.capabilities = capabilitiesForRoles(token.roles)
        const organizationId = audience && typeof subject === "string"
          ? resolveZitadelOrganizationId(
              audience,
              subject,
              projectInspection?.userRoleAssignments ?? [],
              profileClaims,
              idTokenClaims,
            )
          : undefined
        if (organizationId) token.organizationId = organizationId
        else delete token.organizationId

        const audiences = new Set<string>()
        const scopes = new Set<string>(stringValues(account?.scope))
        for (const claims of [idTokenClaims, accessTokenClaims]) {
          stringValues(claims?.aud).forEach((value) => audiences.add(value))
          stringValues(claims?.scope).forEach((value) => scopes.add(value))
        }

        console.info(JSON.stringify({
          event: "zitadel.authorization.normalized",
          subject: subject ?? null,
          audiences: [...audiences],
          scopes: [...scopes],
          roleClaimKeys: zitadelRoleClaimKeys(...claimSources),
          roleNames: audience ? assignedRoleNames(audience, ...claimSources) : [],
          normalizedRoles: token.roles,
          normalizedCapabilities: token.capabilities,
          organizationId: token.organizationId ?? null,
          organizations: audience ? assignedOrganizations(audience, ...claimSources) : [],
        }))
      }
      token.roles ??= []
      token.capabilities = capabilitiesForRoles(token.roles)
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.roles = token.roles ?? []
        session.user.capabilities = capabilitiesForRoles(token.roles ?? [])
        session.user.organizationId = token.organizationId
      }
      return session
    },
  },
}

export function authConfigured(): boolean {
  return Boolean(issuer && clientId && nextAuthSecret)
}
