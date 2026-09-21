import type { NextAuthOptions } from "next-auth"
import type { OAuthUserConfig } from "next-auth/providers/oauth"
import ZitadelProvider from "next-auth/providers/zitadel"
import {
  extractZitadelRolesForProject,
  zitadelProjectRolesClaim,
  zitadelRoleClaimKeys,
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
        .concat(audience ? [ZITADEL_PROJECT_ROLES_SCOPE, ZITADEL_PROJECTS_ROLES_SCOPE] : [])
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
        // Authorization trusts NextAuth's validated ID token and provider userinfo.
        // The access-token payload is decoded only for sanitized diagnostics below.
        token.roles = audience ? extractZitadelRolesForProject(audience, profileClaims, idTokenClaims) : []
        token.capabilities = capabilitiesForRoles(token.roles)

        const audiences = new Set<string>()
        const scopes = new Set<string>(stringValues(account?.scope))
        for (const claims of [idTokenClaims, accessTokenClaims]) {
          stringValues(claims?.aud).forEach((value) => audiences.add(value))
          stringValues(claims?.scope).forEach((value) => scopes.add(value))
        }

        console.info(JSON.stringify({
          event: "zitadel.authorization.normalized",
          subject: profileClaims?.sub ?? idTokenClaims?.sub ?? accessTokenClaims?.sub ?? token.sub ?? null,
          audiences: [...audiences],
          scopes: [...scopes],
          roleClaimKeys: zitadelRoleClaimKeys(...claimSources),
          roleNames: audience ? assignedRoleNames(audience, ...claimSources) : [],
          normalizedRoles: token.roles,
          normalizedCapabilities: token.capabilities,
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
      }
      return session
    },
  },
}

export function authConfigured(): boolean {
  return Boolean(issuer && clientId && nextAuthSecret)
}
