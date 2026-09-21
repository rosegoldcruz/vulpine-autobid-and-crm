import assert from "node:assert/strict"
import test from "node:test"
import { enforceEstimatorQuarantine, rejectEstimatorMutation, SAFE_TO_SEND_QUARANTINE_CODE } from "../src/quarantine.js"
import type { VisionJob } from "../src/types.js"

function fixture(): VisionJob {
  const now = new Date().toISOString()
  return {
    id: "job-1", projectId: "project-1", state: "unit_mix_review_required", createdAt: now, updatedAt: now,
    manifest: { projectId: "project-1", projectName: "Fixture", files: [], pdfFiles: [], workbookFiles: [], pageCount: 0, createdAt: now, processingStatus: "ready" },
    workbookRecords: [], classifiedPages: [], unitMix: [], takeoffRows: [], skuMappings: [], pricingLines: [],
    qaResult: { safeToSend: false, criticalIssues: [], warnings: [], assumptions: [] }, timings: [], logs: [],
  }
}

test("quarantine always forces empty estimator output and safeToSend=false", () => {
  const job = enforceEstimatorQuarantine(fixture())
  assert.equal(job.qaResult.safeToSend, false)
  assert.deepEqual(job.unitMix, [])
  assert.deepEqual(job.takeoffRows, [])
  assert.deepEqual(job.skuMappings, [])
  assert.deepEqual(job.pricingLines, [])
  assert.equal(job.qaResult.criticalIssues.at(-1)?.code, SAFE_TO_SEND_QUARANTINE_CODE)
})

test("estimator mutations fail closed", () => {
  assert.throws(() => rejectEstimatorMutation("pricing"), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "ESTIMATOR_INTELLIGENCE_DISABLED")
    return true
  })
})
