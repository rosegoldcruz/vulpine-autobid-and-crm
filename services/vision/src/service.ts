import "server-only"
import { randomUUID } from "node:crypto"
import {
  leadHandoffContextV1Schema,
  leadsVisionHandoffRequestV1Schema,
  leadsVisionHandoffResponseV1Schema,
  type LeadsVisionHandoffRequestV1,
  type LeadsVisionHandoffResponseV1,
} from "@vulpine/contracts"
import type { VisionJob } from "./types.js"
import { VisionServiceError } from "./errors.js"
import { ProjectRepository, JobRepository } from "./repositories.js"
import { readBinary } from "./storage.js"
import { parsePdf, parseWorkbook } from "./parsers.js"
import { enforceEstimatorQuarantine, rejectEstimatorMutation } from "./quarantine.js"
import { nextState } from "./workflow.js"

function issues(job: VisionJob) {
  const result = []
  if (!job.manifest.workbookFiles.length) result.push({ code: "WORKBOOK_REQUIRED", message: "A pricing workbook is required." })
  if (!job.manifest.pdfFiles.length) result.push({ code: "PDF_REQUIRED", message: "At least one plan PDF is required." })
  if (!job.classifiedPages.length) result.push({ code: "CLASSIFICATION_REQUIRED", message: "No PDF pages were classified." })
  result.push({ code: "UNIT_MIX_REQUIRED", message: "Unit mix must be verified by an estimator." })
  result.push({ code: "TAKEOFF_REQUIRED", message: "A verified takeoff is required before pricing." })
  return result
}

export async function processJob(jobId: string): Promise<VisionJob> {
  const jobs = new JobRepository()
  const projects = new ProjectRepository()
  const job = await jobs.get(jobId)
  if (!job) throw new VisionServiceError("JOB_NOT_FOUND", "Job not found.", 404, { jobId })
  if (!job.manifest.workbookFiles.length) {
    job.state = nextState(job.state, "failed")
    job.errorMessage = "A pricing workbook is required."
    enforceEstimatorQuarantine(job)
    await jobs.save(job)
    return job
  }
  const start = Date.now()
  const workbook = job.manifest.workbookFiles[0]
  job.workbookRecords = parseWorkbook(await readBinary(workbook.path), workbook.name)
  job.state = nextState(job.state, "workbook_ingested")
  job.classifiedPages = []
  let pageCount = 0
  for (const pdfFile of job.manifest.pdfFiles) {
    const result = await parsePdf(await readBinary(pdfFile.path), pdfFile.name)
    pageCount += result.pageCount
    job.classifiedPages.push(...result.pages)
  }
  job.manifest.pageCount = pageCount
  job.state = nextState(job.state, "pages_classified")
  job.state = nextState(job.state, "unit_mix_drafted")
  job.state = nextState(job.state, "unit_mix_review_required")
  job.qaResult = {
    safeToSend: false,
    criticalIssues: issues(job),
    warnings: [],
    assumptions: [
      "Document classification is deterministic metadata only and remains unverified.",
      "No generated unit mix, takeoff, SKU mapping, pricing, or send approval is permitted.",
    ],
  }
  job.timings.push({ stage: "deterministic_ingestion", startTime: new Date(start).toISOString(), endTime: new Date().toISOString(), durationMs: Date.now() - start })
  enforceEstimatorQuarantine(job)
  job.manifest.processingStatus = "ready"
  await jobs.save(job)
  await projects.save(job.manifest)
  return job
}

export async function createLeadHandoff(input: LeadsVisionHandoffRequestV1): Promise<LeadsVisionHandoffResponseV1> {
  const parsed = leadsVisionHandoffRequestV1Schema.parse(input)
  const projectRepo = new ProjectRepository()
  const project = await projectRepo.create(parsed.projectName)
  const correlationId = parsed.correlationId || randomUUID()
  project.leadHandoff = leadHandoffContextV1Schema.parse({ ...parsed, correlationId, createdAt: new Date().toISOString() })
  await projectRepo.save(project)
  return leadsVisionHandoffResponseV1Schema.parse({ project, handoff: { projectId: project.projectId, correlationId, nextAction: "Upload bid files via POST /api/uploads with x-project-id header." } })
}

export const approveUnitMix = () => rejectEstimatorMutation("approve-unit-mix")
export const resolveSku = () => rejectEstimatorMutation("resolve")
export const exportBid = () => rejectEstimatorMutation("export")
export const createPricing = () => rejectEstimatorMutation("pricing")
export const createTakeoff = () => rejectEstimatorMutation("takeoff")
