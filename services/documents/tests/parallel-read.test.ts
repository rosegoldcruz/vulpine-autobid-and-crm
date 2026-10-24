import assert from "node:assert/strict"
import test from "node:test"
import { Readable } from "node:stream"
import { parallelRead } from "../src/parallel-read.js"

test("parallel ranges retain byte order, exact boundaries and bounded concurrency", async () => {
  const input = Buffer.from("0123456789abcdefghijklmnopqrstuvwxyz")
  let active = 0, peak = 0
  const stream = parallelRead((start, end) => Readable.from((async function* () {
    active++; peak = Math.max(peak, active)
    try { await new Promise(resolve => setTimeout(resolve, start % 3 === 0 ? 8 : 1)); yield input.subarray(start, end + 1) }
    finally { active-- }
  })()), 3, 29, 3, 4)
  const chunks: Buffer[] = []; for await (const bytes of stream) chunks.push(bytes)
  assert.deepEqual(Buffer.concat(chunks), input.subarray(3, 30)); assert.ok(peak > 1 && peak <= 3); assert.equal(active, 0)
})

test("truncated ranges fail visibly and closing the consumer cancels pending ranges", async () => {
  const bad = parallelRead(() => Readable.from([Buffer.from("a")]), 0, 8, 2, 4)
  await assert.rejects(async () => { for await (const _bytes of bad) {} }, /changed or ended/)
  const streams: Readable[] = []
  const cancelled = parallelRead((start, end) => {
    const stream = start === 0 ? Readable.from([Buffer.alloc(end - start + 1)]) : new Readable({ read() {} })
    streams.push(stream); return stream
  }, 0, 100, 3, 4)
  for await (const _bytes of cancelled) break
  for (let i = 0; i < 100 && streams.some(s => !s.destroyed); i++) await new Promise(r => setTimeout(r, 5))
  assert.ok(streams.every(s => s.destroyed))
})
