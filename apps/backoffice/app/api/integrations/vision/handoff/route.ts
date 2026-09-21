import {
  LEADS_VISION_HANDOFF_AUTH_HEADER,
  leadsVisionHandoffRequestV1Schema,
  leadsVisionHandoffResponseV1Schema,
  normalizeCorrelationId,
} from "@vulpine/contracts"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import { apiError, apiSuccess } from "@/lib/api-response"
import { requireCapability } from "@/lib/require-capability"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const correlationId = normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const authorization = await requireCapability("crm.write", correlationId)
  if ("response" in authorization) return authorization.response
  const configuredUrl = optionalServerEnv(serverEnvNames.visionApiUrl)
  const key = optionalServerEnv(serverEnvNames.visionIntegrationKey)
  if (!configuredUrl || !key) return apiError("INTEGRATION_NOT_CONFIGURED", "Vision Leads handoff is not configured.", correlationId, 503)

  const parsed = leadsVisionHandoffRequestV1Schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid Leads to Vision handoff.", correlationId, 400, parsed.error.issues)
  try {
    const response = await fetch(new URL("/api/integrations/leads/handoff", `${configuredUrl.replace(/\/$/, "")}/`), {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": correlationId, [LEADS_VISION_HANDOFF_AUTH_HEADER]: key },
      body: JSON.stringify({ ...parsed.data, correlationId }),
      cache: "no-store",
    })
    const payload = await response.json().catch(() => null) as { ok?: boolean; data?: unknown; error?: { message?: string; details?: unknown } } | null
    if (!response.ok || payload?.ok === false) return apiError("UPSTREAM_UNAVAILABLE", payload?.error?.message || "Vision rejected the lead handoff.", correlationId, response.status, payload?.error?.details)
    const validated = leadsVisionHandoffResponseV1Schema.safeParse(payload?.ok === true ? payload.data : payload)
    if (!validated.success) return apiError("UPSTREAM_UNAVAILABLE", "Vision returned an invalid handoff contract.", correlationId, 502, validated.error.issues)
    return apiSuccess(validated.data, correlationId, 201)
  } catch (error) {
    return apiError("UPSTREAM_UNAVAILABLE", "Vision is unreachable for lead handoff.", correlationId, 502, error instanceof Error ? error.message : undefined)
  }
}
