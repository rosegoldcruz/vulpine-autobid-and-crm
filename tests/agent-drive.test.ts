import { test } from "node:test"
import assert from "node:assert/strict"
import { verifyDriveTransferTicket } from "@vulpine/auth"
import { executeDriveTool } from "../apps/backoffice/lib/agent-drive"

const client = { id: "fixture", modules: ["drive"] }
const secret = "test-only-drive-key-that-is-not-a-production-key"

test("Drive rejects missing grants, traversal, root deletion and unsupported mutations", async () => {
  await assert.rejects(executeDriveTool({ ...client, modules: [] }, { operation: "list" }))
  for (const path of ["../plans", "/plans/../private", "/plans\\private", "/bad\0path"]) {
    await assert.rejects(executeDriveTool(client, { operation: "list", path }))
  }
  await assert.rejects(executeDriveTool(client, { operation: "delete", path: "/" }))
  await assert.rejects(executeDriveTool(client, { operation: "PATCH", path: "/plan.pdf" }))
})

test("Drive preserves its service prefix, scopes transfer tickets and performs authenticated uploads/deletion", async () => {
  const original = globalThis.fetch
  process.env.DRIVE_API_URL = "https://drive.test/documents"
  process.env.DRIVE_API_TOKEN = secret
  const requests: { url: URL; init?: RequestInit }[] = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url: new URL(String(url)), init })
    return Response.json(init?.method === "GET" ? { path: "/Plans", items: [{ name: "plan.pdf", path: "/Plans/plan.pdf" }, { name: "notes.txt", path: "/Plans/notes.txt" }] } : { ok: true })
  }
  try {
    const listed = await executeDriveTool(client, { operation: "list", path: "/Plans", query: ".pdf", limit: 1 })
    assert.equal(listed.total, 1)
    assert.equal(requests[0].url.pathname, "/documents/files")
    assert.equal(new Headers(requests[0].init?.headers).get("x-vulpine-integration-key"), secret)
    const read = await executeDriveTool(client, { operation: "download", path: "/Plans/plan.pdf" })
    const url = new URL(read.url)
    assert.equal(url.pathname, "/documents/download")
    const ticket = url.searchParams.get("ticket")!
    assert.equal(verifyDriveTransferTicket(ticket, secret, "download", "/Plans/plan.pdf")?.subject, "mcp:fixture")
    assert.equal(verifyDriveTransferTicket(ticket, secret, "upload", "/Plans/plan.pdf"), null)
    assert.equal(verifyDriveTransferTicket(ticket, secret, "download", "/other.pdf"), null)
    assert.equal(requests.length, 1)
    const upload = await executeDriveTool(client, { operation: "upload", path: "/Plans" })
    assert.ok(verifyDriveTransferTicket(new URL(upload.url).searchParams.get("ticket")!, secret, "upload", "/Plans"))
    await executeDriveTool(client, { operation: "upload", path: "/Plans", filename: "test.pdf", file_base64: Buffer.from("%PDF-test").toString("base64") })
    assert.equal(requests[1].init?.method, "POST")
    const form = requests[1].init?.body as FormData
    assert.equal(form.get("path"), "/Plans")
    assert.equal((form.get("files") as File).name, "test.pdf")
    await assert.rejects(executeDriveTool(client, { operation: "upload", filename: "../bad.pdf", file_base64: "AAAA" }))
    await executeDriveTool(client, { operation: "delete", path: "/Plans/test.pdf" })
    assert.equal(requests[2].url.pathname, "/documents/files")
    assert.equal(requests[2].url.searchParams.get("path"), "/Plans/test.pdf")
    assert.equal(requests[2].init?.method, "DELETE")
  } finally {
    globalThis.fetch = original
    delete process.env.DRIVE_API_URL
    delete process.env.DRIVE_API_TOKEN
  }
})
