import type {
  ApiResponse,
  DirectoryListing,
  DriveRecentListing,
  DriveUploadResult,
  VisionProjectManifest,
} from "@vulpine/contracts"

export type BidStatus = "Sent" | "Follow-Up" | "Won" | "Lost"

export type BidRecord = {
  id: number
  project_name: string | null
  company_name: string | null
  units: number | null
  bid_amount: number | null
  projected_profit: number | null
  sent_date: string | null
  status: BidStatus | string | null
  filename?: string | null
  created_at?: string | null
}

export type BidKpis = {
  totalBids: number
  totalValue: number
  totalUnits: number
  totalProfit: number
  estimatedCost: number
  revenueWithProfit: number
  profitCoverageCount: number
  profitCoveragePct: number
  recordsNeedingReview: number
  avgProfitPerBid: number
  avgBid: number
  byCompany: Record<string, number>
  byStatus: Record<string, number>
  byMonth: Record<string, number>
}

export type UpdateBidInput = Partial<Pick<BidRecord, "project_name" | "company_name" | "units" | "bid_amount" | "sent_date" | "status">>

export type VisionProject = VisionProjectManifest

export type VisionJob = {
  id: string
  projectId: string
  state: string
  manifest: VisionProject
  classifiedPages: Array<{ document: string; pageNumber: number; classification: string; confidence: number; reason: string }>
  qaResult: {
    safeToSend: boolean
    criticalIssues: Array<{ code: string; message: string }>
    warnings: string[]
    assumptions: string[]
  }
}

type VisionEnvelope<T> =
  | { ok: true; data: T; meta?: { correlationId?: string } }
  | { ok: false; error: { code?: string; message?: string }; meta?: { correlationId?: string } }

export class VisionClientError extends Error {
  constructor(message: string, public readonly code = "VISION_REQUEST_FAILED", public readonly correlationId?: string) {
    super(message)
    this.name = "VisionClientError"
  }
}

export class VisionClient {
  private readonly request: typeof fetch

  constructor(
    private readonly basePath = "/api/vision",
    request?: typeof fetch,
  ) {
    this.request = request ?? ((input, init) => fetch(input, init))
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(`${this.basePath}${path}`, { ...init, cache: "no-store" })
    const body = (await response.json().catch(() => null)) as VisionEnvelope<T> | null
    if (!response.ok || !body?.ok) {
      const failure = body && !body.ok ? body : null
      throw new VisionClientError(failure?.error.message || `Vision request failed (${response.status}).`, failure?.error.code, failure?.meta?.correlationId)
    }
    return body.data
  }

  createProject(projectName: string) {
    return this.call<{ project: VisionProject }>("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectName }) })
  }

  upload(projectId: string, files: readonly File[]) {
    const body = new FormData()
    files.forEach((file) => body.append("files", file))
    return this.call<{ project: VisionProject; job: VisionJob }>("/uploads", { method: "POST", headers: { "x-project-id": projectId }, body })
  }

  process(jobId: string) {
    return this.call<{ project: VisionProject; job: VisionJob }>(`/jobs/${encodeURIComponent(jobId)}/process`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId }) })
  }

  getJob(jobId: string) {
    return this.call<{ project: VisionProject; job: VisionJob }>(`/jobs/${encodeURIComponent(jobId)}`)
  }
}
export class DriveClientError extends Error {
  constructor(message: string, public readonly code = "DRIVE_REQUEST_FAILED", public readonly correlationId?: string) {
    super(message)
    this.name = "DriveClientError"
  }
}

export class DriveClient {
  private readonly request: typeof fetch

  constructor(
    private readonly basePath = "/api/drive",
    request?: typeof fetch,
  ) {
    this.request = request ?? ((input, init) => fetch(input, init))
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(`${this.basePath}${path}`, { ...init, cache: "no-store" })
    const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
    if (!response.ok || !body?.ok) {
      const failure = body && !body.ok ? body : null
      throw new DriveClientError(
        failure?.error.message || `Drive request failed (${response.status}).`,
        failure?.error.code,
        failure?.meta.correlationId,
      )
    }
    return body.data
  }

  list(path = "/") {
    return this.call<DirectoryListing>(`/files?path=${encodeURIComponent(path)}`)
  }

  recent() {
    return this.call<DriveRecentListing>("/recent")
  }

  logAccess(path: string, action: "view" | "modify" = "view") {
    return this.call<{ logged: true }>("/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, action }),
    })
  }

  upload(path: string, files: readonly File[]) {
    const body = new FormData()
    body.append("path", path)
    files.forEach((file) => body.append("files", file))
    return this.call<DriveUploadResult>("/upload", { method: "POST", body })
  }

  previewUrl(path: string) {
    return `${this.basePath}/preview?path=${encodeURIComponent(path)}`
  }

  downloadUrl(path: string, folder = false) {
    return `${this.basePath}/download?path=${encodeURIComponent(path)}${folder ? "&type=folder" : ""}`
  }
}
