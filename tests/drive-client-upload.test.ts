import assert from "node:assert/strict"
import test from "node:test"
import { DriveClient } from "../packages/sdk/src/index.ts"

test("folder upload retains top folder and subfolders across bounded batches", async () => {
  const files = Array.from({ length: 101 }, (_, index) => {
    const file = new File([String(index)], "plan.pdf")
    Object.defineProperty(file, "webkitRelativePath", { value: `Project/Level ${index}/plan.pdf` })
    return file
  })
  const batches: FormData[] = []
  let tickets = 0
  const drive = new DriveClient("/api/drive", async (url, init) => {
    if (String(url).endsWith("/upload-ticket")) {
      tickets++
      return Response.json({ ok: true, data: { uploadUrl: "https://drive.test/upload", expiresAt: new Date().toISOString() }, meta: {} })
    }
    const form = init?.body as FormData
    batches.push(form)
    return Response.json({ uploaded: form.getAll("files").length })
  })
  assert.deepEqual(await drive.upload("/Bids", files), { uploaded: 101 })
  assert.equal(tickets, 2)
  assert.deepEqual(batches.map(body => body.getAll("files").length), [100, 1])
  assert.equal(batches[0].get("path"), "/Bids")
  assert.equal(JSON.parse(String(batches[0].get("paths")))[0], "Project/Level 0/plan.pdf")
  assert.deepEqual(JSON.parse(String(batches[1].get("paths"))), ["Project/Level 100/plan.pdf"])
})

test("file uploads remain compatible and partial folder failures identify completed files", async () => {
  const files = Array.from({ length: 101 }, () => new File(["fixture"], "file.txt"))
  let uploaded = 0
  const drive = new DriveClient("/api/drive", async (url, init) => {
    if (String(url).endsWith("/upload-ticket")) return Response.json({ ok: true, data: { uploadUrl: "https://drive.test/upload" }, meta: {} })
    const form = init?.body as FormData
    assert.equal(form.has("paths"), false)
    if (uploaded) return Response.json({ error: { message: "Storage unavailable" } }, { status: 503 })
    uploaded += form.getAll("files").length
    return Response.json({ uploaded })
  })
  await assert.rejects(drive.upload("/", files), /100 of 101 files uploaded before the error.*Storage unavailable/)
})


test("a file above 250 MiB is uploaded by itself and does not block 3000 other files", async () => {
 const large = new File(["large file fixture"], "large-plan.pdf")
 Object.defineProperty(large, "size", { value: 300 * 1024 * 1024 })
 const files = [large, ...Array.from({length: 3000}, (_, i) => new File([String(i)], `plan-${i}.txt`))]
 const batches: number[] = [], progress: number[] = []
 const drive = new DriveClient("/api/drive", async (url, init) => {
  if (String(url).endsWith("/upload-ticket")) return Response.json({ok:true,data:{uploadUrl:"https://drive.test/upload"},meta:{}})
  const count = (init?.body as FormData).getAll("files").length
  batches.push(count)
  return Response.json({uploaded:count})
 })
 assert.deepEqual(await drive.upload("/", files, done => progress.push(done)), {uploaded:3001})
 assert.equal(batches[0],1)
 assert.equal(batches.length,31)
 assert.equal(progress.at(-1),3001)
})
