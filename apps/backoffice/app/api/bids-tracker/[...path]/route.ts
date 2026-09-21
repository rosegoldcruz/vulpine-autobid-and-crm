import { normalizeCorrelationId } from "@vulpine/contracts"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import type { Capability } from "@vulpine/permissions"
import { apiError, apiSuccess } from "@/lib/api-response"
import { requireCapability } from "@/lib/require-capability"

type RouteContext = { params: Promise<{ path: string[] }> }
const ALLOWED_UPSTREAM_PROTOCOLS = new Set(["http:", "https:"])

const routeRules = [
  { method: "GET", pattern: /^bids$/, capability: "bids.read", upstream: () => "/api/bids" },
  { method: "GET", pattern: /^kpis$/, capability: "bids.read", upstream: () => "/api/kpis" },
  { method: "POST", pattern: /^upload$/, capability: "bids.upload", upstream: () => "/api/upload" },
  { method: "PATCH", pattern: /^bids\/(\d+)$/, capability: "bids.write", upstream: (match: RegExpMatchArray) => `/api/bids/${match[1]}` },
  { method: "DELETE", pattern: /^bids\/(\d+)$/, capability: "bids.delete", upstream: (match: RegExpMatchArray) => `/api/bids/${match[1]}` },
] as const satisfies ReadonlyArray<{
  method: string
  pattern: RegExp
  capability: Capability
  upstream: (match: RegExpMatchArray) => string
}>

async function proxy(request: Request, context: RouteContext) {
  const correlationId = normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const { path } = await context.params
  const requestedPath = path.join("/")
  const rule = routeRules.find((candidate) => candidate.method === request.method && candidate.pattern.test(requestedPath))
  const match = rule?.pattern.exec(requestedPath)

  if (!rule || !match) return apiError("NOT_FOUND", "Unknown Bids Tracker operation.", correlationId, 404)

  const authorization = await requireCapability(rule.capability, correlationId)
  if ("response" in authorization) return authorization.response

  const configuredUrl = optionalServerEnv(serverEnvNames.bidsTrackerApiUrl)
  if (!configuredUrl) {
    return apiError(
      "UPSTREAM_NOT_CONFIGURED",
      `Missing required env var: ${serverEnvNames.bidsTrackerApiUrl}`,
      correlationId,
      503,
    )
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(configuredUrl)
  } catch {
    return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.bidsTrackerApiUrl} must be an absolute URL.`, correlationId, 503)
  }
  if (!ALLOWED_UPSTREAM_PROTOCOLS.has(baseUrl.protocol)) {
    return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.bidsTrackerApiUrl} must use HTTP or HTTPS.`, correlationId, 503)
  }

  const upstreamUrl = new URL(rule.upstream(match), `${baseUrl.toString().replace(/\/$/, "")}/`)
  const headers = new Headers({ "x-correlation-id": correlationId })
  headers.set("x-vulpine-actor", authorization.session.user.id || authorization.session.user.email || "authenticated-user")
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  const integrationToken = optionalServerEnv(serverEnvNames.bidsTrackerApiToken)
  if (integrationToken) headers.set("x-vulpine-integration-key", integrationToken)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })
    const responseText = await upstreamResponse.text()
    let body: unknown = null
    if (responseText) {
      try {
        body = JSON.parse(responseText)
      } catch {
        body = responseText
      }
    }

    if (!upstreamResponse.ok) {
      return apiError(
        "UPSTREAM_UNAVAILABLE",
        "Bids Tracker rejected the operation.",
        correlationId,
        upstreamResponse.status,
        body,
      )
    }
    return apiSuccess(body, correlationId, upstreamResponse.status)
  } catch (error) {
    return apiError(
      "UPSTREAM_UNAVAILABLE",
      "Bids Tracker is currently unreachable from Backoffice.",
      correlationId,
      502,
      error instanceof Error ? error.message : undefined,
    )
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy
