import { normalizeCorrelationId, VULPINE_INTEGRATION_AUTH_HEADER, type ApiErrorCode } from "@vulpine/contracts"
import { optionalServerEnv, serverEnvNames } from "@vulpine/config"
import { signDriveTransferTicket, type DriveTransferAction } from "@vulpine/auth"
import type { Capability } from "@vulpine/permissions"
import { apiError, apiSuccess } from "@/lib/api-response"
import { requireCapability } from "@/lib/require-capability"

type RouteContext = { params: Promise<{ path: string[] }> }

const routeRules = [
  { method: "GET", path: "files", capability: "drive.read", upstreamPath: "/files", binary: false },
  { method: "GET", path: "recent", capability: "drive.read", upstreamPath: "/recent", binary: false },
  { method: "POST", path: "access", capability: "drive.read", upstreamPath: "/access", binary: false },
  { method: "POST", path: "upload-ticket", capability: "drive.write", upstreamPath: "/upload", binary: false },
  { method: "GET", path: "preview", capability: "drive.read", upstreamPath: "/preview", binary: true },
  { method: "GET", path: "download", capability: "drive.read", upstreamPath: "/download", binary: true },
] as const satisfies ReadonlyArray<{
  method: string
  path: string
  capability: Capability
  upstreamPath: string
  binary: boolean
}>

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

async function proxy(request: Request, context: RouteContext) {
  const correlationId = normalizeCorrelationId(request.headers.get("x-correlation-id"))
  const requestedPath = (await context.params).path.join("/")
  const rule = routeRules.find((candidate) => candidate.method === request.method && candidate.path === requestedPath)
  if (!rule) return apiError("NOT_FOUND", "Unknown Drive operation.", correlationId, 404)

  const authorization = await requireCapability(rule.capability, correlationId)
  if ("response" in authorization) return authorization.response

  const configuredUrl = optionalServerEnv(serverEnvNames.driveApiUrl)
  const integrationToken = optionalServerEnv(serverEnvNames.driveApiToken)
  if (!configuredUrl) return apiError("UPSTREAM_NOT_CONFIGURED", `Missing required env var: ${serverEnvNames.driveApiUrl}`, correlationId, 503)
  if (!integrationToken) return apiError("INTEGRATION_NOT_CONFIGURED", `Missing required env var: ${serverEnvNames.driveApiToken}`, correlationId, 503)

  let baseUrl: URL
  try {
    baseUrl = new URL(configuredUrl)
  } catch {
    return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.driveApiUrl} must be an absolute URL.`, correlationId, 503)
  }
  if (!ALLOWED_PROTOCOLS.has(baseUrl.protocol)) {
    return apiError("UPSTREAM_NOT_CONFIGURED", `${serverEnvNames.driveApiUrl} must use HTTP or HTTPS.`, correlationId, 503)
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(rule.upstreamPath, `${baseUrl.toString().replace(/\/$/, "")}/`)
  incomingUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value))

  if (requestedPath === "upload-ticket") {
    const body = await request.json().catch(() => null) as { path?: unknown } | null
    const transferPath = typeof body?.path === "string" && body.path.startsWith("/") ? body.path : null
    if (!transferPath) return apiError("VALIDATION_ERROR", "A valid Drive path is required.", correlationId, 400)
    const expiresAt = Date.now() + 5 * 60_000
    const ticket = signDriveTransferTicket({
      action: "upload",
      path: transferPath,
      subject: authorization.session.user.id || authorization.session.user.email || "authenticated-user",
      expiresAt,
    }, integrationToken)
    upstreamUrl.searchParams.set("path", transferPath)
    upstreamUrl.searchParams.set("ticket", ticket)
    return apiSuccess({ uploadUrl: upstreamUrl.toString(), expiresAt: new Date(expiresAt).toISOString() }, correlationId)
  }

  if (rule.binary) {
    const transferPath = incomingUrl.searchParams.get("path")
    if (!transferPath) return apiError("VALIDATION_ERROR", "A valid Drive path is required.", correlationId, 400)
    const ticket = signDriveTransferTicket({
      action: requestedPath as DriveTransferAction,
      path: transferPath,
      subject: authorization.session.user.id || authorization.session.user.email || "authenticated-user",
    }, integrationToken)
    upstreamUrl.searchParams.set("ticket", ticket)
    return Response.redirect(upstreamUrl, 307)
  }

  const headers = new Headers({
    "x-correlation-id": correlationId,
    "x-vulpine-actor": authorization.session.user.id || authorization.session.user.email || "authenticated-user",
    [VULPINE_INTEGRATION_AUTH_HEADER]: integrationToken,
  })
  const contentType = request.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    })

    const text = await upstream.text()
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    if (!upstream.ok) {
      const upstreamError = body && typeof body === "object" && "error" in body ? (body as { error?: { code?: string; message?: string } }).error : undefined
      return apiError(
        (upstreamError?.code as ApiErrorCode) || "UPSTREAM_UNAVAILABLE",
        upstreamError?.message || "Drive rejected the operation.",
        correlationId,
        upstream.status,
      )
    }
    return apiSuccess(body, correlationId, upstream.status)
  } catch {
    return apiError(
      "UPSTREAM_UNAVAILABLE",
      "Drive is currently unreachable from Backoffice.",
      correlationId,
      502,
    )
  }
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const GET = proxy
export const POST = proxy
