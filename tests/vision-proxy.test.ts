import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { buildVisionUpstreamUrl, resolveVisionRoute } from "../apps/backoffice/lib/vision-proxy.ts"

test("Vision proxy explicitly allowlists the canonical Cabinet Brain surface", () => {
  assert.deepEqual(resolveVisionRoute("POST", "projects"), {
    capability: "vision.read", upstreamPath: "/api/projects", requiredScopes: ["project:upload"], responseMode: "json",
  })
  assert.deepEqual(resolveVisionRoute("GET", "jobs/job-1/workspace")?.requiredScopes, ["project:read"])
  assert.deepEqual(resolveVisionRoute("POST", "jobs/job-1/mappings/resolve")?.requiredScopes, ["sku:override"])
  assert.deepEqual(resolveVisionRoute("POST", "jobs/job-1/qa/approve")?.requiredScopes, ["qa:approve", "bid:mark_safe"])
  assert.deepEqual(resolveVisionRoute("DELETE", "runs/run-1/control")?.requiredScopes, ["project:upload"])
  assert.deepEqual(resolveVisionRoute("POST", "assistant/engineering")?.requiredScopes, ["engineering:inspect"])
  assert.deepEqual(resolveVisionRoute("POST", "chat")?.requiredScopes, ["project:read"])
  assert.deepEqual(resolveVisionRoute("POST", "chat/voice/session")?.requiredScopes, ["project:read"])
  assert.deepEqual(resolveVisionRoute("GET", "backoffice/analytics")?.requiredScopes, ["project:read"])
  assert.deepEqual(resolveVisionRoute("GET", "backoffice/projects/project-1/outreach")?.requiredScopes, ["project:read"])
  assert.deepEqual(resolveVisionRoute("POST", "backoffice/projects/project-1/outreach")?.requiredScopes, ["project:read"])
  assert.equal(resolveVisionRoute("DELETE", "projects/project-1"), null)
  assert.equal(resolveVisionRoute("POST", "auth/session"), null)
  assert.equal(resolveVisionRoute("POST", "integrations/leads/handoff"), null)
  assert.equal(resolveVisionRoute("GET", "backoffice/projects/project-1/logistics"), null)
  assert.equal(resolveVisionRoute("GET", "backoffice/projects/project-1/outreach/anything-at-all"), null)
  assert.equal(resolveVisionRoute("POST", "jobs/job-1/anything-at-all"), null)
})

test("Vision proxy allowlists PUT review operations and classifies passthrough responses", async () => {
  assert.deepEqual(resolveVisionRoute("PUT", "jobs/job-1/unit-mix")?.requiredScopes, ["unit_mix:modify"])
  assert.deepEqual(resolveVisionRoute("PUT", "jobs/job-1/takeoff")?.requiredScopes, ["project:upload"])
  assert.equal(resolveVisionRoute("POST", "jobs/job-1/unit-mix"), null)
  assert.equal(resolveVisionRoute("GET", "runs/run-1/events")?.responseMode, "sse")
  assert.equal(resolveVisionRoute("GET", "plan-sheets/sheet-1/image")?.responseMode, "binary")
  assert.equal(resolveVisionRoute("GET", "exports/artifact-1")?.responseMode, "binary")
  assert.equal(resolveVisionRoute("GET", "jobs/job-1/export")?.responseMode, "json")

  const source = await readFile(new URL("../apps/backoffice/app/api/vision/[...path]/route.ts", import.meta.url), "utf8")
  assert.match(source, /export const PUT = proxy/)
  assert.match(source, /new Response\(upstream\.body/)
  assert.match(source, /`Bearer \$\{integrationToken\}`/)
  assert.match(source, /\[VULPINE_PRINCIPAL_HEADER\]: principalToken/)
})

test("Vision proxy forwards query parameters without dropping duplicate values", () => {
  const upstream = buildVisionUpstreamUrl(
    new URL("https://vision.example.test/root"),
    "/api/notifications",
    "https://backoffice.example.test/api/vision/notifications?status=unread&status=warning&limit=25",
  )
  assert.equal(upstream.toString(), "https://vision.example.test/api/notifications?status=unread&status=warning&limit=25")
})
