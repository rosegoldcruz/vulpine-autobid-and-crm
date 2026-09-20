import apiClient from "@/lib/api-client"

export type CabinetBidJobStatus =
  | "created"
  | "cabinet_workbook_uploaded"
  | "cabinet_plans_uploaded"
  | "cabinet_workbook_ingestion_failed"
  | "cabinet_plan_ingestion_failed"
  | "cabinet_processing_error"

export type CabinetBidJob = {
  id: string
  name: string
  customer_name: string | null
  project_name: string | null
  project_address: string | null
  cabinet_scope_type: string | null
  status: CabinetBidJobStatus
  safe_to_send: boolean
  pricing_source_type: string | null
  pricing_source_file: string | null
  pricing_source_hash: string | null
  pricing_source_version: string | null
  created_at: string
  updated_at: string
}

export type CabinetBidJobFile = {
  id: string
  cabinet_bid_job_id: string
  file_type: "cabinet_workbook" | "cabinet_plan_pdf"
  original_filename: string
  storage_key: string
  mime_type: string
  size_bytes: number
  sha256_hash: string
  upload_status: string
  created_at: string
}

export type CabinetBidJobDetail = {
  job: CabinetBidJob
  files: CabinetBidJobFile[]
}

export type CreateCabinetBidJobInput = {
  name: string
  customer_name?: string
  project_name?: string
  project_address?: string
  cabinet_scope_type?: string
  pricing_source_type?: string
  pricing_source_file?: string
  pricing_source_hash?: string
  pricing_source_version?: string
}

export const cabinetBidEngineApi = {
  listJobs() {
    return apiClient.get<{ jobs: CabinetBidJob[] }>("/autobid/cabinet/jobs")
  },
  createJob(input: CreateCabinetBidJobInput) {
    return apiClient.post<{ job: CabinetBidJob }>("/autobid/cabinet/jobs", input)
  },
  getJob(id: string) {
    return apiClient.get<CabinetBidJobDetail>(`/autobid/cabinet/jobs/${id}`)
  },
  uploadWorkbook(id: string, file: File) {
    const formData = new FormData()
    formData.append("workbook", file)
    return apiClient.upload<CabinetBidJobDetail>(`/autobid/cabinet/jobs/${id}/workbook`, formData)
  },
  uploadPlans(id: string, files: File[]) {
    const formData = new FormData()
    files.forEach((file) => formData.append("plans", file))
    return apiClient.upload<CabinetBidJobDetail>(`/autobid/cabinet/jobs/${id}/plans`, formData)
  },
}
