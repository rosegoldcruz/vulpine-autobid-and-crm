"use client"

import { useDeferredValue, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  FileText,
  Filter,
  Layers3,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import type { VisionJob, VisionProject } from "@vulpine/sdk"
import { CabinetElevation } from "./cabinet-elevation"
import {
  SAMPLE_FINDINGS,
  SAMPLE_SHEETS,
  SHEET_GROUPS,
  type CabinetFinding,
  type PlanSheet,
  type ReviewState,
  type SheetGroup,
} from "./cabinet-brain-data"

type LayerKey = "evidence" | "dimensions" | "skus" | "exceptions"

type CabinetBrainPlanRoomProps = {
  project: VisionProject | null
  job: VisionJob | null
  demo: boolean
  onOpenNewRun: () => void
  onUseDemo: () => void
}

const classificationGroup: Record<string, SheetGroup> = {
  FLOOR_PLAN: "Relevant",
  UNIT_MATRIX: "Relevant",
  UNIT_PLAN: "Unit Plans",
  CASEWORK_SCHEDULE: "Elevations",
  FINISH_SCHEDULE: "Schedules",
  UNKNOWN: "Ignored",
}

const workflow = ["Discover", "Inspect", "Resolve", "Review", "Compile", "QA"] as const

function pagesToSheets(job: VisionJob | null): PlanSheet[] {
  if (!job) return []
  return job.classifiedPages.map((page) => ({
    id: `${page.document}-${page.pageNumber}`,
    number: `P${String(page.pageNumber).padStart(3, "0")}`,
    title: page.classification.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
    group: classificationGroup[page.classification] ?? "Ignored",
    relevantCount: page.classification === "UNKNOWN" ? 0 : 1,
    pageNumber: page.pageNumber,
    document: page.document,
    classification: page.classification,
  }))
}

function LayerToggle({ active, label, tone = "teal", onClick }: { active: boolean; label: string; tone?: "teal" | "amber"; onClick: () => void }) {
  const activeClass = tone === "amber" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-primary/30 bg-primary/10 text-primary"
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-[11px] font-bold transition ${active ? activeClass : "border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"}`}>
      <span className={`relative h-5 w-9 rounded-full border transition ${active ? tone === "amber" ? "border-amber-300/50 bg-amber-400/25" : "border-primary/50 bg-primary/25" : "border-border bg-background/60"}`}>
        <span className={`absolute top-0.5 size-3.5 rounded-full bg-current transition-transform ${active ? "translate-x-[17px]" : "translate-x-0.5"}`} />
      </span>
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: ReviewState }) {
  const label = status === "verified" ? "Verified" : status === "custom" ? "Custom scope" : "Quick Review"
  const classes = status === "verified" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : status === "custom" ? "border-amber-400/25 bg-amber-400/10 text-amber-300" : "border-primary/25 bg-primary/10 text-primary"
  return <span className={`inline-flex min-h-8 items-center rounded-lg border px-2.5 text-[10px] font-black uppercase tracking-[.08em] ${classes}`}>{label}</span>
}

function SheetThumbnail({ sheet, selected, onClick }: { sheet: PlanSheet; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`grid min-h-[76px] w-full grid-cols-[68px_minmax(0,1fr)] items-center gap-3 border-l-2 px-3 py-2.5 text-left transition ${selected ? "border-l-sky-400 bg-sky-400/[0.08]" : "border-l-transparent hover:bg-white/[0.035]"}`}>
      <span className="relative flex h-14 items-center justify-center overflow-hidden border border-slate-500/30 bg-[#f3f4f2] text-slate-500">
        <span className="absolute inset-1 bg-[linear-gradient(90deg,transparent_48%,rgba(71,85,105,.2)_50%,transparent_52%),linear-gradient(transparent_48%,rgba(71,85,105,.2)_50%,transparent_52%)] bg-[size:9px_9px]" />
        <FileText className="relative size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-foreground">{sheet.number}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{sheet.title}</span>
        <span className={`mt-1 block text-[9px] font-bold ${sheet.relevantCount ? "text-primary" : "text-muted-foreground/60"}`}>{sheet.relevantCount} relevant</span>
      </span>
    </button>
  )
}

function EvidenceCard({ type, title, subtitle, selected }: { type: string; title: string; subtitle: string; selected?: boolean }) {
  return (
    <button type="button" className={`min-w-[190px] flex-1 rounded-lg border p-2 text-left transition hover:border-sky-400/40 ${selected ? "border-sky-400 bg-sky-400/[0.08]" : "border-border/70 bg-background/35"}`}>
      <span className="relative mb-2 flex h-16 overflow-hidden border border-slate-600/30 bg-[#f1f2f0]">
        <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(15,23,42,.22)_41%,transparent_42%),linear-gradient(transparent_54%,rgba(15,23,42,.18)_55%,transparent_56%)] bg-[size:25px_20px]" />
        <span className="absolute bottom-1 left-1 rounded bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-bold text-white">{type}</span>
      </span>
      <span className="block text-[10px] font-bold text-foreground">{title}</span>
      <span className="mt-0.5 block text-[9px] text-muted-foreground">{subtitle}</span>
    </button>
  )
}

function LiveEvidenceUnavailable({ sheet }: { sheet: PlanSheet | undefined }) {
  return (
    <div className="flex h-full min-h-[430px] items-center justify-center bg-[#f4f5f3] px-6 text-center text-slate-900">
      <div className="max-w-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-slate-300 bg-white shadow-sm"><FileSearch className="size-6 text-slate-600" /></div>
        <h3 className="mt-4 text-base font-black">Drawing preview is not available yet</h3>
        <p className="mt-2 text-xs leading-5 text-slate-600">The live Vision API classified {sheet ? `${sheet.document}, page ${sheet.pageNumber}` : "this source"}, but it does not yet expose rendered pages, regions, or cabinet detections. No evidence has been fabricated.</p>
        {sheet ? <dl className="mt-5 grid grid-cols-2 gap-2 text-left text-[10px]"><div className="rounded-lg border border-slate-200 bg-white p-3"><dt className="text-slate-500">Classification</dt><dd className="mt-1 font-bold">{sheet.classification}</dd></div><div className="rounded-lg border border-slate-200 bg-white p-3"><dt className="text-slate-500">Source page</dt><dd className="mt-1 font-bold">{sheet.pageNumber}</dd></div></dl> : null}
      </div>
    </div>
  )
}

export function CabinetBrainPlanRoom({ project, job, demo, onOpenNewRun, onUseDemo }: CabinetBrainPlanRoomProps) {
  const roomRef = useRef<HTMLElement>(null)
  const liveSheets = useMemo(() => pagesToSheets(job), [job])
  const sheets = useMemo(() => demo ? [...SAMPLE_SHEETS] : liveSheets, [demo, liveSheets])
  const [group, setGroup] = useState<SheetGroup>("Relevant")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [selectedSheetId, setSelectedSheetId] = useState(demo ? "a501" : sheets[0]?.id ?? "")
  const [selectedFindingId, setSelectedFindingId] = useState("sink-base-33")
  const [findings, setFindings] = useState<CabinetFinding[]>([...SAMPLE_FINDINGS])
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ evidence: true, dimensions: true, skus: true, exceptions: true })
  const [zoom, setZoom] = useState(100)

  const filteredSheets = useMemo(() => sheets.filter((sheet) => {
    const matchesGroup = group === "Relevant" ? sheet.group !== "Ignored" : sheet.group === group
    const term = deferredSearch.trim().toLowerCase()
    return matchesGroup && (!term || `${sheet.number} ${sheet.title} ${sheet.document}`.toLowerCase().includes(term))
  }), [deferredSearch, group, sheets])
  const selectedSheet = sheets.find((sheet) => sheet.id === selectedSheetId) ?? filteredSheets[0] ?? sheets[0]
  const finding = findings.find((item) => item.id === selectedFindingId) ?? findings[0]
  const relevantCount = demo ? 42 : sheets.filter((sheet) => sheet.group !== "Ignored").length
  const pageCount = demo ? 487 : project?.pageCount ?? sheets.length
  const reviewIndex = Math.max(0, findings.findIndex((item) => item.id === finding.id))

  function toggleLayer(key: LayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }))
  }

  function selectFinding(id: string) {
    const next = findings.find((item) => item.id === id)
    if (next) setSelectedFindingId(id)
  }

  function decide(status: ReviewState, message: string) {
    setFindings((current) => current.map((item) => item.id === finding.id ? { ...item, status } : item))
    toast.success(message, { description: `${finding.label} · ${finding.source} · decision recorded in the sample workspace.` })
  }

  function nextFinding(direction: 1 | -1) {
    const nextIndex = (reviewIndex + direction + findings.length) % findings.length
    setSelectedFindingId(findings[nextIndex].id)
  }

  function moveSheet(direction: 1 | -1) {
    if (!sheets.length) return
    const currentIndex = Math.max(0, sheets.findIndex((sheet) => sheet.id === selectedSheet?.id))
    const nextIndex = (currentIndex + direction + sheets.length) % sheets.length
    setSelectedSheetId(sheets[nextIndex].id)
  }

  async function enterFullscreen() {
    if (!roomRef.current?.requestFullscreen) {
      toast.info("Fullscreen is unavailable in this browser")
      return
    }
    await roomRef.current.requestFullscreen()
  }

  return (
    <section ref={roomRef} className="flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-[#0d151c] text-foreground lg:h-[calc(100dvh-4rem)] lg:min-h-0">
      <header className="border-b border-slate-700/50 bg-[#101922] px-3 py-3 lg:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px]">
            <div className="flex items-center gap-2"><h1 className="font-display text-xl font-black tracking-tight">Plan Room</h1>{demo ? <span className="rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-amber-200">Sample workspace</span> : null}</div>
            <p className="text-[10px] text-muted-foreground">{demo ? "Garden Villas" : project?.projectName ?? "No active project"}</p>
          </div>
          <nav className="order-3 flex w-full min-w-0 flex-1 items-center justify-center overflow-x-auto lg:order-none lg:w-auto" aria-label="Cabinet Brain workflow">
            {workflow.map((step, index) => <div key={step} className="flex shrink-0 items-center"><span className={`flex min-h-10 items-center gap-2 px-2 text-[10px] font-bold ${index === 1 ? "text-foreground" : index === 0 ? "text-primary" : "text-muted-foreground"}`}><span className={`flex size-6 items-center justify-center rounded-full border ${index === 0 ? "border-primary bg-primary text-primary-foreground" : index === 1 ? "border-sky-400 bg-sky-400/10 text-sky-300" : "border-slate-600"}`}>{index === 0 ? <Check className="size-3" /> : index + 1}</span>{step}</span>{index < workflow.length - 1 ? <span className="h-px w-4 bg-slate-600" /> : null}</div>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {demo ? <button type="button" onClick={onOpenNewRun} className="flex min-h-11 items-center gap-2 rounded-lg border border-border/80 px-3 text-[10px] font-bold hover:bg-white/[0.04]"><Plus className="size-4" /> New run</button> : <button type="button" onClick={onUseDemo} className="flex min-h-11 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 text-[10px] font-bold text-primary"><Sparkles className="size-4" /> View sample</button>}
            <button type="button" className="hidden min-h-11 items-center gap-2 rounded-lg border border-border/80 px-3 text-[10px] font-bold sm:flex"><Layers3 className="size-4" /> {demo ? "Garden Villas" : project?.projectName ?? "Select project"}<ChevronDown className="size-3" /></button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[268px_minmax(0,1fr)_350px]">
        <aside className="border-b border-slate-700/50 bg-[#101922] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 border-b border-slate-700/50 p-4">
            <div><p className="font-mono text-3xl font-black tabular-nums">{pageCount}</p><p className="text-[10px] text-muted-foreground">pages indexed</p></div>
            <div className="border-l border-slate-700/60 pl-4"><p className="font-mono text-3xl font-black tabular-nums text-primary">{relevantCount}</p><p className="text-[10px] text-primary/80">cabinet-relevant</p></div>
          </div>
          <div className="flex gap-2 p-3">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-black/15 px-3"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search sheets" placeholder="Search sheets…" className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-xs" /></label>
            <button type="button" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-700" aria-label="Filter sheets"><Filter className="size-4" /></button>
          </div>
          <div className="scrollbar-none flex gap-1 overflow-x-auto border-y border-slate-700/40 p-2 lg:block lg:space-y-0.5 lg:border-y-0">
            {SHEET_GROUPS.map((item) => {
              const count = sheets.filter((sheet) => item === "Relevant" ? sheet.group !== "Ignored" : sheet.group === item).length
              return <button key={item} type="button" onClick={() => setGroup(item)} className={`flex min-h-11 shrink-0 items-center justify-between rounded-md px-3 text-[11px] font-bold transition lg:w-full ${group === item ? "bg-sky-400/10 text-sky-200" : "text-muted-foreground hover:bg-white/[0.035] hover:text-foreground"}`}><span>{item}</span><span className="ml-4 font-mono text-[9px]">{count}</span></button>
            })}
          </div>
          <div className="scrollbar-none flex overflow-x-auto lg:block lg:overflow-visible">
            {filteredSheets.length ? filteredSheets.map((sheet) => <div key={sheet.id} className="min-w-[240px] lg:min-w-0"><SheetThumbnail sheet={sheet} selected={sheet.id === selectedSheet?.id} onClick={() => setSelectedSheetId(sheet.id)} /></div>) : <div className="p-8 text-center text-xs text-muted-foreground">No sheets match this view.</div>}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col border-b border-slate-700/50 bg-[#0b1218] lg:border-b-0 lg:border-r">
          <div className="flex min-h-14 items-center gap-2 border-b border-slate-700/50 bg-[#101922] px-3">
            <FileText className="size-4 text-slate-300" />
            <p className="min-w-0 flex-1 truncate text-xs font-black">{selectedSheet ? `${selectedSheet.number} — ${selectedSheet.title}` : "No sheet selected"}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveSheet(-1)} disabled={!sheets.length} className="flex size-11 items-center justify-center rounded-lg border border-slate-700 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
              <span className="hidden min-w-16 text-center font-mono text-[10px] text-muted-foreground sm:block">{selectedSheet?.pageNumber ?? 0} / {pageCount}</span>
              <button type="button" onClick={() => moveSheet(1)} disabled={!sheets.length} className="flex size-11 items-center justify-center rounded-lg border border-slate-700 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
              <button type="button" onClick={() => setZoom((value) => Math.max(75, value - 25))} className="hidden size-11 items-center justify-center rounded-lg border border-slate-700 sm:flex" aria-label="Zoom out"><Minus className="size-4" /></button>
              <span className="hidden min-w-12 text-center font-mono text-[10px] sm:block">{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(150, value + 25))} className="hidden size-11 items-center justify-center rounded-lg border border-slate-700 sm:flex" aria-label="Zoom in"><Plus className="size-4" /></button>
              <button type="button" onClick={() => void enterFullscreen()} className="flex size-11 items-center justify-center rounded-lg border border-slate-700" aria-label="Fullscreen"><Maximize2 className="size-4" /></button>
            </div>
          </div>
          <div className="scrollbar-none flex min-h-12 items-center justify-center gap-1 overflow-x-auto border-b border-slate-700/40 bg-[#0f1820] px-2">
            <LayerToggle active={layers.evidence} label="Evidence" onClick={() => toggleLayer("evidence")} />
            <LayerToggle active={layers.dimensions} label="Dimensions" onClick={() => toggleLayer("dimensions")} />
            <LayerToggle active={layers.skus} label="SKUs" onClick={() => toggleLayer("skus")} />
            <LayerToggle active={layers.exceptions} label="Exceptions" tone="amber" onClick={() => toggleLayer("exceptions")} />
          </div>
          <div className="min-h-[430px] flex-1 overflow-hidden">
            {demo ? <CabinetElevation finding={finding} showEvidence={layers.evidence} showDimensions={layers.dimensions} showSkus={layers.skus} showExceptions={layers.exceptions} zoom={zoom} onSelectFinding={selectFinding} /> : <LiveEvidenceUnavailable sheet={selectedSheet} />}
          </div>
          <div className="border-t border-slate-700/50 bg-[#101922] p-2">
            <div className="mb-2 flex items-center justify-between px-1"><p className="text-[10px] font-black">Related evidence ({demo ? 4 : selectedSheet ? 1 : 0})</p><div className="flex gap-1"><button type="button" className="min-h-8 rounded-md bg-sky-400/10 px-2 text-[9px] font-bold text-sky-200">All</button><button type="button" className="min-h-8 rounded-md px-2 text-[9px] text-muted-foreground">Plans</button><button type="button" className="min-h-8 rounded-md px-2 text-[9px] text-muted-foreground">Elevations</button></div></div>
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              {demo ? <><EvidenceCard type="Plan" title="A1.01 — Level 1 Plan" subtitle="Clubhouse Kitchen" /><EvidenceCard type="Elevation" title="A501 — Interior Elevations" subtitle="North Elevation · Current" selected /><EvidenceCard type="Elevation" title="A502 — Interior Elevations" subtitle="East Elevation" /><EvidenceCard type="Schedule" title="A601 — Finish Schedule" subtitle="Casework & Millwork" /></> : selectedSheet ? <EvidenceCard type={selectedSheet.classification} title={`${selectedSheet.number} — ${selectedSheet.title}`} subtitle={`Page ${selectedSheet.pageNumber} · classified evidence`} selected /> : null}
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col bg-[#101922] lg:overflow-y-auto">
          <div className="flex min-h-14 items-center border-b border-slate-700/50 px-4"><SlidersHorizontal className="mr-2 size-4" /><h2 className="text-xs font-black">Cabinet Intelligence</h2></div>
          {demo ? (
            <>
              <div className="flex min-h-12 items-center justify-between border-b border-slate-700/40 px-4">
                <button type="button" onClick={() => nextFinding(-1)} className="flex size-10 items-center justify-center rounded-lg hover:bg-white/[0.04]" aria-label="Previous exception"><ChevronLeft className="size-4" /></button>
                <span className="font-mono text-[10px] text-muted-foreground">{reviewIndex + 4} of 17 exceptions</span>
                <button type="button" onClick={() => nextFinding(1)} className="flex size-10 items-center justify-center rounded-lg hover:bg-white/[0.04]" aria-label="Next exception"><ChevronRight className="size-4" /></button>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg border border-slate-700 bg-background/40"><Layers3 className="size-4" /></span><h3 className="truncate text-base font-black">{finding.label}</h3></div><StatusBadge status={finding.status} /></div>
                <dl className="grid grid-cols-2 border-y border-slate-700/50 text-[10px]">
                  <div className="border-b border-r border-slate-700/50 py-3 pr-3"><dt className="text-muted-foreground">Raw width</dt><dd className="mt-1 font-mono text-base font-black">{finding.rawWidth}</dd></div>
                  <div className="border-b border-slate-700/50 py-3 pl-3"><dt className="text-muted-foreground">Normalized width</dt><dd className="mt-1 font-mono text-base font-black">{finding.normalizedWidth}</dd></div>
                  <div className="border-b border-r border-slate-700/50 py-3 pr-3"><dt className="text-muted-foreground">Proposed SKU</dt><dd className="mt-1 font-mono text-base font-black">{finding.sku}</dd></div>
                  <div className="border-b border-slate-700/50 py-3 pl-3"><dt className="text-muted-foreground">Catalog</dt><dd className="mt-1 text-sm font-black">{finding.catalog}</dd></div>
                  <div className="border-r border-slate-700/50 py-3 pr-3"><dt className="text-muted-foreground">Takeoff group</dt><dd className="mt-1 text-xs font-black">{finding.takeoffGroup}</dd></div>
                  <div className="py-3 pl-3"><dt className="text-muted-foreground">Source</dt><dd className="mt-1 text-xs font-black text-sky-300">{finding.source}</dd></div>
                </dl>
                <div><p className="mb-3 text-[10px] font-black">Confidence <span className="font-normal text-muted-foreground">(component-based)</span></p><div className="space-y-3">{finding.confidence.map((signal) => <div key={signal.label}><div className="mb-1 flex justify-between text-[9px]"><span className="text-muted-foreground">{signal.label}</span><span className="font-mono font-black">{signal.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${signal.value === 0 ? "bg-amber-400" : "bg-primary"}`} style={{ width: `${Math.max(2, signal.value)}%` }} /></div></div>)}</div></div>
                <div className="rounded-lg border border-slate-700 bg-background/35 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black">Rule <span className="font-normal text-muted-foreground">(applied)</span></p><CheckCircle2 className="size-4 text-primary" /></div><code className="block rounded border border-slate-700 bg-black/20 px-3 py-2 font-mono text-xs text-amber-100">{finding.rule}</code></div>
                <div><p className="mb-2 text-[10px] font-black">Supporting Evidence</p><div className="space-y-1">{["A501 — Interior Elevation", "A1.01 — Floor Plan", "A601 — Finish Schedule"].map((item) => <button key={item} type="button" className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-slate-700 px-3 text-left text-[10px] hover:bg-white/[0.03]"><FileText className="size-4 text-slate-300" /><span className="min-w-0 flex-1 truncate">{item}</span><ChevronRight className="size-3 text-muted-foreground" /></button>)}</div></div>
              </div>
              <div className="sticky bottom-0 mt-auto grid grid-cols-3 gap-2 border-t border-slate-700/50 bg-[#101922]/95 p-3 backdrop-blur">
                <button type="button" onClick={() => toast.info("Correction editor ready", { description: "The production editor will persist an evidence-backed replacement decision." })} className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-slate-600 text-[10px] font-black hover:bg-white/[0.04]"><Pencil className="size-3.5" /> Correct</button>
                <button type="button" onClick={() => decide("custom", "Marked as custom millwork")} className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 text-[10px] font-black text-amber-200"><AlertTriangle className="size-3.5" /> Mark Custom</button>
                <button type="button" onClick={() => decide("verified", "Cabinet approved")} className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-primary text-[10px] font-black text-primary-foreground"><span className="hidden xl:inline">Approve &amp; Next</span><span className="xl:hidden">Approve</span><ArrowRight className="size-3.5" /></button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center"><div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-slate-700"><FileSearch className="size-5 text-muted-foreground" /></div><h3 className="mt-4 text-sm font-black">No cabinet evidence available</h3><p className="mt-2 text-[11px] leading-5 text-muted-foreground">This panel will populate only when the server returns validated cabinet detections. Classified pages alone are not cabinet takeoff evidence.</p><button type="button" onClick={onUseDemo} className="mt-5 min-h-11 rounded-lg border border-primary/30 bg-primary/10 px-4 text-[10px] font-black text-primary">Explore sample interaction</button></div></div>
          )}
        </aside>
      </div>
    </section>
  )
}
