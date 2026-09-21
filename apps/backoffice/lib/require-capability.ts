import { getServerSession } from "next-auth"
import { hasCapability, type Capability } from "@vulpine/permissions"
import { authConfigured, authOptions } from "@/lib/auth"
import { apiError } from "@/lib/api-response"

export async function requireCapability(capability: Capability, correlationId: string) {
  if (!authConfigured()) {
    return {
      response: apiError(
        "AUTH_NOT_CONFIGURED",
        "Backoffice authentication is unavailable until ZITADEL environment variables are configured.",
        correlationId,
        503,
      ),
    }
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { response: apiError("UNAUTHENTICATED", "Authentication required.", correlationId, 401) }
  }
  if (!hasCapability(session.user.roles, capability)) {
    return { response: apiError("FORBIDDEN", `Missing required capability: ${capability}`, correlationId, 403) }
  }

  return { session }
}
