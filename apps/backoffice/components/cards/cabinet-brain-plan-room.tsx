"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, FileSearch, FileText, FolderOpen, MoreHorizontal, Plus, Search, SlidersHorizontal } from "lucide-react"
import type { VisionJob, VisionProject } from "@vulpine/sdk"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { SHEET_GROUPS, type PlanSheet, type SheetGroup } from "./cabinet-brain-data"

type Props = {
  project: VisionProject
  job: VisionJob
  onOpenNewRun: () => void
}

const classificationGroup: Record<string, SheetGroup> = {
  FLOOR_PLAN: "Relevant",
  UNIT_MATRIX: "Relevant",
  UNIT_PLAN: "Unit Plans",
  CASEWORK_SCHEDULE: "Elevations",
  FINISH_SCHEDULE: "Schedules",
  UNKNOWN: "Ignored",
}

function pagesToSheets(job: VisionJob): PlanSheet[] {
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

function SheetRow({ sheet, selected, onSelect }: { sheet: PlanSheet; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`flex min-h-16 w-full items-center gap-3 border-l-2 px-4 py-3 text-left ${selected ? "border-primary bg-primary/[0.08]" : "border-transparent"}`}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/35"><FileText className="size-5 text-muted-foreground" /></span>
      <span className="min-w-0 flex-1"><strong className="block text-xs text-foreground">{sheet.number} · {sheet.title}</strong><span className="mt-1 block truncate text-[10px] text-muted-foreground">{sheet.document}</span></span>
      <span className="rounded-md bg-muted/40 px-2 py-1 font-mono text-[9px] text-muted-foreground">{sheet.classification}</span>
    </button>
  )
}

function RunDetails({ project, job }: { project: VisionProject; job: VisionJob }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border/60 bg-background/30 p-4"><dt className="text-[10px] text-muted-foreground">Project</dt><dd className="mt-1 truncate text-sm font-black">{project.projectName}</dd></div>
      <div className="rounded-xl border border-border/60 bg-background/30 p-4"><dt className="text-[10px] text-muted-foreground">Workflow</dt><dd className="mt-1 text-sm font-black text-primary">{job.state.replaceAll("_", " ")}</dd></div>
      <div className="rounded-xl border border-border/60 bg-background/30 p-4"><dt className="text-[10px] text-muted-foreground">Pages</dt><dd className="mt-1 font-mono text-xl font-black">{project.pageCount}</dd></div>
      <div className="rounded-xl border border-border/60 bg-background/30 p-4"><dt className="text-[10px] text-muted-foreground">Safe to send</dt><dd className="mt-1 text-sm font-black text-rose-300">{job.qaResult.safeToSend ? "YES" : "NO"}</dd></div>
    </dl>
  )
}

function PreviewUnavailable({ sheet }: { sheet?: PlanSheet }) {
  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center bg-[#f3f4f2] px-6 py-12 text-center text-slate-900">
      <div className="max-w-md"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-slate-300 bg-white shadow-sm"><FileSearch className="size-6 text-slate-600" /></span><h2 className="mt-5 text-lg font-black">Drawing evidence is not available</h2><p className="mt-2 text-sm leading-6 text-slate-600">The Vision service classified {sheet ? `${sheet.document}, page ${sheet.pageNumber}` : "the uploaded documents"}, but it has not returned a rendered page, cabinet regions, dimensions, or SKU evidence. Cabinet Brain will not invent them.</p>{sheet ? <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-left"><p className="text-[10px] uppercase tracking-wider text-slate-500">Server classification</p><p className="mt-1 font-mono text-sm font-bold">{sheet.classification}</p></div> : null}</div>
    </div>
  )
}

export function CabinetBrainPlanRoom({ project, job, onOpenNewRun }: Props) {
  const sheets = useMemo(() => pagesToSheets(job), [job])
  const [group, setGroup] = useState<SheetGroup>(() => sheets.some((sheet) => sheet.group !== "Ignored") ? "Relevant" : sheets[0]?.group ?? "Relevant")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [selectedId, setSelectedId] = useState(sheets[0]?.id ?? "")
  const filtered = useMemo(() => sheets.filter((sheet) => {
    const groupMatch = group === "Relevant" ? sheet.group !== "Ignored" : sheet.group === group
    const term = deferredSearch.trim().toLowerCase()
    return groupMatch && (!term || `${sheet.number} ${sheet.title} ${sheet.document}`.toLowerCase().includes(term))
  }), [deferredSearch, group, sheets])
  const selected = sheets.find((sheet) => sheet.id === selectedId) ?? filtered[0] ?? sheets[0]
  const mobileGroups = useMemo(() => [group, ...SHEET_GROUPS.filter((item) => item !== group)], [group])

  function movePage(direction: 1 | -1) {
    if (!sheets.length) return
    const index = Math.max(0, sheets.findIndex((sheet) => sheet.id === selected?.id))
    setSelectedId(sheets[(index + direction + sheets.length) % sheets.length].id)
  }

  return (
    <section className="min-h-[calc(100dvh-4rem)] bg-[#0d151c] pb-28 text-foreground lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:overflow-hidden lg:pb-0">
      <header className="border-b border-border/50 bg-[#101922] px-4 py-4 lg:px-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate font-display text-xl font-black">Cabinet Brain</h1><span className="rounded border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-300">Live</span></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{project.projectName}</p></div>
          <button type="button" onClick={onOpenNewRun} className="hidden min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground sm:flex"><Plus className="size-4" /> New run</button>
          <Drawer>
            <DrawerTrigger asChild><button type="button" className="flex size-11 items-center justify-center rounded-xl border border-border/70" aria-label="Cabinet Brain actions"><MoreHorizontal className="size-5" /></button></DrawerTrigger>
            <DrawerContent className="border-border/70 bg-card pb-[env(safe-area-inset-bottom)]"><DrawerHeader className="text-left"><DrawerTitle>Cabinet Brain</DrawerTitle><DrawerDescription>Run details and actions.</DrawerDescription></DrawerHeader><div className="space-y-4 overflow-y-auto px-4 pb-5"><RunDetails project={project} job={job} /><DrawerClose asChild><button type="button" onClick={onOpenNewRun} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"><Plus className="size-4" /> Start a new run</button></DrawerClose></div></DrawerContent>
          </Drawer>
        </div>
      </header>

      <div className="lg:grid lg:h-[calc(100%-77px)] lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside id="cabinet-sheets" className="border-b border-border/50 bg-[#101922] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 border-b border-border/50 px-4 py-4"><div><p className="font-mono text-2xl font-black">{project.pageCount}</p><p className="text-[10px] text-muted-foreground">pages indexed</p></div><div className="border-l border-border/50 pl-4"><p className="font-mono text-2xl font-black text-primary">{sheets.filter((sheet) => sheet.group !== "Ignored").length}</p><p className="text-[10px] text-muted-foreground">relevant pages</p></div></div>
          <div className="p-3"><label className="flex min-h-12 items-center gap-2 rounded-xl border border-border/70 bg-background/30 px-3"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real sheets" className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-xs" /></label></div>
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:hidden">{mobileGroups.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold ${group === item ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><span>{item}</span><span className="ml-3 font-mono text-[9px]">{sheets.filter((sheet) => item === "Relevant" ? sheet.group !== "Ignored" : sheet.group === item).length}</span></button>)}</div>
          <div className="hidden space-y-1 px-3 pb-3 lg:block">{SHEET_GROUPS.map((item) => <button key={item} type="button" onClick={() => setGroup(item)} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-xs font-bold ${group === item ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><span>{item}</span><span className="font-mono text-[9px]">{sheets.filter((sheet) => item === "Relevant" ? sheet.group !== "Ignored" : sheet.group === item).length}</span></button>)}</div>
          <div className="hidden lg:block">{filtered.length ? filtered.map((sheet) => <SheetRow key={sheet.id} sheet={sheet} selected={sheet.id === selected?.id} onSelect={() => setSelectedId(sheet.id)} />) : <p className="p-8 text-center text-xs text-muted-foreground">No matching sheets.</p>}</div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[#0b1218] lg:border-r lg:border-border/50">
          <div className="flex min-h-14 items-center gap-2 border-b border-border/50 px-3"><FileText className="size-4 text-muted-foreground" /><p className="min-w-0 flex-1 truncate text-xs font-black">{selected ? `${selected.number} — ${selected.title}` : "No classified sheet selected"}</p><button type="button" onClick={() => movePage(-1)} disabled={!sheets.length} className="flex size-11 items-center justify-center rounded-xl border border-border/70 disabled:opacity-40" aria-label="Previous classified page"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => movePage(1)} disabled={!sheets.length} className="flex size-11 items-center justify-center rounded-xl border border-border/70 disabled:opacity-40" aria-label="Next classified page"><ChevronRight className="size-4" /></button></div>
          <PreviewUnavailable sheet={selected} />
        </main>

        <aside className="hidden min-h-0 overflow-y-auto bg-[#101922] p-5 lg:block"><div className="flex items-center gap-2"><SlidersHorizontal className="size-4" /><h2 className="text-sm font-black">Run Intelligence</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Only server-validated evidence appears here.</p><div className="mt-5"><RunDetails project={project} job={job} /></div><div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs leading-5 text-amber-100/80">Cabinet detections, measurements, takeoff groups, and SKU mappings are unavailable because the authoritative Vision service has not emitted them.</div></aside>
      </div>

      <div className="mobile-action-dock lg:hidden">
        <Drawer><DrawerTrigger asChild><button type="button" className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground"><FolderOpen className="size-4" /> Sheets ({filtered.length})</button></DrawerTrigger><DrawerContent className="max-h-[82dvh] border-border/70 bg-card pb-[env(safe-area-inset-bottom)]"><DrawerHeader className="text-left"><DrawerTitle>Classified sheets</DrawerTitle><DrawerDescription>{project.projectName} · real Vision results</DrawerDescription></DrawerHeader><div className="overflow-y-auto pb-5">{filtered.length ? filtered.map((sheet) => <DrawerClose key={sheet.id} asChild><div><SheetRow sheet={sheet} selected={sheet.id === selected?.id} onSelect={() => setSelectedId(sheet.id)} /></div></DrawerClose>) : <p className="p-8 text-center text-sm text-muted-foreground">No matching sheets.</p>}</div></DrawerContent></Drawer>
        <Drawer><DrawerTrigger asChild><button type="button" className="flex size-12 items-center justify-center rounded-xl text-muted-foreground" aria-label="View run details"><SlidersHorizontal className="size-5" /></button></DrawerTrigger><DrawerContent className="border-border/70 bg-card pb-[env(safe-area-inset-bottom)]"><DrawerHeader className="text-left"><DrawerTitle>Run details</DrawerTitle><DrawerDescription>Authoritative Vision workflow state.</DrawerDescription></DrawerHeader><div className="px-4 pb-5"><RunDetails project={project} job={job} /></div></DrawerContent></Drawer>
      </div>
    </section>
  )
}
