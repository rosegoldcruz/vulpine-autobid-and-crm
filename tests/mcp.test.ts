import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { authenticateAgent, handleMcp } from "../apps/backoffice/lib/mcp"

const token = "test-only-agent-token-with-at-least-32-characters"
const clients = JSON.stringify([{ id: "test", organizationId: "org-test", tokenHash: createHash("sha256").update(token).digest("hex"), modules: ["projects"] }])
function request(body: unknown, credential = token) {
  return new Request("https://backoffice.vulpine.llc/api/mcp", { method: "POST", headers: { authorization: `Bearer ${credential}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) })
}
test("credentials fail closed and do not accept browser identity", () => {
  assert.equal(authenticateAgent(new Request("https://example.test"), clients), null)
  assert.equal(authenticateAgent(request({}, "wrong-token-with-at-least-32-characters"), clients), null)
  assert.equal(authenticateAgent(request({}), clients)?.id, "test")
  assert.throws(() => authenticateAgent(request({}), "[]"))
})
test("MCP initializes, lists only read tools, enforces module scope and rejects writes", async () => {
  process.env.MCP_CLIENTS_JSON = clients
  let r = await handleMcp(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } }))
  assert.equal(r.status, 200)
  assert.equal((await r.json()).result.serverInfo.name, "vulpine-backoffice")
  r = await handleMcp(request({ jsonrpc: "2.0", id: 2, method: "tools/list" }))
  const tools = (await r.json()).result.tools
  assert.deepEqual(tools.map((t: { name: string }) => t.name), ["list_workspaces", "read_workspace"])
  assert.ok(tools.every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint))
  r = await handleMcp(request({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "read_workspace", arguments: { module: "contacts" } } }))
  assert.equal((await r.json()).result.isError, true)
  r = await handleMcp(request({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_workspace", arguments: {} } }))
  assert.ok((await r.json()).result.isError)
  assert.equal((await handleMcp(request({}, "wrong-token-with-at-least-32-characters"))).status, 401)
  const forbidden = request({}); forbidden.headers.set("origin", "https://attacker.test")
  assert.equal((await handleMcp(forbidden)).status, 403)
  assert.equal((await handleMcp(new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } }))).status, 405)
  assert.equal((await handleMcp(request("x".repeat(66000)))).status, 413)
  process.env.OPERATIONS_API_URL = "https://operations.test"
  process.env.OPERATIONS_API_SECRET = "test-only-operations-secret-at-least-32-chars"
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).pathname, "/modules/projects")
    assert.equal(init?.method, undefined) // fetch defaults to GET
    const signed = new Headers(init?.headers).get("x-vulpine-operations")!
    const claim = JSON.parse(Buffer.from(signed.split(".")[0], "base64url").toString())
    assert.equal(claim.org, "org-test")
    assert.equal(claim.sub, "mcp:test")
    assert.equal(claim.method, "GET")
    return Response.json({ records: [{ id: "one" }, { id: "two" }], warnings: ["Source warning"], sources: [] })
  }
  try {
    r = await handleMcp(request({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "read_workspace", arguments: { module: "projects", limit: 1 } } }))
    const data = JSON.parse((await r.json()).result.content[0].text)
    assert.deepEqual(data.records, [{ id: "one" }])
    assert.equal(data.nextOffset, 1)
    assert.deepEqual(data.warnings, ["Source warning"])
  } finally { globalThis.fetch = originalFetch }
  delete process.env.OPERATIONS_API_URL
  delete process.env.OPERATIONS_API_SECRET
  delete process.env.MCP_CLIENTS_JSON
  assert.equal((await handleMcp(request({}))).status, 503)
})
