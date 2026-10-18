import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import { authenticateAgent, handleMcp } from "../apps/backoffice/lib/mcp"

const token = "test-only-agent-token-with-at-least-32-characters"
const identity = { id: "test", organizationId: "org-test", tokenHash: createHash("sha256").update(token).digest("hex"), modules: ["pricing"] }
const clients = JSON.stringify([identity])
function request(body: unknown, credential = token) {
  return new Request("https://backoffice.vulpine.llc/api/mcp", { method: "POST", headers: { authorization: `Bearer ${credential}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) })
}
test("pricing credentials fail closed; legacy broad scopes are rejected", () => {
  assert.equal(authenticateAgent(new Request("https://example.test"), clients), null)
  assert.equal(authenticateAgent(request({}, "wrong-token-with-at-least-32-characters"), clients), null)
  assert.equal(authenticateAgent(request({}), clients)?.id, "test")
  assert.throws(() => authenticateAgent(request({}), "[]"))
  assert.throws(() => authenticateAgent(request({}), JSON.stringify([{ ...identity, modules: ["projects", "contacts"] }])))
})
test("pricing RPC is forwarded only to the real pricing app with signed organization and body", async () => {
  process.env.MCP_CLIENTS_JSON = clients
  process.env.OPERATIONS_API_URL = "https://operations.test/operations"
  const secret = "test-only-operations-secret-at-least-32-chars"
  process.env.OPERATIONS_API_SECRET = secret
  const originalFetch = globalThis.fetch
  const seen: string[] = []
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://operations.test/bidding/agent/mcp")
    assert.equal(init?.method, "POST")
    const signed = new Headers(init?.headers).get("x-vulpine-operations")!
    const [payload, signature] = signed.split(".")
    assert.equal(signature, createHmac("sha256", secret).update(payload).digest("base64url"))
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString())
    assert.equal(claim.org, "org-test")
    assert.equal(claim.sub, "mcp:test")
    assert.equal(claim.module, "pricing")
    assert.equal(claim.path, "agent/mcp")
    assert.equal(claim.method, "POST")
    assert.equal(claim.bodyHash, createHash("sha256").update(String(init?.body)).digest("hex"))
    const rpc = JSON.parse(String(init?.body)); seen.push(rpc.method)
    return Response.json({ jsonrpc: "2.0", id: rpc.id, result: rpc.method === "tools/list" ? { tools: [{ name: "create_bid_job" }, { name: "search_catalog" }, { name: "price_bid" }, { name: "save_bid" }, { name: "export_bid" }] } : { content: [{ type: "text", text: "pricing-result" }] } })
  }
  try {
    let r = await handleMcp(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }))
    assert.equal(r.status, 200)
    assert.equal((await r.json()).result.tools[0].name, "create_bid_job")
    r = await handleMcp(request({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "save_bid", arguments: { job_id: "test", expected_revision: 1 } } }))
    assert.equal(r.status, 200)
    assert.deepEqual(seen, ["tools/list", "tools/call"])
    assert.equal((await handleMcp(request({}, "wrong-token-with-at-least-32-characters"))).status, 401)
    const forbidden = request({}); forbidden.headers.set("origin", "https://attacker.test")
    assert.equal((await handleMcp(forbidden)).status, 403)
    assert.equal((await handleMcp(new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } }))).status, 405)
    assert.equal((await handleMcp(request("x".repeat(3145728)))).status, 413)
    delete process.env.OPERATIONS_API_SECRET
    assert.equal((await handleMcp(request({}))).status, 503)
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.OPERATIONS_API_URL
    delete process.env.OPERATIONS_API_SECRET
    delete process.env.MCP_CLIENTS_JSON
  }
  assert.equal((await handleMcp(request({}))).status, 503)
})
