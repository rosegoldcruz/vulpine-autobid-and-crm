import { signVisionPrincipalToken, visionPrincipalGrant } from "@vulpine/auth"
import {
  normalizeCorrelationId,
  VULPINE_INTEGRATION_AUTH_HEADER,
  VULPINE_PRINCIPAL_HEADER,
  type ApiErrorCode,
} from "@vulpine/contracts"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import { apiError, apiSuccess } from "@/lib/api-response"
import { requireCapability } from "@/lib/require-capability"
import { buildVisionUpstreamUrl, resolveVisionRoute, type VisionRouteRule } from "@/lib/vision-proxy"

type RouteContext = { params: Promise<{ path: string[] }> }
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])
const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "if-modified-since", "if-none-match", "last-event-id", "range", "x-project-id"]
const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "x-accel-buffering",
]

type UpstreamEnvelope = {
  ok?: boolean
  data?: unknown
  error?: { code?: string; message?: string; details?: unknown }
}

async function normalizedJsonResponse(upstream: Response, correlationId: string) {
  if (upstream.status === 204) return new Response(null, { status: 204, headers: { "x-correlation-id": correlationId } })
  const text = await upstream.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  const envelope = body && typeof body === "object" ? body as UpstreamEnvelope : null
  if (!upstream.ok || envelope?.ok === false) {
    return apiError(
      (envelope?.error?.code as ApiErrorCode) || "UPSTREAM_UNAVAILABLE",
      envelope?.error?.message || "Vision rejected the operation.",
      correlationId,
      upstream.status,
      envelope?.error?.details ?? body,
    )
  }
  return apiSuccess(envelope?.ok === true ? envelope.data : body, correlationId, upstream.status)
}

function passthroughResponse(upstream: Response, correlationId: string) {
  const headers = new Headers({ "x-correlation-id": correlationId })
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}

function isJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  return contentType.includes("application/json") || contentType.includes("+json")
}

function authorizeVisionScopes(
  rule: VisionRouteRule,
  roles: readonly string[],
  correlationId: string,
) {
  const grant = visionPrincipalGrant(roles)
  if (!grant || rule.requiredScopes.some((scope) => !grant.scopes.includes(scope))) {
    return { response: apiError("FORBIDDEN", "The authenticated Vision role cannot perform this operation.", correlationId, 403) }
  }
  return { grant }
}

async function proxy(request: Request, context: RouteContext) {
  const correlationId = normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const requestedPath = (await context.params).path.join("/")
  const rule = resolveVisionRoute(request.method, requestedPath)
  if (!rule) return apiError("NOT_FOUND", "Unknown Vision operation.", correlationId, 404)

  const authorization = await requireCapability(rule.capability, correlationId)
  if ("response" in authorization) return authorization.response
  const scopedAuthorization = authorizeVisionScopes(rule, authorization.session.user.roles, correlationId)
  if ("response" in scopedAuthorization) return scopedAuthorization.response
  const subject = authorization.session.user.id?.trim()
  const organizationId = authorization.session.user.organizationId?.trim()
  if (!subject || !organizationId) {
    return apiError("FORBIDDEN", "Vision requires one verified ZITADEL organization for the authenticated user.", correlationId, 403)
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

  const integrationToken = optionalServerEnv(serverEnvNames.visionApiToken)
  if (!integrationToken) {
    return apiError("INTEGRATION_NOT_CONFIGURED", `Missing required env var: ${serverEnvNames.visionApiToken}`, correlationId, 503)
  }
  const principalToken = signVisionPrincipalToken({
    subject,
    organizationId,
    roles: authorization.session.user.roles,
    secret: integrationToken,
  })
  const headers = new Headers({
    "authorization": `Bearer ${integrationToken}`,
    "x-correlation-id": correlationId,
    "x-vulpine-actor": subject,
    [VULPINE_INTEGRATION_AUTH_HEADER]: integrationToken,
    [VULPINE_PRINCIPAL_HEADER]: principalToken,
  })
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  try {
    const upstream = await fetch(buildVisionUpstreamUrl(baseUrl, rule.upstreamPath, request.url), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
    if (rule.responseMode !== "json" && upstream.status === 304) {
      return passthroughResponse(upstream, correlationId)
    }
    if (!upstream.ok || rule.responseMode === "json" || isJsonResponse(upstream)) {
      return normalizedJsonResponse(upstream, correlationId)
    }
    return passthroughResponse(upstream, correlationId)
  } catch (error) {
    return apiError("UPSTREAM_UNAVAILABLE", "Vision is unreachable from Backoffice.", correlationId, 502, error instanceof Error ? error.message : undefined)
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
