import type { NextAuthOptions } from "next-auth"
import type { OAuthUserConfig } from "next-auth/providers/oauth"
import ZitadelProvider from "next-auth/providers/zitadel"
import { extractZitadelRoles } from "@vulpine/auth"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"

const issuer = optionalServerEnv(serverEnvNames.zitadelIssuer) ?? ""
const clientId = optionalServerEnv(serverEnvNames.zitadelClientId) ?? ""
const clientSecret = optionalServerEnv(serverEnvNames.zitadelClientSecret)
const audience = optionalServerEnv(serverEnvNames.zitadelAudience)
const nextAuthSecret = optionalServerEnv(serverEnvNames.nextAuthSecret)

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
    async jwt({ token, account, profile }) {
      if (account?.access_token) token.accessToken = account.access_token
      const profileClaims = profile && typeof profile === "object" ? profile as Record<string, unknown> : undefined
      token.roles = extractZitadelRoles(profileClaims, token as Record<string, unknown>)
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.roles = token.roles ?? []
      }
      session.accessToken = token.accessToken
      return session
    },
  },
}

export function authConfigured(): boolean {
  return Boolean(issuer && clientId && nextAuthSecret)
}
