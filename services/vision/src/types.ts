import type { LeadHandoffContextV1, VisionProjectManifest } from "@vulpine/contracts"

export type { LeadHandoffContextV1, VisionProjectManifest }

export type WorkflowState =
  | "created"
  | "files_ingested"
  | "workbook_ingested"
  | "pages_classified"
  | "unit_mix_drafted"
  | "unit_mix_review_required"
  | "failed"

export type QaIssue = { code: string; message: string }

export type ClassifiedPage = {
  document: string
  pageNumber: number
  classification: "UNIT_MATRIX" | "FLOOR_PLAN" | "UNIT_PLAN" | "FINISH_SCHEDULE" | "CASEWORK_SCHEDULE" | "UNKNOWN"
  confidence: number
  reason: string
}

export type WorkbookRecord = {
  sourceFile: string
  sourceSheet: string
  sourceRow: number
  cabinetCode?: string
  sku?: string
  description?: string
  unitCostCents?: number
}

export type VisionJob = {
  id: string
  projectId: string
  state: WorkflowState
  createdAt: string
  updatedAt: string
  manifest: VisionProjectManifest
  workbookRecords: WorkbookRecord[]
  classifiedPages: ClassifiedPage[]
  unitMix: never[]
  takeoffRows: never[]
  skuMappings: never[]
  pricingLines: never[]
  qaResult: {
    safeToSend: false
    criticalIssues: QaIssue[]
    warnings: string[]
    assumptions: string[]
  }
  timings: Array<{ stage: string; startTime: string; endTime: string; durationMs: number }>
  logs: Array<Record<string, unknown>>
  errorMessage?: string
}
