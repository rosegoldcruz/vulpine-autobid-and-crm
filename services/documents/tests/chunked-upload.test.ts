import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { ChunkUploads } from "../src/chunked-upload.js"

test("chunks preserve bytes, folder paths, retry offsets, and asynchronous save confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "chunk-test-"))
  let saved: Buffer | undefined; let target: string | undefined; let release: () => void = () => {}; let released = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  const uploads = new ChunkUploads(async files => { target = files[0].path; saved = await readFile(files[0].localPath); await gate }, { root, chunkBytes: 4, reserveBytes: 0 })
  try {
    const start = await uploads.start("owner", "/Plans", "plan.pdf", 6, "Project/Level 1/plan.pdf")
    const s = uploads.get(start.id, "owner", "/Plans")
    assert.throws(() => uploads.get(start.id, "someone-else", "/Plans"), /not found/)
    assert.throws(() => uploads.get(start.id, "owner", "/Other"), /not found/)
    assert.deepEqual(await uploads.chunk(s, 0, Readable.from([Buffer.from("abcd")])), { offset: 4 })
    assert.deepEqual(await uploads.chunk(s, 0, Readable.from([Buffer.from("abcd")])), { offset: 4 })
    await assert.rejects(uploads.chunk(s, 5, Readable.from([Buffer.from("e")])), /does not match/)
    assert.throws(() => uploads.finish(s, () => {}), /not finished/)
    await uploads.chunk(s, 4, Readable.from([Buffer.from("ef")]))
    assert.equal(uploads.finish(s, () => { released++ }).phase, "saving")
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(uploads.status(s).phase, "saving"); assert.equal(saved?.toString(), "abcdef"); assert.equal(target, "/Plans/Project/Level 1/plan.pdf")
    release()
    for (let i = 0; i < 100 && uploads.status(s).phase === "saving"; i++) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(uploads.status(s).uploaded, 1); assert.equal(released, 1)
    assert.equal(uploads.finish(s, () => {}).uploaded, 1)
  } finally { release(); await rm(root, { recursive: true, force: true }) }
})

test("unsafe paths, excessive size, truncated and concurrent chunks fail without committing corrupt data", async () => {
  const root = await mkdtemp(join(tmpdir(), "chunk-test-"))
  const uploads = new ChunkUploads(async () => {}, { root, chunkBytes: 4, maxBytes: 10, reserveBytes: 0 })
  try {
    await assert.rejects(uploads.start("owner", "/", "file", 2, "../escape"), /Unsafe/)
    await assert.rejects(uploads.start("owner", "/", "file", 11), /configured/)
    const { id } = await uploads.start("owner", "/", "file", 6)
    const s = uploads.get(id, "owner", "/")
    await assert.rejects(uploads.chunk(s, 0, Readable.from([Buffer.alloc(5)])), /exceeds/)
    assert.equal(s.offset, 0); assert.equal((await stat(s.file)).size, 0)
    const interrupted = new Readable({ read() { this.push(Buffer.from("ab")); this.destroy(new Error("interrupted")) } })
    await assert.rejects(uploads.chunk(s, 0, interrupted), /interrupted/)
    assert.equal(s.offset, 0); assert.equal((await stat(s.file)).size, 0)
    s.busy = true
    await assert.rejects(uploads.chunk(s, 0, Readable.from([Buffer.from("ab")])), /Another chunk/)
    s.busy = false
    await uploads.chunk(s, 0, Readable.from([Buffer.from("abcd")]))
    await assert.rejects(uploads.chunk(s, 4, Readable.from([Buffer.from("efg")])), /exceeds/)
    assert.equal(s.offset, 4); assert.equal((await readFile(s.file)).toString(), "abcd")
    await uploads.cleanup(Date.now() + 60 * 60_000 + 100)
    assert.throws(() => uploads.get(id, "owner", "/"), /not found/)
    await assert.rejects(stat(s.directory), /ENOENT/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("concurrent session admission is bounded and storage failures are never reported as completed", async () => {
  const root = await mkdtemp(join(tmpdir(), "chunk-test-"))
  const uploads = new ChunkUploads(async () => { throw new Error("storage unavailable") }, { root, reserveBytes: 0 })
  try {
    const starts = await Promise.allSettled(Array.from({ length: 12 }, () => uploads.start("owner", "/", "empty", 0)))
    assert.equal(starts.filter(x => x.status === "fulfilled").length, 8)
    const first = starts.find(x => x.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>
    const s = uploads.get(first.value.id, "owner", "/")
    uploads.finish(s, () => {})
    for (let i = 0; i < 100 && uploads.status(s).phase === "saving"; i++) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(uploads.status(s).phase, "failed"); assert.equal(uploads.status(s).uploaded, 0)
    await uploads.start("owner", "/", "next-file", 0)
  } finally { await rm(root, { recursive: true, force: true }) }
})
