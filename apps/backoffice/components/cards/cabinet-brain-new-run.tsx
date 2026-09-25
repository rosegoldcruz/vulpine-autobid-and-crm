"use client"

import { useRef, useState } from "react"
import { AlertTriangle, ArrowRight, Building2, Check, FileCheck2, FileSpreadsheet, FileText, FolderPlus, Loader2, LockKeyhole, PackageCheck, ShieldCheck, UploadCloud, X } from "lucide-react"
import { toast } from "sonner"
import { VisionClient, type VisionJob, type VisionProject } from "@vulpine/sdk"

const client = new VisionClient()
type OutputMode = "takeoff" | "workbook" | "priced"

type Props = {
  onReady: (project: VisionProject, job: VisionJob | null) => void
}

const permittedWrites = ["Summary package name", "Summary package quantity", "Unit/package sheets SKU column", "Unit/package sheets quantity column"]
const lockedFields = ["Workbook formulas", "Workbook formatting", "Hidden catalog sheets", "Hardware pricing", "Assembly pricing", "Freight", "Tax", "Margin", "Dealer factor"]

function ModeCard({ id, active, title, description, locked, onSelect }: { id: OutputMode; active: boolean; title: string; description: string; locked?: boolean; onSelect: (id: OutputMode) => void }) {
  return (
    <button type="button" onClick={() => locked ? toast.warning("Full Priced Bid remains protected", { description: "Pricing authorization and server-side execution contracts must exist before this mode can run." }) : onSelect(id)} className={`relative min-h-28 rounded-xl border p-4 text-left transition sm:min-h-40 ${active ? "border-primary bg-primary/[0.09] shadow-[0_0_0_1px_rgba(45,212,191,.15)]" : "border-border/80 bg-background/25 hover:border-border"}`} aria-pressed={active}>
      <span className={`mb-3 flex size-9 items-center justify-center rounded-lg border sm:mb-4 sm:size-10 ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted-foreground"}`}>{id === "takeoff" ? <FileText className="size-5" /> : id === "workbook" ? <FileSpreadsheet className="size-5" /> : <PackageCheck className="size-5" />}</span>
      <span className="block text-sm font-black text-foreground">{title}</span>
      <span className="mt-1.5 block text-[10px] leading-4 text-muted-foreground">{description}</span>
      {locked ? <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[9px] font-black text-amber-300"><LockKeyhole className="size-3" /> Requires authorization</span> : <span className={`absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>{active ? <Check className="size-3" /> : null}</span>}
    </button>
  )
}

export function CabinetBrainNewRun({ onReady }: Props) {
  const [projectName, setProjectName] = useState("New cabinet opportunity")
  const [drawingRevision, setDrawingRevision] = useState("Current issued set")
  const [productLine, setProductLine] = useState("Select after catalog ingestion")
  const [scope, setScope] = useState("Cabinetry and cabinet accessories")
  const [mode, setMode] = useState<OutputMode>("workbook")
  const [project, setProject] = useState<VisionProject | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function createProject() {
    setBusy("create")
    setError(null)
    const id = toast.loading("Creating Cabinet Brain project…")
    try {
      const result = await client.createProject(projectName.trim())
      setProject(result.project)
      toast.success("Project created", { id, description: "The authoritative Vision project exists. Add the plans and workbook to continue." })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Project creation failed."
      setError(message)
      toast.error("Project creation failed", { id, description: message })
    } finally { setBusy(null) }
  }

  async function uploadAndProcess() {
    if (!project || files.length === 0) return
    setBusy("upload")
    setError(null)
    const id = toast.loading(`Adding ${files.length} source file${files.length === 1 ? "" : "s"}…`)
    try {
      const uploaded = await client.upload(project.projectId, files)
      setProject(uploaded.project)
      toast.loading("Running deterministic document discovery…", { id })
      const processed = await client.process(uploaded.job.id)
      toast.success("Discovery complete", { id, description: `${processed.job.classifiedPages.length} pages classified. Estimator intelligence remains server-gated.` })
      onReady(processed.project, processed.job)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Source processing failed."
      setError(message)
      toast.error("Source processing failed", { id, description: message })
    } finally { setBusy(null) }
  }

  const hasPdf = files.some((file) => file.name.toLowerCase().endsWith(".pdf"))
  const hasWorkbook = files.some((file) => /\.(xlsx|csv)$/i.test(file.name))

  return (
    <section className="min-h-[calc(100dvh-4rem)] bg-[#0d151c] px-4 pb-28 pt-6 text-foreground sm:px-6 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">New Cabinet Brain Run</h1><p className="mt-1 text-sm text-muted-foreground">Set project identity, source files, output mode, and mutation boundaries before analysis begins.</p></div>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2" aria-label="Run setup progress">
          {["Identity", "Sources", "Execution Contract", "Confirm"].map((label, index) => <div key={label} className="flex items-center gap-2"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${index === 0 ? "border-primary bg-primary text-primary-foreground" : project && index === 1 ? "border-sky-400 bg-sky-400/10 text-sky-300" : "border-slate-600 text-muted-foreground"}`}>{index + 1}</span><span className="hidden text-[10px] font-bold text-muted-foreground sm:block">{label}</span>{index < 3 ? <span className="ml-auto hidden h-px flex-1 bg-slate-700 md:block" /> : null}</div>)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-700/70 bg-[#111b24] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border border-slate-700 bg-background/30"><Building2 className="size-5" /></span><div><h2 className="text-base font-black">Project Identity</h2><p className="text-[10px] text-muted-foreground">Define what is being analyzed and which product configuration applies.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-[10px] font-bold text-muted-foreground"><span>Project *</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} disabled={Boolean(project)} className="h-12 w-full rounded-lg border border-slate-700 bg-background/35 px-3 text-base font-semibold text-foreground outline-none focus:border-primary/60 disabled:opacity-60 sm:text-xs" /></label>
                <label className="space-y-1.5 text-[10px] font-bold text-muted-foreground"><span>Drawing revision *</span><input value={drawingRevision} onChange={(event) => setDrawingRevision(event.target.value)} className="h-12 w-full rounded-lg border border-slate-700 bg-background/35 px-3 text-base font-semibold text-foreground outline-none focus:border-primary/60 sm:text-xs" /></label>
                <label className="space-y-1.5 text-[10px] font-bold text-muted-foreground"><span>Product line</span><input value={productLine} onChange={(event) => setProductLine(event.target.value)} className="h-12 w-full rounded-lg border border-slate-700 bg-background/35 px-3 text-base font-semibold text-foreground outline-none focus:border-primary/60 sm:text-xs" /></label>
                <label className="space-y-1.5 text-[10px] font-bold text-muted-foreground"><span>Scope *</span><input value={scope} onChange={(event) => setScope(event.target.value)} className="h-12 w-full rounded-lg border border-slate-700 bg-background/35 px-3 text-base font-semibold text-foreground outline-none focus:border-primary/60 sm:text-xs" /></label>
              </div>
              {!project ? <button type="button" onClick={() => void createProject()} disabled={!projectName.trim() || busy !== null} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-40">{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />} Create authoritative project</button> : <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-3 text-[10px] font-bold text-emerald-300"><Check className="size-4" /> Project created · {project.projectId}</div>}
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-[#111b24] p-5 sm:p-6">
              <h2 className="text-base font-black">Output Mode</h2><p className="mt-1 text-[10px] text-muted-foreground">Choose what Cabinet Brain may produce for this run.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><ModeCard id="takeoff" active={mode === "takeoff"} title="Cabinet Takeoff Only" description="Extract and organize cabinet takeoffs. No workbook changes." onSelect={setMode} /><ModeCard id="workbook" active={mode === "workbook"} title="Populate Workbook" description="Write approved takeoff fields to a fresh workbook copy." onSelect={setMode} /><ModeCard id="priced" active={mode === "priced"} title="Full Priced Bid" description="Pricing and commercial controls remain server-protected." locked onSelect={setMode} /></div>
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-[#111b24] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-black">Sources</h2><p className="mt-1 text-[10px] text-muted-foreground">PDF plans plus the approved XLSX or CSV cabinet workbook.</p></div><UploadCloud className="size-5 text-primary" /></div>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!project || busy !== null} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-background/20 px-4 transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40"><UploadCloud className="mb-2 size-5 text-primary" /><span className="text-xs font-black">Choose source files</span><span className="mt-1 text-[10px] text-muted-foreground">PDF, ZIP, XLSX, CSV</span></button>
              <input ref={inputRef} type="file" multiple accept=".pdf,.zip,.xlsx,.csv" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              {files.length ? <div className="mt-3 space-y-1">{files.map((file) => <div key={`${file.name}-${file.size}`} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-700 bg-background/25 px-3"><span className="flex size-7 items-center justify-center rounded bg-slate-700/50">{file.name.toLowerCase().endsWith(".pdf") ? <FileText className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}</span><span className="min-w-0 flex-1 truncate text-[10px] font-bold">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} className="flex size-9 items-center justify-center" aria-label={`Remove ${file.name}`}><X className="size-3.5" /></button></div>)}</div> : null}
              <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]"><div className={`rounded-lg border p-3 ${hasPdf ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300" : "border-slate-700 text-muted-foreground"}`}>{hasPdf ? <Check className="mb-1 size-4" /> : <FileText className="mb-1 size-4" />} Plan PDF</div><div className={`rounded-lg border p-3 ${hasWorkbook ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300" : "border-slate-700 text-muted-foreground"}`}>{hasWorkbook ? <Check className="mb-1 size-4" /> : <FileSpreadsheet className="mb-1 size-4" />} Workbook</div></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-[#111b24] p-5 sm:p-6 xl:sticky xl:top-5 xl:self-start">
            <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border border-slate-700 bg-background/30"><ShieldCheck className="size-5" /></span><div><h2 className="text-base font-black">Execution Contract</h2><p className="text-[10px] text-muted-foreground">Strict controls protect pricing and workbook integrity.</p></div></div>
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300"><Check className="size-5" /> Permitted writes</div><div className="space-y-2">{permittedWrites.map((item) => <div key={item} className="flex items-center gap-2 text-[10px] text-emerald-100/85"><Check className="size-3.5 shrink-0 text-emerald-300" /> {item}</div>)}</div></div>
            <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-rose-300"><LockKeyhole className="size-5" /> Locked fields</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{lockedFields.map((item) => <div key={item} className="flex items-center gap-2 text-[10px] text-rose-100/80"><LockKeyhole className="size-3.5 shrink-0 text-rose-300" /> {item}</div>)}</div></div>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-[10px] leading-4 text-amber-100/80"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" /><p><strong className="text-amber-200">Server boundary:</strong> the current Vision API does not persist execution contracts or compile workbooks. This UI will not claim those controls are locked server-side until the corresponding API exists.</p></div>
            {error ? <div role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-[10px] leading-4 text-rose-200">{error}</div> : null}
            <button type="button" onClick={() => void uploadAndProcess()} disabled={!project || files.length === 0 || busy !== null} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-40">{busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Discover sources <ArrowRight className="size-4" /></button>
            <p className="mt-3 text-center text-[9px] leading-4 text-muted-foreground">Discovery uses the existing authenticated Vision API. Takeoff, SKU, pricing, compilation, and release operations remain blocked until authoritative services are implemented.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
