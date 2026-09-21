import type { DefaultSession } from "next-auth"
import type { DefaultJWT } from "next-auth/jwt"
import type { VulpineRole } from "@vulpine/permissions"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: DefaultSession["user"] & {
      id: string
      roles: VulpineRole[]
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string
    roles?: VulpineRole[]
  }
}
