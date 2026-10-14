import { createHash, createHmac } from "node:crypto"
import { requireCapability } from "@/lib/require-capability"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const correlationId = crypto.randomUUID()
  const segments = (await context.params).path
  if (segments.some(s => s === "." || s === ".." || !/^[-a-zA-Z0-9_. ()]+$/.test(s))) {
    return Response.json({ error: "Invalid path." }, { status: 400 })
  }
  const path = segments.join("/")
  const write = request.method !== "GET"
  if (write && !((path === "draft" && request.method === "PUT") || (path === "export" && request.method === "POST"))) {
    return Response.json({ error: "Method not allowed." }, { status: 405 })
  }
  const auth = await requireCapability(write ? "bids.write" : "bids.read", correlationId)
  if ("response" in auth) return auth.response
  const publicOrigin = new URL(process.env.NEXTAUTH_URL || request.url).origin
  if (write && request.headers.get("origin") !== publicOrigin) return Response.json({ error: "Same-origin request required." }, { status: 403 })
  const user = auth.session.user
  if (!user.id || !user.organizationId) return Response.json({ error: "Verified organization required." }, { status: 403 })
  const base = process.env.OPERATIONS_API_URL, secret = process.env.OPERATIONS_API_SECRET
  if (!base || !secret) return Response.json({ error: "Cabinet service connection unavailable." }, { status: 503 })
  const body = write ? await request.text() : ""
  if (Buffer.byteLength(body) > 1048576) return Response.json({ error: "Request too large." }, { status: 413 })
  const claim = { sub: user.id, org: user.organizationId, module: "pricing", path, method: request.method, exp: Math.floor(Date.now()/1000)+60, bodyHash: createHash("sha256").update(body).digest("hex") }
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url")
  const token = payload + "." + createHmac("sha256", secret).update(payload).digest("base64url")
  try {
    const upstream = new URL("/cabinet-pricing/" + segments.map(encodeURIComponent).join("/"), base)
    const response = await fetch(upstream, { method: request.method, headers: { "x-vulpine-operations": token, "content-type": "application/json" }, body: write ? body : undefined, cache: "no-store", signal: AbortSignal.timeout(55000) })
    return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") || "application/octet-stream", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" } })
  } catch {
    return Response.json({ error: "Cabinet service unavailable. Your saved draft is retained." }, { status: 502 })
  }
}

export const GET = proxy
export const PUT = proxy
export const POST = proxy
