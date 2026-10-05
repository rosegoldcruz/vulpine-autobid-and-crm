import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { localAuth } from './local-auth'
const require = createRequire(resolve('apps/backoffice/package.json'))
const xlsx = require('xlsx') as typeof import('xlsx')
const { zipSync, strToU8 } = require('fflate') as typeof import('fflate')
test.skip(!process.env.OPERATIONS_AUTH_QA, 'Requires isolated authenticated QA')
function pdfFixture() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', ...[6, 7].map(content => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents ${content} 0 R >>`), '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', ...['First page', 'Second page'].map(text => { const stream = `BT /F1 24 Tf 30 150 Td (${text}) Tj ET`; return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream` })]
  let file = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(file)); file += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const start = Buffer.byteLength(file)
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(file)
}
function glbFixture() {
  const model = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0, 1, 0.5, 1], metallicFactor: 0 } }], buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 1, 0] }] }
  const text = JSON.stringify(model)
  const json = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4, ' '))
  const vertices = Buffer.alloc(36)
  ;[-1, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => vertices.writeFloatLE(n, i * 4))
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + vertices.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binary = Buffer.alloc(8); binary.writeUInt32LE(vertices.length); binary.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, json, binary, vertices])
}
const book = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['SKU', 'Price'], ['CAB-100', 123], ...Array.from({ length: 110 }, (_, i) => [`ROW-${i}`, i])]), 'Cabinets')
xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['Second sheet value']]), 'Summary')
const files: Record<string, { bytes: Buffer; mime: string }> = {
  '/\\home\\backup\\image.png': { bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6e8AAAAASUVORK5CYII=', 'base64'), mime: 'image/png' },
  '/sample.pdf': { bytes: pdfFixture(), mime: 'application/pdf' },
  '/sample.glb': { bytes: glbFixture(), mime: 'model/gltf-binary' },
  '/sample.tsx': { bytes: Buffer.from('export const Demo = () => <div>Safe source text</div>'), mime: 'application/octet-stream' },
  '/contacts.vcf': { bytes: Buffer.from('BEGIN:VCARD\nVERSION:3.0\nFN:Preview Contact\nTEL:555-0100\nEMAIL:contact@example.invalid\nEND:VCARD'), mime: 'application/octet-stream' },
  '/sample.xlsx': { bytes: xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }), mime: 'application/octet-stream' },
  '/sample.xls': { bytes: xlsx.write(book, { type: 'buffer', bookType: 'biff8' }), mime: 'application/octet-stream' },
  '/sample.csv': { bytes: Buffer.from('SKU,Price\nCSV-CAB,42'), mime: 'text/csv' },
  '/sample.docx': { bytes: Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), '_rels/.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'), 'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Readable Word content</w:t></w:r></w:p></w:body></w:document>') })), mime: 'application/octet-stream' },
  '/sample.zip': { bytes: Buffer.from(zipSync({ 'inside.txt': strToU8('Archive contents') })), mime: 'application/zip' },
  '/.~lock.sample.xlsx#': { bytes: Buffer.from('editor,workstation,2026-10-05'), mime: 'application/octet-stream' },
  '/unknown.bin': { bytes: Buffer.from([0, 65, 255, 8]), mime: 'application/octet-stream' },
}
const glb = glbFixture()
const gltfLength = glb.readUInt32LE(12)
const gltf = JSON.parse(glb.subarray(20, 20 + gltfLength).toString())
gltf.buffers[0].uri = 'model.bin'
files['/sample.gltf'] = { bytes: Buffer.from(JSON.stringify(gltf)), mime: 'model/gltf+json' }
files['/model.bin'] = { bytes: glb.subarray(28 + gltfLength), mime: 'application/octet-stream' }
for (const width of [1440, 390]) test(`previews render real file content at ${width}px`, async ({ page, context }) => {
  test.setTimeout(90000)
  await localAuth(context)
  await page.setViewportSize({ width, height: 950 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/drive/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/preview')) {
      const file = files[url.searchParams.get('path') || '']
      await route.fulfill({ contentType: file.mime, body: file.bytes })
    } else await route.fulfill({ json: { ok: true, data: { path: '/', parent: '/', items: Object.entries(files).map(([path, file]) => ({ path, name: path.slice(1), type: 'file', size: file.bytes.length, modifiedAt: null })), generatedAt: new Date().toISOString() }, meta: {} } })
  })
  await page.goto('/drive')
  async function open(name: string) { await page.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).filter({ visible: true }).click(); await expect(page.getByRole('dialog')).toBeVisible() }
  async function close() { await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0) }
  await open('\\home\\backup\\image.png')
  await expect.poll(() => page.getByRole('dialog').locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await close()
  await open('sample.pdf')
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next PDF page' }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in PDF' }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  await page.screenshot({ path: `/tmp/drive-pdf-preview-${width}.png` })
  await close()
  await open('sample.glb')
  await expect.poll(() => page.locator('model-viewer').evaluate(el => (el as HTMLElement & { loaded: boolean }).loaded), { timeout: 20000 }).toBe(true)
  await expect(page.getByText('Loading 3D model…')).toHaveCount(0)
  const orbit = await page.locator('model-viewer').evaluate(el => (el as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)
  const box = await page.locator('model-viewer').boundingBox()
  if (!box) throw new Error('Model viewer has no visible bounds')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => page.locator('model-viewer').evaluate(el => (el as HTMLElement & { getCameraOrbit(): { theta: number } }).getCameraOrbit().theta)).not.toBe(orbit)
  await page.screenshot({ path: `/tmp/drive-glb-preview-${width}.png` })
  await close()
  await open('sample.gltf')
  await expect.poll(() => page.locator('model-viewer').evaluate(el => (el as HTMLElement & { loaded: boolean }).loaded), { timeout: 20000 }).toBe(true)
  await expect(page.getByText('Loading 3D model…')).toHaveCount(0)
  await close()
  for (const [name, content] of [['sample.tsx', 'Safe source text'], ['contacts.vcf', 'Preview Contact'], ['sample.xlsx', 'CAB-100'], ['sample.xls', 'CAB-100'], ['sample.csv', 'CSV-CAB'], ['sample.docx', 'Readable Word content'], ['sample.zip', 'inside.txt'], ['.~lock.sample.xlsx#', 'editor,workstation'], ['unknown.bin', '00 41 ff 08']]) {
    await open(name)
    await expect(page.getByRole('dialog')).toContainText(content, { timeout: 15000 })
    if (name === 'sample.xlsx') {
      await page.getByRole('button', { name: 'Next rows' }).click()
      await expect(page.getByRole('dialog')).toContainText('ROW-108')
      await page.getByRole('combobox', { name: 'Spreadsheet sheet' }).selectOption('Summary')
      await expect(page.getByRole('dialog')).toContainText('Second sheet value')
    }
    await close()
  }
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
