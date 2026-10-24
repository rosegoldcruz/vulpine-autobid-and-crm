import { Readable } from "node:stream"
import { readBoundedStream } from "./bounded-stream.js"

/** Ordered, bounded prefetch over standard SFTP range reads, with backpressure. */
export function parallelRead(open: (start: number, end: number) => Readable, start: number, end: number, concurrency: number, blockBytes = 256 * 1024) {
  const count = Math.ceil((end - start + 1) / blockBytes)
  const active = new Set<Readable>()
  const pending = new Map<number, Promise<Buffer>>()
  async function* blocks() {
    let next = 0
    const schedule = () => {
      while (next < count && pending.size < Math.min(16, Math.max(1, concurrency))) {
        const index = next++; const offset = start + index * blockBytes; const last = Math.min(end, offset + blockBytes - 1)
        const stream = open(offset, last); active.add(stream)
        const result = readBoundedStream(stream, last - offset + 1).then(bytes => {
          if (bytes.length !== last - offset + 1) throw new Error("Remote file changed or ended during download.")
          return bytes
        }).finally(() => { active.delete(stream); stream.destroy() })
        void result.catch(() => undefined)
        pending.set(index, result)
      }
    }
    try {
      schedule()
      for (let index = 0; index < count; index++) {
        const bytes = await pending.get(index)!; pending.delete(index)
        yield bytes
        schedule()
      }
    } finally {
      for (const stream of active) stream.destroy(new Error("Transfer closed."))
      await Promise.allSettled([...pending.values()])
    }
  }
  const output = Readable.from(blocks(), { objectMode: false, highWaterMark: blockBytes })
  const destroy = output._destroy.bind(output)
  output._destroy = (error, callback) => {
    // Cancel pending I/O before asking the async iterator to return; it may be awaiting it.
    for (const stream of active) stream.destroy(error ?? new Error("Transfer closed."))
    destroy(error, callback)
  }
  return output
}
