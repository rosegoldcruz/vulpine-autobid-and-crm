import type {
  ApiResponse,
  DirectoryListing,
  DriveRecentListing,
  DriveUploadTicket,
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
  constructor(message: string, public readonly code = "DRIVE_REQUEST_FAILED", public readonly correlationId?: string, public readonly uploaded = 0) {
    super(message)
    this.name = "DriveClientError"
  }
}

export type DriveTransferProgress = { sentBytes: number; totalBytes: number; phase: "sending" | "saving"; batchFiles: number }

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

  deleteItem(path: string, folder = false) {
    return this.call<{ deleted: true }>(`/files?path=${encodeURIComponent(path)}${folder ? "&type=folder" : ""}`, { method: "DELETE" })
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

  async upload(path: string, files: readonly File[], onProgress?: (uploaded: number, total: number) => void, onTransfer?: (progress: DriveTransferProgress) => void) {
    const maxBytes = 250 * 1024 * 1024
    let uploaded = 0
    let sentBytes = 0
    const totalBytes = files.reduce((total, file) => total + file.size, 0)
    onProgress?.(0, files.length)
    for (let index = 0; index < files.length;) {
      const batch: File[] = []
      let bytes = 0
      while (index < files.length && batch.length < 100 && (batch.length === 0 || bytes + files[index].size <= maxBytes)) {
        bytes += files[index].size
        batch.push(files[index++])
      }
      try {
        const transfer = await this.call<DriveUploadTicket>("/upload-ticket", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }),
        })
        const body = new FormData()
        body.append("path", path)
        if (batch.some(file => file.webkitRelativePath)) body.append("paths", JSON.stringify(batch.map(file => file.webkitRelativePath || file.name)))
        batch.forEach(file => body.append("files", file))
        const report = (loaded: number, phase: "sending" | "saving") => onTransfer?.({ sentBytes: sentBytes + loaded, totalBytes, phase, batchFiles: batch.length })
        report(0, "sending")
        const response = onTransfer && typeof XMLHttpRequest !== "undefined"
          ? await new Promise<Response>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", transfer.uploadUrl)
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) report(Math.min(bytes, bytes * event.loaded / event.total), "sending")
            }
            xhr.upload.onload = () => report(bytes, "saving")
            xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }))
            xhr.onerror = () => reject(new Error("Upload connection failed. Resume to retry the remaining files."))
            xhr.onabort = () => reject(new Error("Upload interrupted. Resume to retry the remaining files."))
            xhr.send(body)
          })
          : await this.request(transfer.uploadUrl, { method: "POST", body, cache: "no-store" })
        const result = (await response.json().catch(() => null)) as DriveUploadResult | { error?: { message?: string } } | null
        if (!response.ok || !result || !("uploaded" in result)) {
          if (result && "uploaded" in result && Number.isInteger(result.uploaded) && result.uploaded > 0 && result.uploaded <= batch.length) {
            uploaded += result.uploaded
            onProgress?.(uploaded, files.length)
          }
          throw new Error(result && "error" in result ? result.error?.message || "Drive upload failed." : "Drive upload failed.")
        }
        sentBytes += bytes
        uploaded += result.uploaded
        onProgress?.(uploaded, files.length)
      } catch (error) {
        throw new DriveClientError(`${uploaded ? `${uploaded} of ${files.length} files uploaded before the error. ` : ""}${error instanceof Error ? error.message : "Drive upload failed."}`, "DRIVE_UPLOAD_FAILED", undefined, uploaded)
      }
    }
    return { uploaded }
  }

  previewUrl(path: string) {
    return `${this.basePath}/preview?path=${encodeURIComponent(path)}`
  }

  downloadUrl(path: string, folder = false) {
    return `${this.basePath}/download?path=${encodeURIComponent(path)}${folder ? "&type=folder" : ""}`
  }
}
