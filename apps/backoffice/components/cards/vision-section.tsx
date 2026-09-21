"use client"

import { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UploadCloud,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { VisionClient, type VisionJob, type VisionProject } from "@vulpine/sdk"

const client = new VisionClient()

function Metric({ label, value, detail, icon: Icon, tone = "teal" }: {
  label: string
  value: string
  detail: string
  icon: React.ElementType
  tone?: "teal" | "blue" | "amber" | "rose"
}) {
  const colors = {
    teal: "border-primary/20 bg-primary/10 text-primary",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  }
  return (
    <article className="surface-card relative overflow-hidden rounded-2xl border border-border/60 p-4 shadow-[0_18px_48px_rgba(0,0,0,.12)]">
      <div className="absolute -right-8 -top-8 size-24 rounded-full bg-primary/[0.04] blur-2xl" />
      <div className={`mb-4 flex size-9 items-center justify-center rounded-xl border ${colors[tone]}`}><Icon className="size-4" /></div>
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </article>
  )
}

function ActionButton({ children, onClick, disabled, secondary = false }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={secondary
        ? "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/40 px-4 text-xs font-bold text-foreground transition hover:border-primary/35 hover:bg-primary/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        : "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground shadow-[0_0_28px_rgba(45,212,191,.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"}
    >{children}</button>
  )
}

function EmptyWorkspace() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/20 px-6 text-center">
      <div className="relative mb-5 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
        <ScanLine className="size-7 text-primary" />
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-card bg-primary" />
      </div>
      <h3 className="font-display text-base font-black text-foreground">Ready for a plan set</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Create a project, then add the PDF plans and an XLSX or CSV cabinet workbook. Vision preserves source traceability and stops before estimator judgment.</p>
    </div>
  )
}

export function VisionSection() {
  const [projectName, setProjectName] = useState("New cabinet opportunity")
  const [project, setProject] = useState<VisionProject | null>(null)
  const [job, setJob] = useState<VisionJob | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const totals = useMemo(() => ({
    files: project?.files.length ?? 0,
    pdfs: project?.pdfFiles.length ?? 0,
    workbooks: project?.workbookFiles.length ?? 0,
    pages: project?.pageCount ?? 0,
  }), [project])

  async function run<T>(key: string, loading: string, success: string, work: () => Promise<T>, apply: (value: T) => void) {
    setBusy(key)
    setError(null)
    const id = toast.loading(loading)
    try {
      const result = await work()
      apply(result)
      toast.success(success, { id, description: "Vision state and source traceability are up to date." })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Vision operation failed."
      setError(message)
      toast.error(`${success} failed`, { id, description: message })
    } finally {
      setBusy(null)
    }
  }

  function createProject() {
    void run("create", "Creating Vision project…", "Project created", () => client.createProject(projectName), ({ project: value }) => {
      setProject(value)
      setJob(null)
      setFiles([])
    })
  }

  function upload() {
    if (!project || !files.length) return
    void run("upload", `Uploading ${files.length} source file${files.length === 1 ? "" : "s"}…`, "Files added", () => client.upload(project.projectId, files), (value) => {
      setProject(value.project)
      setJob(value.job)
      setFiles([])
      if (inputRef.current) inputRef.current.value = ""
    })
  }

  function process() {
    if (!job) return
    void run("process", "Running deterministic document pass…", "Document pass complete", () => client.process(job.id), (value) => {
      setProject(value.project)
      setJob(value.job)
    })
  }

  function refresh() {
    if (!job) return
    void run("refresh", "Refreshing workflow state…", "Workflow refreshed", () => client.getJob(job.id), (value) => {
      setProject(value.project)
      setJob(value.job)
    })
  }

  function reset() {
    setProject(null)
    setJob(null)
    setFiles([])
    setError(null)
    setProjectName("New cabinet opportunity")
    if (inputRef.current) inputRef.current.value = ""
    toast.info("Vision workspace reset", { description: "Local selections were cleared; no source records were deleted." })
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] space-y-5 pb-10">
      <Toaster richColors position="top-right" theme="dark" closeButton />

      <header className="surface-card relative overflow-hidden rounded-2xl border border-border/60 px-5 py-5 lg:px-7">
        <div className="absolute -right-16 -top-24 size-64 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[0_0_32px_rgba(45,212,191,.12)]"><ScanLine className="size-6 text-primary" /></div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-black tracking-tight text-foreground">Vision Intake</h1>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-primary">Native module</span>
              </div>
              <p className="max-w-2xl text-xs leading-5 text-muted-foreground">Traceable plan and workbook ingestion for cabinet opportunities. Deterministic evidence comes in; estimator intelligence stays locked down.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton secondary onClick={reset}><RotateCcw className="size-3.5" /> Reset</ActionButton>
            <ActionButton secondary onClick={refresh} disabled={!job || busy !== null}>{busy === "refresh" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Refresh</ActionButton>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Source files" value={`${totals.files}`} detail="Checksummed and traceable" icon={FileArchive} />
        <Metric label="Plan PDFs" value={`${totals.pdfs}`} detail={`${totals.pages} page${totals.pages === 1 ? "" : "s"} indexed`} icon={FileText} tone="blue" />
        <Metric label="Workbooks" value={`${totals.workbooks}`} detail="XLSX and CSV evidence" icon={FileSpreadsheet} tone="amber" />
        <Metric label="Safe to send" value={job?.qaResult.safeToSend ? "YES" : "NO"} detail="Hard-blocked during quarantine" icon={LockKeyhole} tone="rose" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="surface-card rounded-2xl border border-border/60 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="font-display text-sm font-black text-foreground">Ingestion control</h2><p className="mt-1 text-[10px] text-muted-foreground">Create · upload · process</p></div>
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"><UploadCloud className="size-4 text-primary" /></div>
          </div>

          <label className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Project name</label>
          <div className="mt-2 flex gap-2">
            <input aria-label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} disabled={Boolean(project)} className="h-10 min-w-0 flex-1 rounded-xl border border-border/80 bg-background/50 px-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 disabled:opacity-55" />
            <ActionButton onClick={createProject} disabled={!projectName.trim() || Boolean(project) || busy !== null}>{busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <FolderPlus className="size-3.5" />} Create</ActionButton>
          </div>

          <button type="button" onClick={() => inputRef.current?.click()} disabled={!project || busy !== null} className="mt-5 flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-background/25 px-4 text-center transition hover:border-primary/40 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-40">
            <UploadCloud className="mb-2 size-5 text-primary" />
            <span className="text-xs font-bold text-foreground">Choose evidence files</span>
            <span className="mt-1 text-[10px] text-muted-foreground">PDF, ZIP, XLSX, CSV · no legacy XLS</span>
          </button>
          <input ref={inputRef} type="file" multiple accept=".pdf,.zip,.xlsx,.csv" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          {files.length > 0 && <div className="mt-3 rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-[10px] text-muted-foreground"><strong className="text-foreground">{files.length} selected:</strong> {files.map((file) => file.name).join(", ")}</div>}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ActionButton secondary onClick={upload} disabled={!project || !files.length || busy !== null}>{busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />} Add files</ActionButton>
            <ActionButton onClick={process} disabled={!job || job.state !== "files_ingested" || busy !== null}>{busy === "process" ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />} Process</ActionButton>
          </div>

          {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-[11px] leading-4 text-rose-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
        </section>

        <section className="surface-card rounded-2xl border border-border/60 p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-display text-sm font-black text-foreground">Workflow evidence</h2><p className="mt-1 text-[10px] text-muted-foreground">Project and job state from the Vision service</p></div>
            <div className="flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-rose-300"><LockKeyhole className="size-3" /> Estimator quarantined</div>
          </div>

          {!project ? <EmptyWorkspace /> : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Project</p>
                  <p className="mt-2 truncate text-sm font-black text-foreground">{project.projectName}</p>
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{project.projectId}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">Workflow state</p>
                  <p className="mt-2 text-sm font-black text-primary">{job?.state.replaceAll("_", " ") ?? project.processingStatus}</p>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">{job?.id ?? "Awaiting upload"}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70">
                <div className="grid grid-cols-[minmax(0,1fr)_80px_90px] border-b border-border/70 bg-background/40 px-4 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><span>Document</span><span>Type</span><span className="text-right">Bytes</span></div>
                {project.files.length ? project.files.map((file) => (
                  <div key={file.id} className="grid grid-cols-[minmax(0,1fr)_80px_90px] items-center border-b border-border/40 px-4 py-3 text-[11px] last:border-b-0">
                    <span className="truncate font-medium text-foreground">{file.name}</span>
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">{file.name.split(".").pop()}</span>
                    <span className="text-right font-mono text-[9px] text-muted-foreground">{file.size.toLocaleString()}</span>
                  </div>
                )) : <div className="px-4 py-8 text-center text-xs text-muted-foreground">No files added yet.</div>}
              </div>

              {job && <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
                  <div className="mb-3 flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h3 className="text-xs font-black text-foreground">QA gate</h3></div>
                  <div className="space-y-2">{job.qaResult.criticalIssues.slice(0, 4).map((issue) => <div key={issue.code} className="flex gap-2 text-[10px] leading-4 text-muted-foreground"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-300" /><span><strong className="text-foreground">{issue.code}</strong> · {issue.message}</span></div>)}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/25 p-4">
                  <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="size-4 text-sky-300" /><h3 className="text-xs font-black text-foreground">Classified evidence</h3></div>
                  <p className="text-3xl font-black text-foreground">{job.classifiedPages.length}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Page classifications are labeled as deterministic, unverified signals. They never produce pricing.</p>
                </div>
              </div>}
            </div>
          )}
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-[10px] leading-4 text-amber-100/80">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <p><strong className="text-amber-200">Safety boundary:</strong> this module cannot approve unit mix, generate takeoff, resolve SKUs, calculate pricing, export a bid, or mark anything safe to send. Those operations return <span className="font-mono text-amber-200">ESTIMATOR_INTELLIGENCE_DISABLED</span>.</p>
      </div>
    </div>
  )
}
