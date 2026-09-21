"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Upload,
  Wrench,
} from "lucide-react"
import apiClient from "@/lib/api-client"

const CARD_SHADOW =
  "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"

const SECTION_MIN_H = "min-h-[calc(100vh-4.5rem)]"

type CabinetBidJobStatus =
  | "created"
  | "cabinet_workbook_uploaded"
  | "cabinet_plans_uploaded"
  | "cabinet_workbook_ingestion_failed"
  | "cabinet_plan_ingestion_failed"
  | "cabinet_processing_error"

type CabinetBidJob = {
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

type CabinetBidFile = {
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

type CabinetJobDetail = {
  job: CabinetBidJob
  files: CabinetBidFile[]
}

type CreateJobForm = {
  name: string
  customer_name: string
  project_name: string
  project_address: string
  cabinet_scope_type: string
  pricing_source_type: string
  pricing_source_file: string
  pricing_source_hash: string
  pricing_source_version: string
}

const emptyForm: CreateJobForm = {
  name: "",
  customer_name: "",
  project_name: "",
  project_address: "",
  cabinet_scope_type: "",
  pricing_source_type: "",
  pricing_source_file: "",
  pricing_source_hash: "",
  pricing_source_version: "",
}

const statusLabels: Record<CabinetBidJobStatus, string> = {
  created: "Created",
  cabinet_workbook_uploaded: "Workbook Uploaded",
  cabinet_plans_uploaded: "Plans Uploaded",
  cabinet_workbook_ingestion_failed: "Workbook Upload Failed",
  cabinet_plan_ingestion_failed: "Plan Upload Failed",
  cabinet_processing_error: "Processing Error",
}

export function CabinetBidEngineSection() {
  const [jobs, setJobs] = useState<CabinetBidJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CabinetJobDetail | null>(null)
  const [form, setForm] = useState<CreateJobForm>(emptyForm)
  const [workbookFile, setWorkbookFile] = useState<File | null>(null)
  const [planFiles, setPlanFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingWorkbook, setUploadingWorkbook] = useState(false)
  const [uploadingPlans, setUploadingPlans] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedJob = useMemo(
    () => detail?.job || jobs.find((job) => job.id === selectedJobId) || null,
    [detail, jobs, selectedJobId],
  )

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ jobs: CabinetBidJob[] }>("/autobid/cabinet/jobs")
      setJobs(response.jobs)
      if (!selectedJobId && response.jobs.length > 0) {
        setSelectedJobId(response.jobs[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cabinet bid jobs")
    } finally {
      setLoading(false)
    }
  }, [selectedJobId])

  const loadDetail = useCallback(async (jobId: string) => {
    setError(null)
    try {
      const response = await apiClient.get<CabinetJobDetail>(`/autobid/cabinet/jobs/${jobId}`)
      setDetail(response)
      setJobs((current) => current.map((job) => (job.id === response.job.id ? response.job : job)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cabinet job detail")
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (selectedJobId) {
      loadDetail(selectedJobId)
    } else {
      setDetail(null)
    }
  }, [loadDetail, selectedJobId])

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await apiClient.post<{ job: CabinetBidJob }>("/autobid/cabinet/jobs", form)
      setJobs((current) => [response.job, ...current])
      setSelectedJobId(response.job.id)
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create cabinet bid job")
    } finally {
      setSaving(false)
    }
  }

  async function handleWorkbookUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedJob || !workbookFile) return
    setUploadingWorkbook(true)
    setError(null)
    try {
      const body = new FormData()
      body.append("file", workbookFile)
      const response = await apiClient.upload<CabinetJobDetail>(`/autobid/cabinet/jobs/${selectedJob.id}/workbook`, body)
      setDetail(response)
      setWorkbookFile(null)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload cabinet workbook")
    } finally {
      setUploadingWorkbook(false)
    }
  }

  async function handlePlansUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedJob || !planFiles || planFiles.length === 0) return
    setUploadingPlans(true)
    setError(null)
    try {
      const body = new FormData()
      Array.from(planFiles).forEach((file) => body.append("files", file))
      const response = await apiClient.upload<CabinetJobDetail>(`/autobid/cabinet/jobs/${selectedJob.id}/plans`, body)
      setDetail(response)
      setPlanFiles(null)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload cabinet plan PDFs")
    } finally {
      setUploadingPlans(false)
    }
  }

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl surface-card p-5 lg:p-7 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="absolute w-64 h-64 -top-32 -right-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center glow-teal-sm shrink-0">
                <Wrench className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground font-display tracking-tight">Cabinet Bid Engine</h2>
                <p className="text-[11px] text-muted-foreground font-sans">Phase 1 cabinet job and source file foundation</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-2xl">
              Create persisted cabinet bid jobs, attach cabinet workbook files, attach cabinet plan PDFs, and preserve upload metadata with SHA256 hashes. This phase intentionally contains no takeoff, pricing, AI, exports, or bid totals.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 max-w-md">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-muted-foreground font-sans">
                No number is a cabinet bid until unit repetition is applied and QA has passed.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-2xl border border-fin-loss/30 bg-fin-loss/[0.05] p-4 flex items-start gap-3">
          <ShieldAlert className="size-4 text-fin-loss mt-0.5 shrink-0" />
          <p className="text-xs text-fin-loss/90 font-sans leading-relaxed">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[24rem_minmax(0,1fr)] gap-5">
        <div className="flex flex-col gap-5">
          <Panel title="Create Cabinet Bid Job" subtitle="Persist a cabinet-only job before uploading source files.">
            <form className="flex flex-col gap-3" onSubmit={handleCreateJob}>
              <TextField label="Job name" value={form.name} required onChange={(value) => setForm({ ...form, name: value })} />
              <TextField label="Customer name" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} />
              <TextField label="Project name" value={form.project_name} onChange={(value) => setForm({ ...form, project_name: value })} />
              <TextField label="Project address" value={form.project_address} onChange={(value) => setForm({ ...form, project_address: value })} />
              <TextField label="Cabinet scope type" value={form.cabinet_scope_type} onChange={(value) => setForm({ ...form, cabinet_scope_type: value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Pricing source type" value={form.pricing_source_type} onChange={(value) => setForm({ ...form, pricing_source_type: value })} />
                <TextField label="Pricing source version" value={form.pricing_source_version} onChange={(value) => setForm({ ...form, pricing_source_version: value })} />
              </div>
              <TextField label="Pricing source file" value={form.pricing_source_file} onChange={(value) => setForm({ ...form, pricing_source_file: value })} />
              <TextField label="Pricing source hash" value={form.pricing_source_hash} onChange={(value) => setForm({ ...form, pricing_source_hash: value })} />
              <button
                type="submit"
                disabled={saving}
                className="mt-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold font-sans flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create Cabinet Bid Job
              </button>
            </form>
          </Panel>

          <Panel
            title="Persisted Cabinet Jobs"
            subtitle="Loaded from the Cabinet Bid Engine backend."
            action={
              <button onClick={loadJobs} className="p-2 rounded-lg hover:bg-accent/50 transition-colors" aria-label="Refresh cabinet jobs">
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            }
          >
            {jobs.length === 0 && !loading ? (
              <div className="rounded-xl border border-border/40 bg-muted/15 p-5 text-center">
                <FolderOpen className="size-8 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground font-display">No cabinet bid jobs created yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selectedJobId === job.id
                        ? "border-primary/40 bg-primary/[0.06]"
                        : "border-border/40 bg-muted/10 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-foreground font-display">{job.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">{job.project_name || job.customer_name || "Cabinet job"}</p>
                      </div>
                      <SafeBadge safe={job.safe_to_send} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={job.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {selectedJob ? (
            <>
              <Panel title="Cabinet Job Detail" subtitle="Source-file foundation only. No takeoff or pricing is calculated.">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <DetailItem label="Job" value={selectedJob.name} />
                  <DetailItem label="Customer" value={selectedJob.customer_name || "Not set"} />
                  <DetailItem label="Project" value={selectedJob.project_name || "Not set"} />
                  <DetailItem label="Address" value={selectedJob.project_address || "Not set"} />
                  <DetailItem label="Cabinet scope" value={selectedJob.cabinet_scope_type || "Cabinets only"} />
                  <DetailItem label="Pricing source type" value={selectedJob.pricing_source_type || "Not set"} />
                  <DetailItem label="Pricing source file" value={selectedJob.pricing_source_file || "Not set"} />
                  <DetailItem label="Pricing source hash" value={selectedJob.pricing_source_hash || "Not set"} />
                  <DetailItem label="Pricing source version" value={selectedJob.pricing_source_version || "Not set"} />
                  <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans font-bold mb-2">Current gates</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={selectedJob.status} />
                      <SafeBadge safe={selectedJob.safe_to_send} />
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Panel title="Cabinet Workbook Upload" subtitle="Allowed: .xlsx or .csv, max 50 MB.">
                  <form className="flex flex-col gap-4" onSubmit={handleWorkbookUpload}>
                    <FilePicker
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      icon={FileSpreadsheet}
                      label={workbookFile?.name || "Choose cabinet workbook"}
                      onChange={(files) => setWorkbookFile(files?.[0] || null)}
                    />
                    <button disabled={!workbookFile || uploadingWorkbook} className="h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold font-sans flex items-center justify-center gap-2 disabled:opacity-60">
                      {uploadingWorkbook ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      Upload Cabinet Workbook
                    </button>
                  </form>
                </Panel>

                <Panel title="Cabinet Plan PDF Upload" subtitle="Allowed: PDFs only, max 250 MB each, 2 GB batch, 100 files.">
                  <form className="flex flex-col gap-4" onSubmit={handlePlansUpload}>
                    <FilePicker
                      multiple
                      accept=".pdf,application/pdf"
                      icon={FileText}
                      label={planFiles?.length ? `${planFiles.length} cabinet plan PDF(s) selected` : "Choose cabinet plan PDFs"}
                      onChange={setPlanFiles}
                    />
                    <button disabled={!planFiles?.length || uploadingPlans} className="h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold font-sans flex items-center justify-center gap-2 disabled:opacity-60">
                      {uploadingPlans ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      Upload Cabinet Plan PDFs
                    </button>
                  </form>
                </Panel>
              </div>

              <Panel title="Uploaded Cabinet Files" subtitle="Metadata persisted by the backend with SHA256 hashes.">
                <FilesTable files={detail?.files || []} />
              </Panel>
            </>
          ) : (
            <Panel title="Cabinet Job Detail" subtitle="Create or select a cabinet bid job to upload source files.">
              <div className="rounded-xl border border-border/40 bg-muted/15 p-8 text-center">
                <FolderOpen className="size-9 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground font-display">No cabinet bid job selected.</p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl surface-card p-5 lg:p-6"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight font-display">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

function TextField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans font-bold">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-border/50 bg-muted/10 px-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
    </label>
  )
}

function StatusBadge({ status }: { status: CabinetBidJobStatus }) {
  const isError = status.includes("failed") || status.includes("error")
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] font-mono ${
      isError
        ? "border-fin-loss/30 bg-fin-loss/[0.08] text-fin-loss"
        : "border-primary/20 bg-primary/[0.08] text-primary"
    }`}
    >
      {isError ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}
      {statusLabels[status] || status}
    </span>
  )
}

function SafeBadge({ safe }: { safe: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] font-mono ${
      safe
        ? "border-fin-gain/30 bg-fin-gain/[0.08] text-fin-gain"
        : "border-amber-500/30 bg-amber-500/[0.08] text-amber-400"
    }`}
    >
      {safe ? "safe_to_send=true" : "safe_to_send=false"}
    </span>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans font-bold">{label}</p>
      <p className="text-xs text-foreground font-sans mt-1 break-words">{value}</p>
    </div>
  )
}

function FilePicker({ accept, label, icon: Icon, multiple, onChange }: { accept: string; label: string; icon: React.ElementType; multiple?: boolean; onChange: (files: FileList | null) => void }) {
  return (
    <label className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors">
      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground font-display truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground font-sans mt-0.5">Cabinet source files only</p>
      </div>
      <input className="hidden" type="file" accept={accept} multiple={multiple} onChange={(event) => onChange(event.target.files)} />
    </label>
  )
}

function FilesTable({ files }: { files: CabinetBidFile[] }) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/15 p-8 text-center">
        <FileText className="size-9 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm font-bold text-foreground font-display">No cabinet files uploaded yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <table className="w-full min-w-[760px] text-left">
        <thead className="bg-muted/20 border-b border-border/40">
          <tr>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">Type</th>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">Filename</th>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">MIME</th>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">Size</th>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">SHA256</th>
            <th className="px-3 py-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-sans">Status</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-border/30 last:border-0">
              <td className="px-3 py-3 text-xs text-foreground font-sans">{file.file_type === "cabinet_workbook" ? "Workbook" : "Plan PDF"}</td>
              <td className="px-3 py-3 text-xs text-foreground font-sans">{file.original_filename}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{file.mime_type}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{formatBytes(file.size_bytes)}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground font-mono max-w-[16rem] truncate">{file.sha256_hash}</td>
              <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{file.upload_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
