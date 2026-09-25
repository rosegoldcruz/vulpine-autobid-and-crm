import path from "node:path"
import { expect, test, type Page } from "@playwright/test"

const createdAt = "2026-09-21T00:00:00.000Z"
const project = {
  projectId: "project-vision-01",
  projectName: "Riverside Commons",
  pageCount: 1,
  processingStatus: "ready",
  files: [{ id: "file-1", name: "Riverside Plans.pdf", path: "uploads/plans.pdf", size: 2_480_412, mimeType: "application/pdf" }],
  pdfFiles: [{ id: "file-1", name: "Riverside Plans.pdf", path: "uploads/plans.pdf", size: 2_480_412, mimeType: "application/pdf" }],
  workbookFiles: [{ id: "file-2", name: "Cabinet Pricing.xlsx", path: "uploads/pricing.xlsx", size: 84_290, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
}

const job = {
  id: "job-vision-01",
  projectId: project.projectId,
  state: "cabinet_bid_review_required",
  manifest: {
    pageCount: 1,
    files: [...project.files, ...project.workbookFiles],
    pdfFiles: project.pdfFiles,
    workbookFiles: project.workbookFiles,
  },
  classifiedPages: [],
  qaResult: {
    safeToSend: false,
    criticalIssues: [{ code: "REVIEW_REQUIRED", message: "Estimator review is required before delivery." }],
    warnings: [],
    assumptions: [],
  },
}

const canonical = {
  job: {
    id: job.id,
    projectId: project.projectId,
    state: "cabinet_bid_review_required",
    unresolvedItemIds: ["qa-1"],
    stateHistory: [{ id: "event-1", to: "cabinet_bid_review_required", accepted: true, actorId: "vision-system", occurredAt: createdAt }],
  },
  unitTypes: [{ id: "unit-1", code: "A1", name: "Unit A1", accessibility: "standard" }],
  unitMixEntries: [{ id: "mix-1", unitTypeId: "unit-1", extractedCount: 12, verifiedCount: 12, status: "verified", evidenceIds: ["evidence-1"] }],
  cabinetInstances: [{
    id: "cabinet-1",
    unitTypeId: "unit-1",
    room: "Kitchen",
    category: "wall",
    interpretedCode: "W30",
    widthInches: 30,
    heightInches: 30,
    depthInches: 12,
    quantityPerUnit: 1,
    evidenceIds: ["evidence-1"],
    status: "approved",
  }],
  takeoffLines: [{ id: "takeoff-1", cabinetInstanceId: "cabinet-1", unitTypeId: "unit-1", quantityPerUnit: 1, status: "approved", evidenceIds: ["evidence-1"] }],
  catalogSkus: [{ id: "sku-1", sku: "W30-STD", cabinetCode: "W30", description: "30 inch wall cabinet", sourceWorkbook: "Cabinet Pricing.xlsx", sourceWorksheet: "Catalog", sourceRow: 7, unitCostCents: 25000 }],
  mappings: [{ id: "mapping-1", takeoffLineId: "takeoff-1", catalogSkuId: "sku-1", outcome: "exact", matchMethod: "normalized_code" }],
  estimateLines: [{ id: "estimate-1", mappingId: "mapping-1", unitMixEntryId: "mix-1", description: "W30 cabinet", projectQuantity: 12, unitCostCents: 25000, extendedCostCents: 300000, currency: "USD", evidenceIds: ["evidence-1"] }],
  qaResults: [{
    id: "qa-result-1",
    safeToSend: false,
    issues: [{ id: "qa-1", code: "REVIEW_REQUIRED", severity: "critical", message: "Estimator review is required before delivery.", resolved: false, evidenceIds: ["evidence-1"] }],
    reviewerRequirements: ["Resolve the linked issue."],
    executedAt: createdAt,
  }],
  approvals: [],
  visionEvidence: [{ id: "evidence-1", planSheetId: "sheet-1", kind: "cabinet", region: { x: 0.2, y: 0.25, width: 0.3, height: 0.2 }, text: "W30 callout", confidence: 1, createdAt }],
}

const workspace = {
  project,
  job,
  run: { id: "run-1", status: "completed", currentStage: "review", lastProgressAt: createdAt },
  diagnostics: {
    stall: { stalled: false },
    eta: null,
    retry: { automatic: true, maximumAttempts: 3, attempt: 1 },
    controls: { canPause: false, canResume: false, canCancel: false, canRetry: false, canRemove: true },
  },
  progressEvents: [{ id: "progress-1", sequence: 1, stage: "review", unit: "documents", completed: 1, total: 1, message: "Review workspace ready.", occurredAt: createdAt }],
  canonical,
  planSheets: [{
    id: "sheet-1",
    sourceDocumentId: "document-1",
    sourceFileName: "Riverside Plans.pdf",
    pageNumber: 1,
    sheetNumber: "A5.1",
    title: "Kitchen Elevation",
    classification: "KITCHEN_ELEVATION",
    classificationConfidence: 0.98,
    reviewRequired: false,
    renderStorageKey: "renders/sheet-1.png",
    renderWidthPx: 1200,
    renderHeightPx: 800,
  }],
  ingestionManifest: {
    manifestId: "manifest-1",
    entries: [{ entryId: "entry-1", ordinal: 1, originalPath: "Riverside Plans.pdf", normalizedPath: "Riverside Plans.pdf", baseName: "Riverside Plans.pdf", kind: "plan_pdf", outcome: "supported", sizeBytes: 2_480_412 }],
    summary: { total: 1, supported: 1, rejected: 0, duplicate: 0, failed: 0 },
  },
  fileQueue: [{ id: "queue-1", sourceDocumentId: "document-1", fileName: "Riverside Plans.pdf", originalPath: "Riverside Plans.pdf", status: "completed", stage: "render", completedUnits: 1, totalUnits: 1, attempt: 1 }],
  canonicalCounts: { takeoff: 1, mappings: 1, estimateLines: 1, qaRuns: 1, exports: 0 },
  integrations: {
    email: { provider: null, status: "not_configured", message: "Email provider is not configured." },
    companyIntelligence: { provider: null, status: "not_configured", message: "Company intelligence provider is not configured." },
    maps: { provider: null, status: "not_configured", message: "Maps provider is not configured." },
    cabinetVision: { provider: null, status: "not_configured", message: "Cabinet Vision provider is not configured." },
  },
}

const analytics = {
  pipeline: {
    projectCount: 1,
    unitsRepresented: 12,
    totalActiveBidValue: [{ currency: "USD", amountCents: 300000 }],
    bidValueAwaitingQa: [{ currency: "USD", amountCents: 300000 }],
    submittedValue: [],
    awardedValue: [],
    lostValue: [],
    stages: [{ stage: "review", projectCount: 1, unitCount: 12, averageAgeDays: 1, maximumAgeDays: 1, bidValue: [{ currency: "USD", amountCents: 300000 }] }],
    bottlenecks: [],
  },
  operatingTrend: { periodDays: 30, comparisons: { qa_review: { currentCount: 1, previousCount: 0, zeroBaseline: true } } },
  outreachVelocity: { currentCount: 0, previousCount: 0, zeroBaseline: true },
  completedBidValues: [],
}

const settings = {
  automaticRetries: true,
  maximumRetryAttempts: 3,
  retryBaseDelayMs: 500,
  retryMaximumDelayMs: 10000,
  retryServerErrors: true,
  workerConcurrency: 2,
  stallThresholdMs: 60000,
  processingDefaults: { autoStart: false, resumeFromCheckpoint: true },
}

function gatewayEnvelope(data: unknown) {
  return {
    ok: true,
    data,
    meta: { contractVersion: "2026-09-20", correlationId: "qa-request-1234" },
  }
}

async function mockVisionGateway(page: Page) {
  await page.addInitScript(({ projectId, jobId }) => {
    window.localStorage.setItem("vulpine.workspace.pointer.v1", JSON.stringify({ version: 1, projectId, jobId }))
  }, { projectId: project.projectId, jobId: job.id })

  await page.route("**/api/vision/**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === "GET" && pathname === "/api/vision/projects") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope({ projects: [project] })) })
    }
    if (request.method() === "GET" && pathname === `/api/vision/jobs/${job.id}/workspace`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope(workspace)) })
    }
    if (request.method() === "GET" && pathname === "/api/vision/notifications") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope({ notifications: [] })) })
    }
    if (request.method() === "GET" && pathname === `/api/vision/projects/${project.projectId}/comments`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope({ comments: [] })) })
    }
    if (request.method() === "GET" && pathname === "/api/vision/backoffice/analytics") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope(analytics)) })
    }
    if (request.method() === "GET" && pathname === "/api/vision/processing-settings") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gatewayEnvelope({ settings })) })
    }
    if (request.method() === "GET" && pathname === "/api/vision/plan-sheets/sheet-1/image") {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      })
    }

    throw new Error(`Unexpected Vision gateway request: ${request.method()} ${pathname}`)
  })
}

async function expectWorkspaceFrame(page: Page) {
  const navigation = page.getByLabel("Cabinet Brain navigation")
  await expect(navigation).toBeVisible()
  for (const name of ["Projects", "Pipeline", "Review Queue", "Settings"]) {
    await expect(navigation.getByRole("button", { name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole("heading", { name: "Draft viewer" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Blueprint studio" })).toBeVisible()
  await expect(page.getByText("QA status", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Critical issues" })).toBeVisible()
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0)
}

test("Vision route fails closed when the authenticated gateway is unavailable", async ({ page }) => {
  await page.goto("/bids/vision")
  await expect(page.getByLabel("Cabinet Brain navigation")).toBeVisible()
  await expect(page.locator(".cabinet-brain-root .alert[role=alert]")).toContainText(/authentication is unavailable|missing required env var/i)
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0)
})

test("migrated Cabinet Brain workspace renders real review surfaces on desktop and mobile", async ({ page }) => {
  await mockVisionGateway(page)
  await page.goto("/bids/vision")
  await expectWorkspaceFrame(page)
  const navigation = page.getByLabel("Cabinet Brain navigation")
  await expect(page.getByText("Riverside Commons", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("cell", { name: "W30 wall" })).toBeVisible()

  await page.getByRole("button", { name: "Source", exact: true }).evaluate((button) => button.click())
  await expect(page.getByText("Requested evidence: evidence-1")).toBeVisible()
  await expect(page.getByRole("button", { name: "Evidence overlay cabinet" })).toHaveCSS("pointer-events", "auto")

  await navigation.getByRole("button", { name: "Pipeline", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Pipeline, operating rhythm, and approved bid value" })).toBeVisible()

  await navigation.getByRole("button", { name: "Review Queue", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Draft viewer" })).toBeVisible()

  await navigation.getByRole("button", { name: "Settings", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Processing settings" })).toBeVisible()

  await navigation.getByRole("button", { name: "Projects", exact: true }).click()
  await expectWorkspaceFrame(page)

  const output = process.env.VISION_SCREENSHOT_DIR || test.info().outputDir
  await page.screenshot({ path: path.join(output, "vision-desktop.png"), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expectWorkspaceFrame(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: path.join(output, "vision-mobile.png"), fullPage: true })
})
