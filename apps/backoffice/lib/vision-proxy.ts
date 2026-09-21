import type { Capability } from "@vulpine/permissions"

export type VisionRouteRule = { capability: Capability; upstreamPath: string; blocked: boolean }

const activeRules = [
  { method: "POST", pattern: /^projects$/, capability: "vision.write" },
  { method: "POST", pattern: /^uploads$/, capability: "vision.write" },
  { method: "GET", pattern: /^jobs\/([^/]+)$/, capability: "vision.read" },
  { method: "POST", pattern: /^jobs\/([^/]+)\/process$/, capability: "vision.write" },
] as const

const blockedPattern = /(?:^|\/)(?:approve-unit-mix|resolve|export|pricing|takeoff)(?:\/|$)/

export function resolveVisionRoute(method: string, requestedPath: string): VisionRouteRule | null {
  if (blockedPattern.test(requestedPath)) {
    return { capability: "vision.write", upstreamPath: `/api/${requestedPath}`, blocked: true }
  }
  const rule = activeRules.find((candidate) => candidate.method === method && candidate.pattern.test(requestedPath))
  return rule ? { capability: rule.capability, upstreamPath: `/api/${requestedPath}`, blocked: false } : null
}
