import assert from 'node:assert/strict'
import test from 'node:test'
import { parseByteRange } from '../src/range.js'
test('preview ranges support offsets, suffixes and end clamping', () => {
  assert.deepEqual(parseByteRange('bytes=0-15', 100), { start: 0, end: 15 })
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start: 90, end: 99 })
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 })
  assert.deepEqual(parseByteRange('bytes=0-1000', 100), { start: 0, end: 99 })
})
test('invalid ranges and empty files cannot produce invalid reads', () => {
  for (const value of ['bytes=-', 'bytes=-0', 'bytes=100-', 'bytes=9-2', 'bytes=0-2,4-6', 'bytes=9007199254740992-', 'other=0-1']) assert.equal(parseByteRange(value, 100), null)
  assert.equal(parseByteRange('bytes=0-0', 0), null)
})
