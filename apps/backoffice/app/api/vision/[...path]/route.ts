import { normalizeCorrelationId, VULPINE_INTEGRATION_AUTH_HEADER, type ApiErrorCode } from "@vulpine/contracts"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import { apiError, apiSuccess } from "@/lib/api-response"
import { requireCapability } from "@/lib/require-capability"
import { resolveVisionRoute } from "@/lib/vision-proxy"

type RouteContext = { params: Promise<{ path: string[] }> }
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

async function proxy(request: Request, context: RouteContext) {
  const correlationId = normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const requestedPath = (await context.params).path.join("/")
  const rule = resolveVisionRoute(request.method, requestedPath)
  if (!rule) return apiError("NOT_FOUND", "Unknown Vision operation.", correlationId, 404)

  const authorization = await requireCapability(rule.capability, correlationId)
  if ("response" in authorization) return authorization.response
  if (rule.blocked) {
    return apiError("ESTIMATOR_INTELLIGENCE_DISABLED", "Estimator intelligence remains quarantined; this mutation is disabled.", correlationId, 409, { requestedPath })
  }

  const configuredUrl = optionalServerEnv(serverEnvNames.visionApiUrl)
  if (!configuredUrl) return apiError("UPSTREAM_NOT_CONFIGURED", `Missing required env var: ${serverEnvNames.visionApiUrl}`, correlationId, 503)
  let baseUrl: URL
  try {
    baseUrl = new URL(configuredUrl)
  } catch {
    return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.visionApiUrl} must be an absolute URL.`, correlationId, 503)
  }
  if (!ALLOWED_PROTOCOLS.has(baseUrl.protocol)) return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.visionApiUrl} must use HTTP or HTTPS.`, correlationId, 503)

  const headers = new Headers({ "x-correlation-id": correlationId })
  const contentType = request.headers.get("content-type")
  const projectId = request.headers.get("x-project-id")
  if (contentType) headers.set("content-type", contentType)
  if (projectId) headers.set("x-project-id", projectId)
  const token = optionalServerEnv(serverEnvNames.visionApiToken)
  if (token) headers.set(VULPINE_INTEGRATION_AUTH_HEADER, token)

  try {
    const upstream = await fetch(new URL(rule.upstreamPath, `${baseUrl.toString().replace(/\/$/, "")}/`), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
    const text = await upstream.text()
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    const legacy = body && typeof body === "object" ? body as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string; details?: unknown } } : null
    if (!upstream.ok || legacy?.ok === false) {
      return apiError(
        (legacy?.error?.code as ApiErrorCode) || "UPSTREAM_UNAVAILABLE",
        legacy?.error?.message || "Vision rejected the operation.",
        correlationId,
        upstream.status,
        legacy?.error?.details ?? body,
      )
    }
    return apiSuccess(legacy?.ok === true ? legacy.data : body, correlationId, upstream.status)
  } catch (error) {
    return apiError("UPSTREAM_UNAVAILABLE", "Vision is unreachable from Backoffice.", correlationId, 502, error instanceof Error ? error.message : undefined)
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
