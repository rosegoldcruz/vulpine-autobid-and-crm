import type { NextAuthOptions } from "next-auth";
import type { OAuthUserConfig } from "next-auth/providers/oauth";
import ZitadelProvider from "next-auth/providers/zitadel";
import { serverEnv } from "@/lib/server-env";

const nextAuthUrl = serverEnv("NEXTAUTH_URL");
if (nextAuthUrl) process.env.NEXTAUTH_URL ||= nextAuthUrl;
process.env.NEXTAUTH_SECRET ||= serverEnv("NEXTAUTH_SECRET", "AUTH_SECRET");

const issuer = serverEnv("ZITADEL_ISSUER", "AUTH_ZITADEL_ISSUER");
const clientId = serverEnv("ZITADEL_CLIENT_ID", "AUTH_ZITADEL_ID");
const clientSecret = serverEnv("ZITADEL_CLIENT_SECRET", "AUTH_ZITADEL_SECRET");
const zitadelProviderOptions = {
  issuer,
  clientId,
  client: {
    token_endpoint_auth_method: clientSecret ? "client_secret_post" : "none",
  },
  authorization: {
    params: {
      scope: "openid email profile",
    },
  },
  ...(clientSecret ? { clientSecret } : {}),
};

export const authOptions: NextAuthOptions = {
  secret: serverEnv("NEXTAUTH_SECRET", "AUTH_SECRET"),
  providers: [
    ZitadelProvider(zitadelProviderOptions as OAuthUserConfig<unknown>),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user = {
          ...session.user,
          id: token.sub,
        };
      }
      return session;
    },
  },
};

export function authConfigured() {
  return Boolean(issuer && clientId && serverEnv("NEXTAUTH_SECRET", "AUTH_SECRET"));
}
