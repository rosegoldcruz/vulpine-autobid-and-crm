import type { DriveUploadTicket } from "@vulpine/contracts"
type ChunkTicket = DriveUploadTicket & { chunkedUploadVersion?: number }

export async function uploadChunkedFile(
  file: File, firstTicket: ChunkTicket, getTicket: () => Promise<ChunkTicket>, request: typeof fetch,
  report: (loaded: number, phase: "sending" | "saving") => void,
) {
  let ticket = firstTicket
  const post = async (operation: string, body: BodyInit, query?: Record<string, string>) => {
    if (!ticket.expiresAt || Date.parse(ticket.expiresAt) < Date.now() + 30_000) ticket = await getTicket()
    const url = new URL(ticket.uploadUrl)
    url.pathname = url.pathname.replace(/\/$/, "") + "/chunks/" + operation
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value)
    const response = await request(url.toString(), {
      method: "POST", headers: { "content-type": typeof body === "string" ? "application/json" : "application/octet-stream" },
      body, cache: "no-store", signal: AbortSignal.timeout(90_000),
    })
    const result = await response.json().catch(() => null) as { id?: string; offset?: number; chunkBytes?: number; phase?: string; error?: { message?: string } } | null
    if (!response.ok || !result) throw new Error(result?.error?.message || `Upload request failed (${response.status}).`)
    return result
  }
  const start = await post("start", JSON.stringify({ name: file.name, size: file.size, ...(file.webkitRelativePath ? { relativePath: file.webkitRelativePath } : {}) }))
  if (typeof start.id !== "string" || !/^[a-f0-9-]{36}$/.test(start.id) || !Number.isInteger(start.chunkBytes) || start.chunkBytes! < 1 || start.chunkBytes! > 32 * 1024 * 1024) throw new Error("Invalid upload session.")
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(file.size, offset + start.chunkBytes!)
    let result: Awaited<ReturnType<typeof post>> | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = await post(start.id + "/chunk", file.slice(offset, end), { offset: String(offset) }); break }
      catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, 1000)) }
    }
    if (!Number.isSafeInteger(result?.offset) || result!.offset! <= offset || result!.offset! > end) throw new Error("Invalid upload progress.")
    offset = result!.offset!; report(offset, "sending")
  }
  report(file.size, "saving")
  let status = await post(start.id + "/finish", "{}")
  const deadline = Date.now() + 2 * 60 * 60_000
  while (status.phase === "saving") {
    if (Date.now() > deadline) throw new Error("File storage did not confirm completion. Check Drive before retrying.")
    await new Promise(resolve => setTimeout(resolve, 1000))
    status = await post(start.id + "/status", "{}")
  }
  if (status.phase !== "complete") throw new Error(status.error?.message || "File storage upload failed.")
  return { uploaded: 1 }
}
