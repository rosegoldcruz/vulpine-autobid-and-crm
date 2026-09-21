import "server-only"
import type { VisionJob } from "./types.js"
import { VisionServiceError } from "./errors.js"

export const ESTIMATOR_QUARANTINE_CODE = "ESTIMATOR_INTELLIGENCE_DISABLED" as const
export const SAFE_TO_SEND_QUARANTINE_CODE = "SAFE_TO_SEND_QUARANTINED" as const

export const QUARANTINED_OPERATIONS = [
  "approve-unit-mix",
  "resolve",
  "takeoff",
  "pricing",
  "export",
] as const

export function enforceEstimatorQuarantine(job: VisionJob): VisionJob {
  job.unitMix = []
  job.takeoffRows = []
  job.skuMappings = []
  job.pricingLines = []
  job.qaResult.safeToSend = false
  if (!job.qaResult.criticalIssues.some((issue) => issue.code === SAFE_TO_SEND_QUARANTINE_CODE)) {
    job.qaResult.criticalIssues.push({
      code: SAFE_TO_SEND_QUARANTINE_CODE,
      message: "SAFE_TO_SEND is disabled until Golden Bid validation is complete.",
    })
  }
  return job
}

export function rejectEstimatorMutation(operation: string): never {
  throw new VisionServiceError(
    ESTIMATOR_QUARANTINE_CODE,
    `${operation} is disabled while estimator intelligence remains quarantined.`,
    409,
    { operation },
  )
}
