import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { localAuth } from './local-auth'

test.skip(!process.env.OPERATIONS_AUTH_QA, 'Requires isolated authenticated QA')
for (const width of [1440, 390]) {
  test(`folder picker uploads nested relative paths at ${width}px`, async ({ page, context }) => {
    await localAuth(context)
    await page.setViewportSize({ width, height: 900 })
    const folder = await mkdtemp(join(tmpdir(), 'Drive folder fixture-'))
    const root = basename(folder)
    try {
      for (const directory of ['Plans', 'Revisions']) {
        await mkdir(join(folder, directory))
        await writeFile(join(folder, directory, 'sheet.txt'), directory)
      }
      let uploaded = false
      await page.route('**/api/drive/**', async route => {
        const ticket = route.request().url().includes('upload-ticket')
        await route.fulfill({ json: { ok: true, data: ticket ? { uploadUrl: `${process.env.PLAYWRIGHT_BASE_URL}/folder-upload-transfer`, expiresAt: new Date(Date.now() + 300000).toISOString() } : { path: '/', parent: '/', items: uploaded ? [{ name: root, path: '/' + root, type: 'folder', size: 0, modifiedAt: null }] : [], generatedAt: new Date().toISOString() }, meta: {} } })
      })
      await page.route('**/folder-upload-transfer', async route => {
        const request = route.request()
        const form = await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData()
        expect(form.get('path')).toBe('/')
        expect(JSON.parse(String(form.get('paths'))).sort()).toEqual([`${root}/Plans/sheet.txt`, `${root}/Revisions/sheet.txt`])
        expect(form.getAll('files')).toHaveLength(2)
        uploaded = true
        await route.fulfill({ json: { uploaded: 2 } })
      })
      await page.goto('/drive')
      await expect(page.getByRole('button', { name: 'Upload folder', exact: true }).filter({ visible: true })).toBeVisible()
      await page.locator('input[webkitdirectory]').setInputFiles(folder)
      await expect(page.getByText('2 files uploaded', { exact: true })).toBeVisible()
      expect(uploaded).toBe(true)
      await expect(page.getByRole('button', { name: root, exact: false }).first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    } finally { await rm(folder, { recursive: true, force: true }) }
  })
}

test('read-only Drive users have no folder upload control', async ({ page, context }) => {
  await localAuth(context, ['executive'])
  await page.route('**/api/drive/**', route => route.fulfill({ json: { ok: true, data: { path: '/', parent: '/', items: [], generatedAt: new Date().toISOString() }, meta: {} } }))
  await page.goto('/drive')
  await expect(page.getByRole('button', { name: 'Upload folder', exact: true })).toHaveCount(0)
  await expect(page.locator('input[webkitdirectory]')).toHaveCount(0)
})

test('3000-file folder shows progress and resumes after a partial batch failure', async ({ page, context }) => {
  test.setTimeout(120000)
  await localAuth(context)
  const folder = await mkdtemp(join(tmpdir(), 'Drive bulk fixture-'))
  let nextPendingPath = ""
  const received = new Set<string>()
  let requests = 0
  try {
    for (let start = 0; start < 3000; start += 100) await Promise.all(Array.from({ length: 100 }, (_, offset) => writeFile(join(folder, `plan-${String(start + offset).padStart(4, '0')}.txt`), 'fixture')))
    await page.route('**/api/drive/**', route => route.fulfill({ json: { ok: true, data: route.request().url().includes('upload-ticket') ? { uploadUrl: `${process.env.PLAYWRIGHT_BASE_URL}/bulk-upload-transfer` } : { path: '/', parent: '/', items: [], generatedAt: new Date().toISOString() }, meta: {} } }))
    await page.route('**/bulk-upload-transfer', async route => {
      requests++
      const request = route.request()
      const form = await new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postDataBuffer() }).formData()
      const paths = JSON.parse(String(form.get('paths'))) as string[]
      expect(paths.length).toBeLessThanOrEqual(100)
      if (requests === 2) {
        nextPendingPath = paths[25]
        paths.slice(0, 25).forEach(path => received.add(path))
        await route.fulfill({ status: 503, json: { uploaded: 25, error: { message: 'Temporary storage failure' } } })
      } else {
        if (requests === 3) expect(paths[0]).toBe(nextPendingPath)
        for (const path of paths) { expect(received.has(path)).toBe(false); received.add(path) }
        await route.fulfill({ json: { uploaded: paths.length } })
      }
    })
    await page.goto('/drive')
    await page.locator('input[webkitdirectory]').setInputFiles(folder)
    await expect(page.getByRole('status').filter({ hasText: 'Upload paused 125 of 3,000 files' })).toBeVisible()
    await expect(page.getByText('Vulpine Drive unavailable:', { exact: false })).toHaveCount(0)
    await page.getByRole('button', { name: 'Resume upload', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Uploaded 3,000 of 3,000 files' })).toBeVisible({ timeout: 60000 })
    expect(received.size).toBe(3000)
  } finally { await rm(folder, { recursive: true, force: true }) }
})

test('upload shows saving state while a transferred batch awaits storage acknowledgement', async ({ page, context }) => {
  await localAuth(context)
  let acknowledge!: () => void
  const saving = new Promise<void>(resolve => { acknowledge = resolve })
  const server = createServer((request, response) => {
    response.setHeader('access-control-allow-origin', process.env.PLAYWRIGHT_BASE_URL!)
    response.setHeader('access-control-allow-methods', 'POST, OPTIONS')
    response.setHeader('access-control-allow-headers', 'content-type')
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
    request.resume()
    request.on('end', () => { void saving.then(() => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"uploaded":1}') }) })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    await page.route('**/api/drive/**', route => route.fulfill({ json: { ok: true, data: route.request().url().includes('upload-ticket') ? { uploadUrl: `http://127.0.0.1:${address.port}/upload` } : { path: '/', parent: '/', items: [], generatedAt: new Date().toISOString() }, meta: {} } }))
    await page.goto('/drive')
    await page.locator('input[type=file]').first().setInputFiles({ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.alloc(1048576, 65) })
    await expect(page.getByText('Saving this batch of 1 file to Drive…', { exact: true })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Upload progress' })).not.toHaveAttribute('value')
    acknowledge()
    await expect(page.getByRole('status').filter({ hasText: 'Uploaded 1 of 1 files' })).toBeVisible()
  } finally {
    acknowledge()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
