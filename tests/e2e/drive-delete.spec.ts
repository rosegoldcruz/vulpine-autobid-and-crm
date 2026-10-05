import { test, expect } from '@playwright/test'
import { localAuth } from './local-auth'

test.skip(!process.env.OPERATIONS_AUTH_QA, 'Requires isolated local authenticated QA')

for (const width of [1440, 390]) {
  test(`file deletion confirms, handles failure, and clears favorites at ${width}px`, async ({ page, context }) => {
    await localAuth(context)
    await page.setViewportSize({ width, height: 900 })
    const file = { name: 'Delete QA.txt', path: '/Delete QA.txt', type: 'file', size: 12, modifiedAt: null }
    const folder = { ...file, name: 'Keep folder', path: '/Keep folder', type: 'folder' }
    let deleted = false
    let fail = true
    let requests = 0
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('vulpine-drive-favorites', JSON.stringify(['/Delete QA.txt'])))
    await page.route('**/api/drive/**', async route => {
      if (route.request().method() === 'DELETE') {
        requests += 1
        if (!fail) deleted = true
        await route.fulfill({ status: fail ? 500 : 200, json: fail ? { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Permission denied' }, meta: {} } : { ok: true, data: { deleted: true }, meta: {} } })
      } else {
        await route.fulfill({ json: { ok: true, data: { path: '/', parent: '/', items: deleted ? [folder] : [file, folder], generatedAt: new Date().toISOString() }, meta: {} } })
      }
    })
    await page.goto('/drive')
    await expect(page).toHaveTitle(/Vulpine Drive/)
    const actions = page.getByRole('button', { name: 'Actions for Delete QA.txt' }).filter({ visible: true })
    await actions.click()
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    expect(requests).toBe(0)
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    await expect(page.getByText('Delete failed', { exact: true })).toBeVisible()
    await expect(page.getByText('Permission denied', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete file', exact: true })).toBeEnabled()
    fail = false
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    await expect(page.getByText('File deleted', { exact: true })).toBeVisible()
    await expect(actions).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vulpine-drive-favorites') || '[]'))).toEqual([])
    await page.getByRole('button', { name: 'Actions for Keep folder' }).filter({ visible: true }).click()
    await expect(page.getByRole('button', { name: 'Delete file', exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
    await page.screenshot({ path: `/tmp/drive-delete-${width}.png` })
  })
}

test('read-only roles cannot delete through the gateway', async ({ context }) => {
  await localAuth(context, ['executive'])
  expect((await context.request.delete('/api/drive/files?path=/qa.txt')).status()).toBe(403)
  await context.clearCookies()
  expect((await context.request.delete('/api/drive/files?path=/qa.txt')).status()).toBe(401)
})
