import type { VisionPrincipalScope } from "@vulpine/auth"
import type { Capability } from "@vulpine/permissions"

export type VisionResponseMode = "json" | "binary" | "sse"

export type VisionRouteRule = {
  capability: Capability
  upstreamPath: string
  requiredScopes: readonly VisionPrincipalScope[]
  responseMode: VisionResponseMode
}

type VisionRouteDefinition = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  pattern: RegExp
  requiredScopes: readonly VisionPrincipalScope[]
  responseMode?: Exclude<VisionResponseMode, "json">
}

const read = ["project:read"] as const

/** Every browser-reachable Cabinet Brain operation is explicitly enumerated here. */
export const visionRouteAllowlist: readonly VisionRouteDefinition[] = [
  { method: "POST", pattern: /^assistant\/engineering$/, requiredScopes: ["engineering:inspect"] },
  { method: "POST", pattern: /^assistant\/optimize$/, requiredScopes: read },
  { method: "POST", pattern: /^assistant\/query$/, requiredScopes: read },

  { method: "GET", pattern: /^backoffice\/analytics$/, requiredScopes: read },
  { method: "GET", pattern: /^backoffice\/projects\/[^/]+\/outreach$/, requiredScopes: read },
  // Outreach actions have different permissions. The signed principal lets the
  // upstream route enforce pricing:change, project:upload, or outreach:send
  // after it validates the requested action.
  { method: "POST", pattern: /^backoffice\/projects\/[^/]+\/outreach$/, requiredScopes: read },

  { method: "POST", pattern: /^chat$/, requiredScopes: read },
  { method: "POST", pattern: /^chat\/voice\/session$/, requiredScopes: read },

  { method: "GET", pattern: /^exports\/[^/]+$/, requiredScopes: read, responseMode: "binary" },

  { method: "GET", pattern: /^jobs\/[^/]+$/, requiredScopes: read },
  { method: "GET", pattern: /^jobs\/[^/]+\/canonical$/, requiredScopes: read },
  { method: "GET", pattern: /^jobs\/[^/]+\/catalog$/, requiredScopes: read },
  { method: "POST", pattern: /^jobs\/[^/]+\/catalog$/, requiredScopes: ["pricing:change"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/estimate$/, requiredScopes: ["pricing:change"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/export\/approve$/, requiredScopes: ["export:create"] },
  { method: "GET", pattern: /^jobs\/[^/]+\/export$/, requiredScopes: read },
  { method: "POST", pattern: /^jobs\/[^/]+\/export$/, requiredScopes: ["export:create"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/extraction$/, requiredScopes: ["project:upload"] },
  { method: "GET", pattern: /^jobs\/[^/]+\/file-queue$/, requiredScopes: read },
  { method: "DELETE", pattern: /^jobs\/[^/]+\/file-queue$/, requiredScopes: ["project:upload"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/mappings$/, requiredScopes: ["sku:override"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/mappings\/resolve$/, requiredScopes: ["sku:override"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/process$/, requiredScopes: ["project:upload"] },
  { method: "GET", pattern: /^jobs\/[^/]+\/provenance$/, requiredScopes: read },
  { method: "POST", pattern: /^jobs\/[^/]+\/qa$/, requiredScopes: ["pricing:change"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/qa\/approve$/, requiredScopes: ["qa:approve", "bid:mark_safe"] },
  { method: "GET", pattern: /^jobs\/[^/]+\/runs$/, requiredScopes: read },
  { method: "POST", pattern: /^jobs\/[^/]+\/runs$/, requiredScopes: ["project:upload"] },
  { method: "PUT", pattern: /^jobs\/[^/]+\/takeoff$/, requiredScopes: ["project:upload"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/takeoff\/approve$/, requiredScopes: ["pricing:change"] },
  { method: "PUT", pattern: /^jobs\/[^/]+\/unit-mix$/, requiredScopes: ["unit_mix:modify"] },
  { method: "POST", pattern: /^jobs\/[^/]+\/unit-mix\/verify$/, requiredScopes: ["unit_mix:approve"] },
  { method: "GET", pattern: /^jobs\/[^/]+\/workspace$/, requiredScopes: read },

  { method: "DELETE", pattern: /^measurements\/[^/]+$/, requiredScopes: ["unit_mix:modify"] },
  { method: "GET", pattern: /^notifications$/, requiredScopes: read },
  { method: "PATCH", pattern: /^notifications\/[^/]+$/, requiredScopes: read },
  { method: "GET", pattern: /^plan-sheets\/[^/]+\/image$/, requiredScopes: read, responseMode: "binary" },
  { method: "PATCH", pattern: /^plan-sheets\/[^/]+$/, requiredScopes: ["unit_mix:modify"] },
  { method: "GET", pattern: /^processing-settings$/, requiredScopes: read },
  { method: "PUT", pattern: /^processing-settings$/, requiredScopes: ["settings:admin"] },
  { method: "DELETE", pattern: /^processing-settings$/, requiredScopes: ["settings:admin"] },

  { method: "GET", pattern: /^projects$/, requiredScopes: read },
  { method: "POST", pattern: /^projects$/, requiredScopes: ["project:upload"] },
  { method: "GET", pattern: /^projects\/[^/]+\/comments$/, requiredScopes: read },
  { method: "POST", pattern: /^projects\/[^/]+\/comments$/, requiredScopes: ["unit_mix:modify"] },
  { method: "GET", pattern: /^projects\/[^/]+\/evidence-snippets$/, requiredScopes: read },
  { method: "POST", pattern: /^projects\/[^/]+\/evidence-snippets$/, requiredScopes: ["unit_mix:modify"] },
  { method: "GET", pattern: /^projects\/[^/]+\/measurements$/, requiredScopes: read },
  { method: "POST", pattern: /^projects\/[^/]+\/measurements$/, requiredScopes: ["unit_mix:modify"] },
  { method: "GET", pattern: /^projects\/[^/]+\/vision-evidence$/, requiredScopes: read },
  { method: "POST", pattern: /^projects\/[^/]+\/vision-evidence$/, requiredScopes: ["project:upload"] },

  { method: "POST", pattern: /^runs\/[^/]+\/control$/, requiredScopes: ["project:upload"] },
  { method: "DELETE", pattern: /^runs\/[^/]+\/control$/, requiredScopes: ["project:upload"] },
  { method: "GET", pattern: /^runs\/[^/]+\/diagnostics$/, requiredScopes: read },
  { method: "GET", pattern: /^runs\/[^/]+\/events$/, requiredScopes: read, responseMode: "sse" },
  { method: "GET", pattern: /^runs\/[^/]+\/progress$/, requiredScopes: read },
  { method: "POST", pattern: /^runs\/[^/]+\/progress$/, requiredScopes: ["project:upload"] },

  { method: "POST", pattern: /^uploads$/, requiredScopes: ["project:upload"] },
] as const

export function resolveVisionRoute(method: string, requestedPath: string): VisionRouteRule | null {
  const normalizedMethod = method.toUpperCase()
  const rule = visionRouteAllowlist.find(
    (candidate) => candidate.method === normalizedMethod && candidate.pattern.test(requestedPath),
  )
  return rule ? {
    capability: "vision.read",
    upstreamPath: `/api/${requestedPath}`,
    requiredScopes: rule.requiredScopes,
    responseMode: rule.responseMode ?? "json",
  } : null
}

export function buildVisionUpstreamUrl(baseUrl: URL, upstreamPath: string, requestUrl: string): URL {
  const upstreamUrl = new URL(upstreamPath, `${baseUrl.toString().replace(/\/$/, "")}/`)
  const incoming = new URL(requestUrl)
  incoming.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value))
  return upstreamUrl
}
