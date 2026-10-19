import { test, expect } from '@playwright/test'
import { localAuth } from './local-auth'
test.skip(!process.env.OPERATIONS_AUTH_QA, 'Requires isolated authenticated QA')
test.beforeEach(async ({ context }) => localAuth(context))
for (const width of [1440, 390]) {
  test(`pricing retains navigation and recovers a service failure at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let available = false
    await page.route('**/api/cabinet-pricing/health', route => route.fulfill({status: available ? 200 : 503, json: available ? {status:'ok'} : {error:'Unavailable'}}))
    await page.route('**/api/cabinet-pricing/index.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Pricing fixture</title><h1>Saved quotes</h1><button onclick="document.getElementById(\'result\').textContent=\'Quote opened\'">Open fixture quote</button><p id="result"></p>'}))
    await page.goto('/bids/pricing')
    await expect(page).toHaveURL(/\/bids\/pricing$/)
    await expect(page).toHaveTitle('Cabinet pricing | Vulpine Backoffice')
    await expect(page.getByRole('alert').filter({hasText:'Your saved quotes are retained'})).toBeVisible()
    available = true
    await page.getByRole('button', {name:'Retry pricing',exact:true}).click()
    const frame = page.frameLocator('iframe[title="Cabinet pricing workspace"]')
    await expect(frame.getByRole('heading', {name:'Saved quotes'})).toBeVisible()
    await frame.getByRole('button', {name:'Open fixture quote'}).click()
    await expect(frame.locator('#result')).toHaveText('Quote opened')
    await expect(page.getByText('Opening your saved quotes and pricing workspace…')).toHaveCount(0)
    await expect(page.getByRole('link', {name:'Open full screen'})).toHaveAttribute('href','/api/cabinet-pricing/index.html')
    await expect(page.getByRole('navigation', {name:width < 1024 ? 'Mobile navigation' : 'Main navigation'})).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
    expect(errors).toEqual([])
    await page.screenshot({path:`/opt/output/backoffice-pricing-${width}.png`})
  })
}
test('pricing reports session expiration and retains a sign-in return path', async ({page}) => {
  await page.route('**/api/cabinet-pricing/health', route => route.fulfill({status:401,json:{error:'Sign in required'}}))
  await page.goto('/bids/pricing')
  await expect(page.getByRole('alert').filter({hasText:'Your session has expired'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Sign in again'})).toHaveAttribute('href','/api/auth/signin?callbackUrl=/bids/pricing')
  await expect(page.locator('iframe')).toHaveCount(0)
})
