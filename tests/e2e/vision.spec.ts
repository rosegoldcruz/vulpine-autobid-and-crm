import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

const createdAt = "2026-09-21T00:00:00.000Z"
const project = {
  projectId: "project-vision-01",
  projectName: "Riverside Commons",
  files: [],
  pdfFiles: [],
  workbookFiles: [],
  pageCount: 0,
  createdAt,
  processingStatus: "created",
}
const projectWithFiles = {
  ...project,
  processingStatus: "uploaded",
  files: [
    { id: "file-1", name: "Riverside Plans.pdf", path: "uploads/plans.pdf", size: 2_480_412, mimeType: "application/pdf" },
    { id: "file-2", name: "Cabinet Pricing.xlsx", path: "uploads/pricing.xlsx", size: 84_290, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ],
  pdfFiles: [{ id: "file-1", name: "Riverside Plans.pdf", path: "uploads/plans.pdf", size: 2_480_412, mimeType: "application/pdf" }],
  workbookFiles: [{ id: "file-2", name: "Cabinet Pricing.xlsx", path: "uploads/pricing.xlsx", size: 84_290, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
}
const job = {
  id: "job-vision-01",
  projectId: project.projectId,
  state: "files_ingested",
  manifest: projectWithFiles,
  classifiedPages: [],
  qaResult: { safeToSend: false, criticalIssues: [{ code: "NOT_PROCESSED", message: "Document pass is pending." }], warnings: [], assumptions: [] },
}
const processedJob = {
  ...job,
  state: "unit_mix_review_required",
  manifest: { ...projectWithFiles, pageCount: 42, processingStatus: "ready" },
  classifiedPages: Array.from({ length: 42 }, (_, index) => ({ document: "Riverside Plans.pdf", pageNumber: index + 1, classification: "UNKNOWN", confidence: 0.3, reason: "Unverified deterministic signal." })),
  qaResult: {
    safeToSend: false,
    criticalIssues: [
      { code: "UNIT_MIX_REQUIRED", message: "Unit mix must be verified by an estimator." },
      { code: "TAKEOFF_REQUIRED", message: "A verified takeoff is required before pricing." },
      { code: "SAFE_TO_SEND_QUARANTINED", message: "SAFE_TO_SEND is disabled until Golden Bid validation is complete." },
    ],
    warnings: [], assumptions: [],
  },
}

function envelope(data: unknown) {
  return { ok: true, data, meta: { contractVersion: "2026-09-20", correlationId: "qa-request-1234" } }
}

async function verifyFrame(page: Page) {
  await expect(page.getByRole("heading", { name: "Plan Room" })).toBeVisible()
  await expect(page.getByText("Sample workspace", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Cabinet Intelligence" })).toBeVisible()
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0)
  expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(100)
}

test("Vision route loads and API access fails closed without ZITADEL", async ({ page }) => {
  await page.goto("/bids/vision")
  await verifyFrame(page)
  await page.getByRole("button", { name: "New run" }).click()
  await page.getByRole("button", { name: "Create authoritative project" }).click()
  await expect(page.getByText("Backoffice authentication is unavailable", { exact: false }).first()).toBeVisible()
})

test("Cabinet Brain sample supports evidence review decisions", async ({ page }) => {
  await page.goto("/bids/vision")
  await verifyFrame(page)
  await page.getByRole("button", { name: "Mark Custom" }).click()
  await expect(page.getByText("Marked as custom millwork", { exact: true })).toBeVisible()
  await expect(page.getByText("Custom scope", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Approve & Next" }).click()
  await expect(page.getByText("Cabinet approved", { exact: true })).toBeVisible()
  await expect(page.getByText("Verified", { exact: true })).toBeVisible()
})

test("Vision create, upload, process, refresh and responsive states render", async ({ page }) => {
  await page.route("**/api/vision/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith("/projects")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(envelope({ project })) })
    if (pathname.endsWith("/uploads")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(envelope({ project: projectWithFiles, job })) })
    if (pathname.endsWith("/process") || route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope({ project: processedJob.manifest, job: processedJob })) })
    return route.abort()
  })

  await page.goto("/bids/vision")
  await verifyFrame(page)
  await page.getByRole("button", { name: "New run" }).click()
  await expect(page.getByRole("heading", { name: "New Cabinet Brain Run" })).toBeVisible()
  await page.getByLabel("Project *").fill("Riverside Commons")
  await page.getByRole("button", { name: "Create authoritative project" }).click()
  await expect(page.getByText("Project created", { exact: true })).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles([
    { name: "Riverside Plans.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") },
    { name: "Cabinet Pricing.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("xlsx") },
  ])
  await page.getByRole("button", { name: "Discover sources" }).click()
  await expect(page.getByText("Discovery complete", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Plan Room" })).toBeVisible()
  await expect(page.getByText("Riverside Commons", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Drawing preview is not available yet", { exact: true })).toBeVisible()

  const output = process.env.VISION_SCREENSHOT_DIR || test.info().outputDir
  await page.screenshot({ path: path.join(output, "vision-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(700)
  await expect(page.getByRole("heading", { name: "Plan Room" })).toBeVisible()
  await page.screenshot({ path: path.join(output, "vision-mobile.png"), fullPage: true })
})
