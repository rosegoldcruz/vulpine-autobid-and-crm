import { test } from "node:test"
import assert from "node:assert/strict"
import { executeBackofficeTool, safeAgentData, agentModules } from "../apps/backoffice/lib/agent-access"
const client = { id: "test", organizationId: "org-test", modules: [...agentModules], roles: ["admin"] }
test("agent access excludes unrequested CRM modules and masks credentials", async () => {
  await assert.rejects(executeBackofficeTool(client, "read_backoffice_module", { module: "leads" }))
  await assert.rejects(executeBackofficeTool({ ...client, modules: ["pricing"] }, "bids_tracker", { operation: "list" }))
  assert.deepEqual(safeAgentData({ apiKey: "test-only", nested: { password: "test-only", title: "Preserved" } }), { apiKey: "[REDACTED]", nested: { password: "[REDACTED]", title: "Preserved" } })
})
test("tracker writes use integration auth and a fixed bid path; Brain reuses its route and principal contracts", async () => {
  process.env.BIDS_TRACKER_API_URL = "https://tracker.test"
  process.env.BIDS_TRACKER_API_TOKEN = "test-only-tracker-key"
  process.env.VISION_API_URL = "https://vision.test"
  process.env.VISION_API_TOKEN = "test-only-vision-key"
  const prior = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => { calls.push({ url: String(input), init }); return Response.json({ ok: true }) }
  try {
    await executeBackofficeTool(client, "bids_tracker", { operation: "update", id: 42, fields: { status: "Follow-Up" } })
    assert.equal(calls[0].url, "https://tracker.test/api/bids/42")
    assert.equal(calls[0].init?.method, "PATCH")
    assert.equal(new Headers(calls[0].init?.headers).get("x-vulpine-integration-key"), "test-only-tracker-key")
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { status: "Follow-Up" })
    await assert.rejects(executeBackofficeTool(client, "cabinet_brain", { method: "GET", path: "../secrets" }))
    await executeBackofficeTool(client, "cabinet_brain", { method: "PUT", path: "jobs/test-job/takeoff", body: { lines: [] } })
    assert.equal(calls[1].url, "https://vision.test/api/jobs/test-job/takeoff")
    const signed = new Headers(calls[1].init?.headers).get("x-vulpine-principal")!
    const principal = JSON.parse(Buffer.from(signed.split(".")[0], "base64url").toString())
    assert.equal(principal.sub, "mcp:test"); assert.equal(principal.org, "org-test"); assert.equal(principal.role, "admin")
  } finally {
    globalThis.fetch = prior
    for (const key of ["BIDS_TRACKER_API_URL", "BIDS_TRACKER_API_TOKEN", "VISION_API_URL", "VISION_API_TOKEN"]) delete process.env[key]
  }
})
