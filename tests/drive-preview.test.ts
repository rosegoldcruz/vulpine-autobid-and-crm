import assert from 'node:assert/strict'
import test from 'node:test'
import { drivePreviewKind, hexPreview, parseContacts, readableText } from '../apps/backoffice/lib/drive-preview.ts'

test('preview selection covers code, models, sheets, contacts and lock metadata', () => {
  for (const [path, kind] of [['a.tsx', 'text'], ['a.rs', 'text'], ['a.glb', 'model'], ['a.gltf', 'model'], ['a.pdf', 'pdf'], ['a.xlsx', 'spreadsheet'], ['a.xls', 'spreadsheet'], ['a.vcf', 'contacts'], ['a.docx', 'document'], ['a.zip', 'archive'], ['.~lock.a.xlsx#', 'binary']]) assert.equal(drivePreviewKind(path), kind)
})
test('VCF unfolds lines and preserves escaped contact fields', () => {
  const contacts = parseContacts('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Daniel Cruz\r\nORG:Vulpine;Supply\r\nTEL;TYPE=CELL:555-0100\r\nEMAIL:daniel@example.invalid\r\nNOTE:First\\nSecond\r\n continued\r\nEND:VCARD')
  assert.equal(contacts[0].name, 'Daniel Cruz')
  assert.deepEqual(contacts[0].phones, ['555-0100'])
  assert.deepEqual(contacts[0].emails, ['daniel@example.invalid'])
  assert.equal(contacts[0].notes[0], 'First\nSecondcontinued')
})
test('unknown text and UTF-16 are readable; binary bytes have a bounded preview', () => {
  assert.equal(readableText(new TextEncoder().encode('const x = <div>Preview</div>')), 'const x = <div>Preview</div>')
  assert.equal(readableText(new Uint8Array([255, 254, 65, 0])), 'A')
  assert.equal(readableText(new Uint8Array([0, 1, 255])), null)
  assert.match(hexPreview(new Uint8Array([0, 65, 255])), /00 41 ff.*\.A\./)
})
