import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { agentModules, backofficeTools, executeBackofficeTool, safeAgentData } from "./agent-access"

const clientsSchema = z.array(z.object({
  id: z.string().min(1).max(80),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  organizationId: z.string().min(1),
  modules: z.array(z.enum(agentModules)).min(1),
  roles: z.array(z.string()).optional(),
})).min(1)
type Client = z.infer<typeof clientsSchema>[number]
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" }

export function authenticateAgent(request: Request, configured: string | undefined): Client | null {
  const clients = clientsSchema.parse(JSON.parse(configured || "[]"))
  const bearer = /^Bearer (\S{32,256})$/.exec(request.headers.get("authorization") || "")?.[1]
  if (!bearer) return null
  const hash = createHash("sha256").update(bearer).digest()
  return clients.find(client => timingSafeEqual(hash, Buffer.from(client.tokenHash, "hex"))) || null
}

export async function handleMcp(request: Request): Promise<Response> {
  let client: Client | null
  try { client = authenticateAgent(request, process.env.MCP_CLIENTS_JSON) }
  catch { return Response.json({ error: "Pricing agent access is not configured." }, { status: 503, headers }) }
  if (!client) return Response.json({ error: "Agent bearer credential required." }, { status: 401, headers: { ...headers, "www-authenticate": "Bearer" } })
  const origin = request.headers.get("origin")
  const allowed = (process.env.MCP_ALLOWED_ORIGINS || "").split(",").filter(Boolean)
  if (origin && !allowed.includes(origin)) return Response.json({ error: "Origin is not allowed." }, { status: 403, headers })
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { ...headers, allow: "POST" } })
  const base = process.env.OPERATIONS_API_URL, secret = process.env.OPERATIONS_API_SECRET
  if (!base || !secret) return Response.json({ error: "Pricing service connection is not configured." }, { status: 503, headers })
  const reader = request.body?.getReader()
  let size = 0
  const chunks: Uint8Array[] = []
  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 3145728) { await reader.cancel(); return Response.json({ error: "Request too large." }, { status: 413, headers }) }
      chunks.push(value)
    }
  }
  const body = Buffer.concat(chunks).toString("utf8")
  let rpc: { id?: string | number; method?: string; params?: { name?: string; arguments?: unknown } }
  try { rpc = JSON.parse(body) }
  catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers }) }
  if (rpc.method === "tools/call" && backofficeTools.some(t => t.name === rpc.params?.name)) {
    try {
      const data = safeAgentData(await executeBackofficeTool(client, rpc.params!.name!, rpc.params?.arguments || {}))
      const text = JSON.stringify(data)
      if (Buffer.byteLength(text) > 500000) throw new Error("Result too large. Narrow the query or pagination.")
      console.info(JSON.stringify({ event: "mcp.action", client: client.id, tool: rpc.params!.name, status: "ok" }))
      const content: Record<string, unknown>[] = [{ type: "text", text }]
      if (rpc.params!.name === "vulpine_drive" && data && typeof data === "object" && "action" in data && ["preview", "download"].includes(String(data.action)) && "url" in data && "path" in data) {
        content.push({ type: "resource_link", uri: data.url, name: String(data.path).split("/").pop() || "Drive file" })
      }
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { content } }, { headers })
    } catch (error) {
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Backend operation failed." }] } }, { headers })
    }
  }
  if (!client.modules.includes("pricing")) return Response.json({ error: "Pricing scope required." }, { status: 403, headers })
  // Fixed pricing destination. The existing pricing engine owns tools,
  // validation, catalog costs, quote revisions, exports and its audit trail.
  const path = "agent/mcp"
  const claims = { sub: `mcp:${client.id}`, org: client.organizationId, module: "pricing", path, method: "POST", exp: Math.floor(Date.now() / 1000) + 60, bodyHash: createHash("sha256").update(body).digest("hex") }
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  try {
    const upstreamHeaders = new Headers({ "content-type": "application/json", accept: "application/json, text/event-stream", "x-vulpine-operations": `${payload}.${signature}` })
    const protocol = request.headers.get("mcp-protocol-version")
    if (protocol) upstreamHeaders.set("mcp-protocol-version", protocol)
    const response = await fetch(new URL("/bidding/agent/mcp", base), { method: "POST", headers: upstreamHeaders, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(55000) })
    console.info(JSON.stringify({ event: "mcp.pricing", client: client.id, status: response.status }))
    if (rpc.method === "tools/list" && response.ok) {
      const data = await response.json()
      if (Array.isArray(data.result?.tools)) data.result.tools.push(...backofficeTools)
      return Response.json(data, { headers })
    }
    return new Response(response.body, { status: response.status, headers: { ...headers, "content-type": response.headers.get("content-type") || "application/json" } })
  } catch {
    return Response.json({ error: "Pricing service unavailable." }, { status: 502, headers })
  }
}
