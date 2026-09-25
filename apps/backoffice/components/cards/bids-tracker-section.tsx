"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ApiResponse } from "@vulpine/contracts"
import type { BidRecord, UpdateBidInput } from "@vulpine/sdk"
import { BID_STATUSES, bidNeedsReview, buildBidDashboard, normalizeBidStatus } from "@/lib/bids-dashboard"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"

const NAV_TABS = ["Overview", "Tasks", "Dashboards"] as const

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bids-tracker/${path}`, { cache: "no-store", ...options })
  const payload = await response.json() as ApiResponse<T>
  if (!payload.ok) throw new Error(payload.error.message)
  return payload.data
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function compactMoney(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `$${Math.round(value)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(date)
}

export function BidsTrackerSection() {
  const [bids, setBids] = useState<BidRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<(typeof NAV_TABS)[number]>("Overview")
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingBid, setEditingBid] = useState<BidRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBids(await request<BidRecord[]>("bids"))
      setLastRefreshed(new Date())
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load Bids Tracker"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const taskView = activeTab === "Tasks"
  const metrics = useMemo(() => buildBidDashboard(bids), [bids])
  const visibleBids = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return bids.filter((bid) => {
      if (taskView && !bidNeedsReview(bid)) return false
      if (!normalized) return true
      return [bid.project_name, bid.company_name, bid.status]
        .some((value) => value?.toLowerCase().includes(normalized))
    })
  }, [bids, query, taskView])
  const groupedBids = useMemo(() => BID_STATUSES.map((status) => ({
    status,
    bids: visibleBids.filter((bid) => normalizeBidStatus(bid.status) === status),
  })).filter((group) => group.bids.length > 0), [visibleBids])
  const nonZeroStatus = metrics.status.filter((status) => status.count > 0)

  async function updateBid(id: number, input: UpdateBidInput) {
    setMutating(true)
    setError(null)
    const savingToast = toast.loading("Saving bid changes…")
    try {
      await request(`bids/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      })
      toast.success("Bid saved", { id: savingToast, description: "The tracker and dashboard totals are up to date." })
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to update bid"
      setError(message)
      toast.error("Save failed", { id: savingToast, description: message })
    } finally {
      setMutating(false)
    }
  }

  async function deleteBid(id: number) {
    if (!window.confirm("Delete this bid record? This updates the authoritative Bids Tracker database.")) return
    setMutating(true)
    setError(null)
    const deletingToast = toast.loading("Deleting bid…")
    try {
      await request(`bids/${id}`, { method: "DELETE" })
      toast.success("Bid deleted", { id: deletingToast, description: "The record was removed from the authoritative tracker." })
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to delete bid"
      setError(message)
      toast.error("Delete failed", { id: deletingToast, description: message })
    } finally {
      setMutating(false)
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setMutating(true)
    setError(null)
    const addingToast = toast.loading(`Adding ${files.length} bid PDF${files.length === 1 ? "" : "s"}…`)
    let succeeded = 0
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("pdf", file)
        await request("upload", { method: "POST", body: formData })
        succeeded += 1
      }
      toast.success(`${succeeded} bid${succeeded === 1 ? "" : "s"} added`, { id: addingToast, description: "PDF processing is complete and the dashboard was refreshed." })
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to upload bid PDF"
      setError(message)
      toast.error("Add bid failed", { id: addingToast, description: message })
    } finally {
      setMutating(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function resetView() {
    setQuery("")
    setActiveTab("Overview")
    setCollapsedGroups(new Set())
    toast.info("Tracker reset", { description: "Search, task filter, and collapsed groups were cleared." })
  }

  function toggleGroup(status: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function selectTab(tab: (typeof NAV_TABS)[number]) {
    setActiveTab(tab)
    if (tab === "Overview") {
      document.querySelector("#overview")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    if (tab === "Tasks") {
      document.querySelector("#bid-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    if (tab === "Dashboards") {
      document.querySelector("#dashboards")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div id="overview" className="flex min-h-[calc(100vh-4.5rem)] flex-col gap-5 pb-24 text-foreground lg:pb-0">
      <Toaster position="top-center" theme="dark" richColors closeButton />
      <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => void uploadFiles(event.target.files)} />

      <header className="surface-card rounded-2xl p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 glow-teal-sm">
              <CircleDollarSign className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Bids Tracker</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Live pipeline performance, bid records, and document intake.</p>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={mutating} className="flex h-9 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50">
              {mutating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add bid PDF
            </button>
            <button type="button" onClick={() => void load()} disabled={loading || mutating} aria-label="Refresh bids" className="flex size-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="hidden text-right text-[10px] leading-tight text-muted-foreground sm:block"><span>Last refreshed</span><br /><strong className="font-medium text-foreground/80">{lastRefreshed ? "just now" : "waiting…"}</strong></div>
          </div>
        </div>

        <nav aria-label="Bid workspace views" className="scrollbar-none mt-5 flex items-center gap-1 overflow-x-auto border-t border-border/40 pt-4">
          {NAV_TABS.map((tab) => {
            const active = tab === activeTab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => selectTab(tab)}
                className={`h-11 whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
              >
                {tab}
              </button>
            )
          })}
        </nav>
      </header>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive-foreground">Bids Tracker unavailable: {error}</div>}

      <section aria-label="Bid KPIs" className="grid grid-cols-3 gap-2 md:gap-3">
        <KpiCard label="Closed Won" value={loading ? "…" : money(metrics.wonValue)} />
        <KpiCard label="Closed Lost" value={loading ? "…" : money(metrics.lostValue)} />
        <KpiCard label="Open Bids" value={loading ? "…" : money(metrics.openValue)} />
      </section>

      <section id="dashboards" className={`${activeTab === "Dashboards" ? "grid" : "hidden"} grid-cols-1 gap-4 lg:grid lg:grid-cols-[1.05fr_.95fr]`}>
          <ChartPanel title="Open Bids by Amount & Status">
            <StatusLegend data={metrics.status} mode="value" />
            <div className="h-[260px] px-2 pb-2 pt-3 sm:h-[300px] sm:px-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.status} margin={{ top: 22, right: 10, bottom: 2, left: 0 }}>
                  <CartesianGrid stroke="#2c3039" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#8e93a3", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#353a44" }} />
                  <YAxis tickFormatter={compactMoney} tick={{ fill: "#8e93a3", fontSize: 10 }} tickLine={false} axisLine={false} width={58} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,.03)" }} formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={115} isAnimationActive={false}>
                    {metrics.status.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="Bids by Status">
            <StatusLegend data={metrics.status} mode="count" />
            <div className="relative h-[260px] pb-3 pt-2 sm:h-[300px]">
              {nonZeroStatus.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={nonZeroStatus} dataKey="count" nameKey="name" innerRadius="46%" outerRadius="68%" stroke="none" isAnimationActive={false}>
                        {nonZeroStatus.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${Number(value).toLocaleString()} bids`, name]} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-1 pt-7">
                    <div className="text-center"><p className="text-2xl font-semibold tracking-tight text-foreground">{metrics.totalCount}</p><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Total bids</p></div>
                  </div>
                </>
              ) : <EmptyState label="No recorded bids" />}
            </div>
          </ChartPanel>
      </section>

      <section id="bid-tracker" className={`${activeTab === "Dashboards" ? "hidden lg:block" : "block"} surface-card overflow-hidden rounded-2xl`}>
          <div className="flex flex-col justify-between gap-3 border-b border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <div className="flex items-center gap-2"><h2 className="font-display text-sm font-bold text-foreground">Bid register</h2>{taskView && <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">Needs review</span>}</div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{visibleBids.length} of {metrics.totalCount} bids · edits save on blur</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background/30 px-3 text-muted-foreground focus-within:border-primary/40 sm:w-64">
                <Search className="size-3.5 shrink-0" /><span className="sr-only">Search bids</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or companies" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-[11px]" />
              </label>
              <button type="button" onClick={resetView} title="Reset filters and groups" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground" aria-label="Reset tracker view"><RotateCcw className="size-4" /></button>
            </div>
          </div>

          <div className="divide-y divide-border/40 md:hidden">
            {groupedBids.map((group) => {
              const collapsed = collapsedGroups.has(group.status)
              return (
                <div key={`${group.status}-mobile`}>
                  <button type="button" onClick={() => toggleGroup(group.status)} className="flex h-12 w-full items-center gap-2 bg-muted/15 px-4 text-left text-[11px] font-semibold text-muted-foreground">
                    <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    <StatusPill status={group.status} />
                    <span className="text-muted-foreground/60">{group.bids.length}</span>
                  </button>
                  {!collapsed ? group.bids.map((bid) => (
                    <article key={bid.id} className="flex min-h-28 items-center gap-3 px-4 py-4">
                      <button type="button" onClick={() => setEditingBid(bid)} className="min-w-0 flex-1 rounded-xl text-left">
                        <span className="block truncate text-sm font-black tracking-tight text-foreground">{bid.project_name || "Untitled bid"}</span>
                        <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">{bid.company_name || "Company not set"}</span>
                        <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          <strong className="text-foreground">{money(bid.bid_amount)}</strong>
                          <span className="text-fin-gain">{money(bid.projected_profit)} profit</span>
                          <span className="text-muted-foreground/60">{formatDate(bid.sent_date)}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => setEditingBid(bid)} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground" aria-label={`Edit ${bid.project_name || "bid"}`}><Pencil className="size-4" /></button>
                    </article>
                  )) : null}
                </div>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[11px]">
              <thead><tr className="border-b border-border/50 bg-muted/10 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"><th className="w-[28%] px-4 py-3">Project</th><th className="w-[13%] px-4 py-3">Status</th><th className="w-[18%] px-4 py-3">Company</th><th className="px-4 py-3 text-right">Bid Value</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3">Sent Date</th><th className="px-4 py-3 text-right">Projected Profit</th><th className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {groupedBids.map((group) => {
                  const collapsed = collapsedGroups.has(group.status)
                  return [
                    <tr key={`${group.status}-group`} className="border-b border-border/40 bg-muted/15">
                      <td colSpan={8} className="px-3 py-2">
                        <button type="button" onClick={() => toggleGroup(group.status)} className="flex min-h-11 items-center gap-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`size-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                          <StatusPill status={group.status} />
                          <span className="font-normal text-muted-foreground/60">{group.bids.length}</span>
                        </button>
                      </td>
                    </tr>,
                    ...(!collapsed ? group.bids.map((bid) => (
                      <tr key={bid.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/20">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><CircleDollarSign className="size-4 shrink-0 text-amber-400" /><EditableText value={bid.project_name} label="Project" onCommit={(value) => updateBid(bid.id, { project_name: value })} /></div></td>
                        <td className="px-4 py-2.5"><select aria-label={`Status for ${bid.project_name ?? "bid"}`} defaultValue={normalizeBidStatus(bid.status)} onChange={(event) => void updateBid(bid.id, { status: event.target.value })} className={`${fieldClass} max-w-28 rounded-md bg-muted/60 px-2.5 text-center font-semibold`} >{BID_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                        <td className="px-4 py-2.5"><EditableText value={bid.company_name} label="Company" onCommit={(value) => updateBid(bid.id, { company_name: value })} /></td>
                        <td className="px-4 py-2.5 text-right"><EditableNumber value={bid.bid_amount} label="Bid value" onCommit={(value) => updateBid(bid.id, { bid_amount: value })} moneyInput /></td>
                        <td className="px-4 py-2.5 text-right"><EditableNumber value={bid.units} label="Units" onCommit={(value) => updateBid(bid.id, { units: value })} /></td>
                        <td className="px-4 py-2.5"><input aria-label={`Sent date for ${bid.project_name ?? "bid"}`} type="date" title={formatDate(bid.sent_date)} defaultValue={bid.sent_date ?? ""} onBlur={(event) => { if (event.target.value !== (bid.sent_date ?? "")) void updateBid(bid.id, { sent_date: event.target.value }) }} className={`${fieldClass} min-w-28 [color-scheme:dark]`} /></td>
                        <td className="px-4 py-2.5 text-right font-medium text-fin-gain">{money(bid.projected_profit)}</td>
                        <td className="px-2 py-2.5"><button type="button" onClick={() => void deleteBid(bid.id)} disabled={mutating} aria-label={`Delete ${bid.project_name ?? "bid"}`} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="size-4" /></button></td>
                      </tr>
                    )) : []),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {!loading && !error && visibleBids.length === 0 && <EmptyState label={taskView ? "No bids need review" : "No matching bid records"} />}
          {loading && <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading authoritative bid records…</div>}
        </section>

      <div className="mobile-action-dock lg:hidden">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={mutating} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-50">{mutating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add bid PDF</button>
        <button type="button" onClick={() => void load()} disabled={loading || mutating} className="flex size-12 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-50" aria-label="Refresh bids"><RefreshCw className={`size-5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {editingBid ? <BidEditDrawer bid={editingBid} mutating={mutating} onClose={() => setEditingBid(null)} onSave={async (input) => { await updateBid(editingBid.id, input); setEditingBid(null) }} onDelete={async () => { await deleteBid(editingBid.id); setEditingBid(null) }} /> : null}
    </div>
  )
}

const fieldClass = "w-full border border-transparent bg-transparent py-1 text-[11px] text-foreground outline-none transition-colors hover:border-border/70 hover:bg-accent/30 focus:border-primary/40 focus:bg-background/50"
const tooltipStyle = { background: "#191b20", border: "1px solid #343842", borderRadius: 8, boxShadow: "0 12px 30px rgba(0,0,0,.28)", color: "#f0f1f4", fontSize: 11 }

function KpiCard({ label, value }: { label: string; value: string }) {
  return <article className="surface-card min-w-0 overflow-hidden rounded-2xl px-3 py-4 md:min-h-[148px] md:p-5"><h2 className="min-h-8 text-[9px] font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground md:min-h-0 md:text-[11px] md:tracking-[0.08em]">{label}</h2><p className="mt-2 truncate text-lg font-black tracking-[-0.035em] text-foreground sm:text-2xl md:flex md:min-h-[92px] md:items-center md:text-[40px] xl:text-[44px]">{value}</p></article>
}

function BidEditDrawer({ bid, mutating, onClose, onSave, onDelete }: { bid: BidRecord; mutating: boolean; onClose: () => void; onSave: (input: UpdateBidInput) => Promise<void>; onDelete: () => Promise<void> }) {
  const [projectName, setProjectName] = useState(bid.project_name ?? "")
  const [companyName, setCompanyName] = useState(bid.company_name ?? "")
  const [status, setStatus] = useState<string>(normalizeBidStatus(bid.status))
  const [bidAmount, setBidAmount] = useState(bid.bid_amount?.toString() ?? "")
  const [units, setUnits] = useState(bid.units?.toString() ?? "")
  const [sentDate, setSentDate] = useState(bid.sent_date ?? "")

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-xl border-border/70 bg-card/98 pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="px-5 text-left">
          <DrawerTitle className="font-display text-xl font-black tracking-tight">Edit bid</DrawerTitle>
          <DrawerDescription>Update the authoritative tracker record.</DrawerDescription>
        </DrawerHeader>
        <form onSubmit={(event) => { event.preventDefault(); void onSave({ project_name: projectName, company_name: companyName, status, bid_amount: bidAmount === "" ? null : Number(bidAmount), units: units === "" ? null : Number(units), sent_date: sentDate }) }} className="overflow-y-auto px-5 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <MobileField label="Project"><input value={projectName} onChange={(event) => setProjectName(event.target.value)} className={mobileFieldClass} /></MobileField>
            <MobileField label="Company"><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={mobileFieldClass} /></MobileField>
            <MobileField label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)} className={mobileFieldClass}>{BID_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}</select></MobileField>
            <MobileField label="Bid value"><input type="number" inputMode="decimal" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} className={mobileFieldClass} /></MobileField>
            <MobileField label="Units"><input type="number" inputMode="numeric" value={units} onChange={(event) => setUnits(event.target.value)} className={mobileFieldClass} /></MobileField>
            <MobileField label="Sent date"><input type="date" value={sentDate} onChange={(event) => setSentDate(event.target.value)} className={`${mobileFieldClass} [color-scheme:dark]`} /></MobileField>
          </div>
          <DrawerFooter className="mt-5 grid grid-cols-[auto_1fr] gap-2 px-0">
            <button type="button" onClick={() => void onDelete()} disabled={mutating} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 text-xs font-bold text-destructive disabled:opacity-50"><Trash2 className="size-4" /> Delete</button>
            <button type="submit" disabled={mutating} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground disabled:opacity-50">{mutating ? <Loader2 className="size-4 animate-spin" /> : null} Save changes</button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}{children}</label>
}

const mobileFieldClass = "h-12 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-base font-medium text-foreground outline-none focus:border-primary/50"

function ChartPanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <article className={`surface-card overflow-hidden rounded-2xl ${className}`}><div className="px-5 pt-5"><h2 className="font-display text-sm font-bold text-foreground">{title}</h2></div>{children}</article>
}

function StatusLegend({ data, mode }: { data: ReturnType<typeof buildBidDashboard>["status"]; mode: "value" | "count" }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-2 text-[9px] text-muted-foreground">{data.map((item) => <span key={item.name} className="flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}<span className="text-muted-foreground/60">{mode === "value" ? compactMoney(item.value) : item.count}</span></span>)}</div>
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = { Sent: "bg-muted text-muted-foreground", "Follow-Up": "bg-pink-400/15 text-pink-300", Won: "bg-fin-gain/15 text-fin-gain", Lost: "bg-destructive/15 text-red-300" }
  return <span className={`rounded-md px-2 py-1 ${palette[status] ?? palette.Sent}`}>{status}</span>
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-40 items-center justify-center text-xs font-medium text-muted-foreground">{label}</div>
}

function EditableText({ value, label, onCommit }: { value: string | null; label: string; onCommit: (value: string) => void | Promise<void> }) {
  return <input aria-label={label} defaultValue={value ?? ""} onBlur={(event) => { if (event.target.value !== (value ?? "")) void onCommit(event.target.value) }} className={`${fieldClass} min-w-28 px-1.5`} />
}

function EditableNumber({ value, label, onCommit, moneyInput = false }: { value: number | null; label: string; onCommit: (value: number | null) => void | Promise<void>; moneyInput?: boolean }) {
  return <div className="flex items-center justify-end"><span className="text-muted-foreground">{moneyInput ? "$" : ""}</span><input aria-label={label} type="number" defaultValue={value ?? ""} onBlur={(event) => { const nextValue = event.target.value === "" ? null : Number(event.target.value); if (nextValue !== value) void onCommit(nextValue) }} className={`${fieldClass} w-24 px-1 text-right`} /></div>
}
