import { chromium, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.LIVE_BASE_URL || 'https://backoffice.vulpine.llc'
const tokenPath = process.env.LIVE_NEXTAUTH_TOKEN_PATH
const planPdf = process.env.LIVE_PLAN_PDF
const workbook = process.env.LIVE_WORKBOOK
const evidenceDir = process.env.LIVE_EVIDENCE_DIR || path.resolve('docs/migration/cabinet-brain-recovery/evidence')

if (!tokenPath || !planPdf || !workbook) {
  throw new Error('LIVE_NEXTAUTH_TOKEN_PATH, LIVE_PLAN_PDF, and LIVE_WORKBOOK are required.')
}

const token = fs.readFileSync(tokenPath, 'utf8').trim()
if (!token) throw new Error('The NextAuth verification token is empty.')
fs.mkdirSync(evidenceDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const report = {
  baseUrl,
  unauthenticated: {},
  authenticated: {},
  workflow: {},
  nestedRoutes: {},
  consoleErrors: [],
  failedResponses: [],
}

try {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const anonymousPage = await anonymous.newPage()
  await anonymousPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
  report.unauthenticated.finalUrl = anonymousPage.url()
  report.unauthenticated.redirectedToSignIn = anonymousPage.url().includes('/api/auth/signin') || anonymousPage.url().includes('zitadel')
  await anonymous.close()

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await context.addCookies([{
    name: '__Secure-next-auth.session-token',
    value: token,
    domain: new URL(baseUrl).hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }])
  const page = await context.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => report.consoleErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push({ status: response.status(), url: response.url() })
  })

  const rootResponse = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  report.authenticated.rootStatus = rootResponse?.status()
  report.authenticated.rootUrl = page.url()
  await expect(page.getByText('Command Center', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cabinet Brain', exact: true }).first()).toBeVisible()
  await page.screenshot({ path: path.join(evidenceDir, 'live-backoffice-root-desktop.png'), fullPage: true })

  const visionResponse = await page.goto(`${baseUrl}/bids/vision`, { waitUntil: 'networkidle' })
  report.authenticated.visionStatus = visionResponse?.status()
  report.authenticated.visionUrl = page.url()
  await expect(page.getByLabel('Cabinet Brain navigation')).toBeVisible()
  await expect(page.getByLabel('Project name')).toBeVisible()
  const projectsResponse = await page.request.get(`${baseUrl}/api/vision/projects`)
  report.authenticated.projectsApiStatus = projectsResponse.status()
  expect(projectsResponse.ok()).toBeTruthy()

  const projectName = `Live Cabinet Brain QA ${Date.now()}`
  await page.getByLabel('Project name').fill(projectName)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Project created. Add plans and an authoritative pricing workbook.')).toBeVisible()
  await page.locator('input[type=file]').first().setInputFiles([planPdf, workbook])
  await page.getByRole('button', { name: 'Add files' }).click()
  await expect(page.getByText(/files are now in the server manifest/)).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Run next stage' }).click()
  await expect(page.getByText('Processing checkpoint saved. Review the current required action.')).toBeVisible({ timeout: 120_000 })

  const planImage = page.locator('.blueprint-transform img').first()
  await expect(planImage).toBeVisible({ timeout: 45_000 })
  await planImage.evaluate((image) => image.complete && image.naturalWidth > 0
    ? true
    : new Promise((resolve) => image.addEventListener('load', () => resolve(true), { once: true })))
  await page.screenshot({ path: path.join(evidenceDir, 'live-cabinet-brain-workspace-desktop.png'), fullPage: true })

  await page.getByLabel('Reviewed classification').selectOption('KITCHEN_ELEVATION')
  await expect(page.getByText('Classification reviewed as kitchen elevation.')).toBeVisible()

  async function selectRegion() {
    await planImage.scrollIntoViewIfNeeded()
    await planImage.evaluate((image, points) => {
      const box = image.getBoundingClientRect()
      for (const point of points) {
        image.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width * point.x,
          clientY: box.top + box.height * point.y,
          view: window,
        }))
      }
    }, [{ x: .18, y: .2 }, { x: .42, y: .38 }])
  }

  await selectRegion()
  await page.getByRole('button', { name: 'Save source evidence' }).click()
  await expect(page.getByText('cabinet source evidence saved.')).toBeVisible()
  await page.getByLabel('Evidence kind').selectOption('unit_mix')
  await selectRegion()
  await page.getByRole('button', { name: 'Save source evidence' }).click()
  await expect(page.getByText('unit mix source evidence saved.')).toBeVisible()

  await page.getByRole('button', { name: 'Record reviewed extraction' }).click()
  await expect(page.getByText('Reviewed extraction recorded. Add the evidence-backed takeoff.')).toBeVisible()
  const cabinetCode = await page.evaluate(async () => {
    const pointer = JSON.parse(localStorage.getItem('vulpine.workspace.pointer.v1') || '{}')
    const response = await fetch(`/api/vision/jobs/${pointer.jobId}/workspace`, { cache: 'no-store' })
    const payload = await response.json()
    return payload.data.canonical.catalogSkus[0].cabinetCode
  })
  await page.getByLabel('Printed cabinet code').fill(cabinetCode)
  await page.getByRole('button', { name: 'Create takeoff draft' }).click()
  await expect(page.getByText('Takeoff draft recorded. Explicit line approval is now required.')).toBeVisible()
  await page.getByRole('button', { name: 'Approve all reviewed takeoff lines' }).click()
  await expect(page.getByText('Every takeoff line was explicitly approved.')).toBeVisible()
  await page.getByRole('button', { name: 'Record unit mix draft' }).click()
  await expect(page.getByText('Unit mix draft recorded. A reviewer must verify every count.')).toBeVisible()
  await page.getByRole('button', { name: 'Verify every unit count' }).click()
  await expect(page.getByText('Unit mix verified. SKU mapping is ready.')).toBeVisible()
  await page.getByRole('button', { name: 'Run deterministic SKU mapping' }).click()
  await expect(page.getByText('Deterministic exact-match mapping completed. Resolve any exceptions explicitly.')).toBeVisible()
  await page.getByRole('button', { name: 'Compile authoritative estimate' }).click()
  await expect(page.getByText('Estimate compiled with deterministic integer arithmetic and server catalog costs.')).toBeVisible()
  await page.getByRole('button', { name: 'Run deterministic QA' }).click()
  await expect(page.getByText('Deterministic QA completed. Review its exact result before approval.')).toBeVisible()
  await page.getByRole('button', { name: 'Approve clean QA result' }).click()
  await expect(page.getByText('Latest clean QA result explicitly approved. Customer exports are unlocked.')).toBeVisible()
  await page.getByLabel('Customer company').fill('Live Browser QA Customer')
  await page.getByLabel('Recipient').fill('buyer@example.invalid')
  await page.getByRole('button', { name: 'Prepare approved draft' }).click()
  await expect(page.getByText('Approved canonical total synchronized and outreach draft prepared. Nothing has been sent.')).toBeVisible()
  await page.getByLabel('Add comment').fill('Production browser-verified safe-to-send review.')
  await page.getByRole('button', { name: 'Save review comment' }).click()
  await expect(page.getByText('Review comment saved with authenticated authorship.')).toBeVisible()
  await page.screenshot({ path: path.join(evidenceDir, 'live-cabinet-brain-safe-to-send-desktop.png'), fullPage: true })

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText('Production browser-verified safe-to-send review.')).toBeVisible()
  const workflowTruth = page.locator('.workflow-truth strong').filter({ hasText: 'cabinet bid safe to send' })
  await expect(workflowTruth).toBeVisible()
  report.workflow.projectName = projectName
  report.workflow.canonicalState = await workflowTruth.textContent()
  report.workflow.renderedSheets = await page.locator('.sheet-thumb').count()
  report.workflow.refreshPersistence = true

  const innerNavigation = page.getByLabel('Cabinet Brain navigation')
  await innerNavigation.getByRole('button', { name: 'Pipeline' }).click()
  await expect(page.getByText('Backoffice command center')).toBeVisible()
  await innerNavigation.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText('Processing settings')).toBeVisible()
  await innerNavigation.getByRole('button', { name: 'Projects' }).click()

  for (const route of ['/', '/bids/vision', '/bids/tracker']) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
    report.nestedRoutes[route] = { status: response?.status(), finalUrl: page.url() }
    expect(response?.status()).toBeLessThan(400)
    expect(page.url()).not.toContain('/api/auth/signin')
  }
  const driveResponse = await page.request.get(`${baseUrl}/drive`)
  report.nestedRoutes['/drive'] = { status: driveResponse.status(), finalUrl: `${baseUrl}/drive` }
  expect(driveResponse.status()).toBeLessThan(400)

  await page.goto(`${baseUrl}/bids/vision`, { waitUntil: 'networkidle' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(evidenceDir, 'live-cabinet-brain-mobile.png'), fullPage: true })
  report.authenticated.title = await page.title()
  report.authenticated.finalUrl = page.url()

  await context.close()
} finally {
  await browser.close()
}

fs.writeFileSync(path.join(evidenceDir, 'live-production-verification.json'), `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

if (!report.unauthenticated.redirectedToSignIn || report.consoleErrors.length || report.failedResponses.length) {
  process.exitCode = 1
}
