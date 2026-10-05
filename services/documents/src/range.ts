export function parseByteRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || !(match[1] || match[2]) || size <= 0) return null
  const first = Number(match[1] || 0)
  const last = Number(match[2] || 0)
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null
  const start = match[1] ? first : Math.max(0, size - last)
  const end = match[1] && match[2] ? Math.min(size - 1, last) : size - 1
  return start < 0 || start > end || start >= size ? null : { start, end }
}
