"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Expand,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ApiResponse } from "@vulpine/contracts"
import type { BidRecord, UpdateBidInput } from "@vulpine/sdk"
import { BID_STATUSES, bidNeedsReview, buildBidDashboard, normalizeBidStatus } from "@/lib/bids-dashboard"

const NAV_TABS = ["Overview", "Tasks", "Discussions", "Pins", "Dashboards"] as const

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
  const [taskView, setTaskView] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
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
    setTaskView(false)
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
    if (tab === "Overview") {
      setTaskView(false)
      document.querySelector("#overview")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    if (tab === "Tasks") {
      setTaskView(true)
      document.querySelector("#bid-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    if (tab === "Dashboards") {
      setTaskView(false)
      document.querySelector("#dashboards")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2ff] p-3 text-[#17181b] sm:p-6 lg:p-10 xl:px-[clamp(4rem,7.5vw,7.5rem)] xl:py-24">
      <Toaster position="top-right" richColors closeButton />
      <main id="overview" className="mx-auto w-full max-w-[1360px] overflow-hidden rounded-[18px] border border-[#d8dce7] bg-[#f8f9fc] shadow-[0_16px_50px_rgba(64,75,123,0.2)]">
        <header className="flex h-12 items-center gap-3 border-b border-[#d9dde7] bg-[#f4f5f9] px-3 sm:px-4">
          <div className="flex min-w-max items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-[6px] bg-[#f06465] text-[13px] font-black text-white shadow-sm">V</div>
            <h1 className="text-[15px] font-semibold tracking-[-0.015em] sm:text-base">Bids CRM &amp; Pipeline</h1>
            <button type="button" aria-label="Workspace menu" className="rounded p-1 text-[#727680] hover:bg-[#e7e9ef]"><MoreHorizontal className="size-4" /></button>
          </div>

          <nav aria-label="Bid workspace views" className="scrollbar-none ml-1 flex h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV_TABS.map((tab) => {
              const active = tab === (taskView ? "Tasks" : "Overview")
              const disabled = tab === "Discussions" || tab === "Pins"
              return (
                <button
                  key={tab}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectTab(tab)}
                  title={disabled ? `${tab} will activate when its service is connected` : undefined}
                  className={`h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${active ? "bg-[#d9dce6] text-[#24262b]" : "text-[#858994] hover:bg-[#e9ebf0] hover:text-[#4f535c] disabled:cursor-not-allowed disabled:opacity-55"}`}
                >
                  {tab}
                </button>
              )
            })}
            <button type="button" aria-label="Edit views" className="ml-0.5 rounded-md p-2 text-[#767b84] hover:bg-[#e6e8ed]"><Pencil className="size-3.5" /></button>
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
            <button type="button" aria-label="Previous view" className="rounded-md p-2 text-[#a0a4ae] hover:bg-[#e8eaf0]"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next view" className="rounded-md p-2 text-[#a0a4ae] hover:bg-[#e8eaf0]"><ChevronRight className="size-4" /></button>
            <Sparkles className="mx-1 size-4 text-[#7d9bf1]" aria-hidden="true" />
            <button type="button" aria-label="Notifications" className="relative rounded-md p-2 text-[#555963] hover:bg-[#e8eaf0]"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#e45279] ring-2 ring-[#f4f5f9]" /></button>
          </div>
        </header>

        <div className="flex min-h-11 items-center justify-between border-b border-[#d8dce7] bg-white px-3 sm:px-4">
          <button type="button" className="flex items-center gap-1 text-sm font-semibold hover:text-[#525866]">Bid Overview <ChevronDown className="size-3.5" /></button>
          <div className="flex items-center gap-2.5">
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => void uploadFiles(event.target.files)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={mutating} className="flex h-8 items-center gap-1.5 rounded-md border border-[#d7dae3] bg-white px-2.5 text-[11px] font-semibold text-[#565b66] shadow-sm hover:bg-[#f5f6f9] disabled:opacity-50">
              {mutating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} <span className="hidden sm:inline">Add bid PDF</span>
            </button>
            <button type="button" onClick={() => void load()} disabled={loading || mutating} aria-label="Refresh bids" className="rounded-md p-1.5 text-[#60646d] hover:bg-[#f0f1f5] disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
            <div className="hidden text-right text-[9px] leading-tight text-[#81858f] sm:block"><span>Last refreshed</span><br /><strong className="font-medium text-[#51555d]">{lastRefreshed ? "just now" : "waiting…"}</strong></div>
          </div>
        </div>

        {error && <div role="alert" className="border-b border-[#edb8bb] bg-[#fff1f1] px-4 py-3 text-xs font-medium text-[#a82e33]">Bids Tracker unavailable: {error}</div>}

        <section aria-label="Bid KPIs" className="grid grid-cols-1 border-b border-[#d7dbe5] bg-[#eef0f6] md:grid-cols-3">
          <KpiCard label="Closed Won" value={loading ? "…" : money(metrics.wonValue)} />
          <KpiCard label="Closed Lost" value={loading ? "…" : money(metrics.lostValue)} />
          <KpiCard label="Open Bids" value={loading ? "…" : money(metrics.openValue)} last />
        </section>

        <section id="dashboards" className="grid grid-cols-1 border-b border-[#d7dbe5] bg-[#eef0f6] lg:grid-cols-[1.05fr_.95fr]">
          <ChartPanel title="Open Bids by Amount & Status" className="lg:border-r">
            <StatusLegend data={metrics.status} mode="value" />
            <div className="h-[260px] px-2 pb-2 pt-3 sm:h-[300px] sm:px-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.status} margin={{ top: 22, right: 10, bottom: 2, left: 0 }}>
                  <CartesianGrid stroke="#eceef2" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#32343a", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#cfd2d8" }} />
                  <YAxis tickFormatter={compactMoney} tick={{ fill: "#5d616a", fontSize: 10 }} tickLine={false} axisLine={false} width={58} />
                  <Tooltip cursor={{ fill: "#f5f6f8" }} formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
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
                    <div className="text-center"><p className="text-2xl font-semibold tracking-tight text-[#212328]">{metrics.totalCount}</p><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#858993]">Total bids</p></div>
                  </div>
                </>
              ) : <EmptyState label="No recorded bids" />}
            </div>
          </ChartPanel>
        </section>

        <section id="bid-tracker" className="bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e0e2e8] px-3 py-3 sm:flex-row sm:items-center sm:px-4">
            <div>
              <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Bid Tracker</h2>{taskView && <span className="rounded-full bg-[#fff0c7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#805b00]">Needs review</span>}</div>
              <p className="mt-0.5 text-[10px] text-[#858993]">{visibleBids.length} of {metrics.totalCount} bids · edits save on blur</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#d9dce3] bg-[#fafbfc] px-2.5 text-[#7d818a] focus-within:border-[#9fa6b6] sm:w-64">
                <Search className="size-3.5 shrink-0" /><span className="sr-only">Search bids</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or companies" className="min-w-0 flex-1 bg-transparent text-[11px] text-[#25272c] outline-none placeholder:text-[#9ca0a9]" />
              </label>
              <button type="button" onClick={resetView} title="Reset filters and groups" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#d9dce3] text-[#6d717a] hover:bg-[#f3f4f7]" aria-label="Reset tracker view"><RotateCcw className="size-3.5" /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[11px]">
              <thead><tr className="border-b border-[#e1e3e8] text-[10px] font-medium text-[#62666f]"><th className="w-[28%] px-4 py-3">Project</th><th className="w-[13%] px-4 py-3">Status</th><th className="w-[18%] px-4 py-3">Company</th><th className="px-4 py-3 text-right">Bid Value</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3">Sent Date</th><th className="px-4 py-3 text-right">Projected Profit</th><th className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {groupedBids.map((group) => {
                  const collapsed = collapsedGroups.has(group.status)
                  return [
                    <tr key={`${group.status}-group`} className="border-b border-[#dfe2e7] bg-[#f7f8fa]">
                      <td colSpan={8} className="px-3 py-2">
                        <button type="button" onClick={() => toggleGroup(group.status)} className="flex items-center gap-2 text-[10px] font-semibold text-[#50545c]">
                          <ChevronDown className={`size-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                          <StatusPill status={group.status} />
                          <span className="font-normal text-[#92969f]">{group.bids.length}</span>
                        </button>
                      </td>
                    </tr>,
                    ...(!collapsed ? group.bids.map((bid) => (
                      <tr key={bid.id} className="border-b border-[#eceef1] transition-colors last:border-0 hover:bg-[#fafbfc]">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><CircleDollarSign className="size-4 shrink-0 text-[#d99126]" /><EditableText value={bid.project_name} label="Project" onCommit={(value) => updateBid(bid.id, { project_name: value })} /></div></td>
                        <td className="px-4 py-2.5"><select aria-label={`Status for ${bid.project_name ?? "bid"}`} defaultValue={normalizeBidStatus(bid.status)} onChange={(event) => void updateBid(bid.id, { status: event.target.value })} className={`${fieldClass} max-w-28 rounded-md bg-[#d4d5d7] px-2.5 text-center font-semibold`} >{BID_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                        <td className="px-4 py-2.5"><EditableText value={bid.company_name} label="Company" onCommit={(value) => updateBid(bid.id, { company_name: value })} /></td>
                        <td className="px-4 py-2.5 text-right"><EditableNumber value={bid.bid_amount} label="Bid value" onCommit={(value) => updateBid(bid.id, { bid_amount: value })} moneyInput /></td>
                        <td className="px-4 py-2.5 text-right"><EditableNumber value={bid.units} label="Units" onCommit={(value) => updateBid(bid.id, { units: value })} /></td>
                        <td className="px-4 py-2.5"><input aria-label={`Sent date for ${bid.project_name ?? "bid"}`} type="date" title={formatDate(bid.sent_date)} defaultValue={bid.sent_date ?? ""} onBlur={(event) => { if (event.target.value !== (bid.sent_date ?? "")) void updateBid(bid.id, { sent_date: event.target.value }) }} className={`${fieldClass} min-w-28`} /></td>
                        <td className="px-4 py-2.5 text-right font-medium text-[#228367]">{money(bid.projected_profit)}</td>
                        <td className="px-2 py-2.5"><button type="button" onClick={() => void deleteBid(bid.id)} disabled={mutating} aria-label={`Delete ${bid.project_name ?? "bid"}`} className="rounded-md p-1.5 text-[#a0a4ab] hover:bg-[#fff0f0] hover:text-[#ba3d43] disabled:opacity-50"><Trash2 className="size-3.5" /></button></td>
                      </tr>
                    )) : []),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {!loading && !error && visibleBids.length === 0 && <EmptyState label={taskView ? "No bids need review" : "No matching bid records"} />}
          {loading && <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[#747982]"><Loader2 className="size-4 animate-spin" /> Loading authoritative bid records…</div>}
        </section>
      </main>
    </div>
  )
}

const fieldClass = "w-full border border-transparent bg-transparent py-1 text-[11px] text-[#27292e] outline-none transition-colors hover:border-[#d8dbe2] hover:bg-[#f7f8fa] focus:border-[#aeb4c1] focus:bg-white"
const tooltipStyle = { background: "#ffffff", border: "1px solid #d9dce3", borderRadius: 6, boxShadow: "0 8px 24px rgba(45,51,70,.12)", color: "#202227", fontSize: 11 }

function KpiCard({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <article className={`relative min-h-[148px] bg-white p-4 ${last ? "" : "border-b border-[#d7dbe5] md:border-b-0 md:border-r"}`}><div className="flex items-center justify-between"><h2 className="text-sm font-medium">{label}</h2><div className="flex items-center gap-4 text-[#666a73]"><MoreHorizontal className="size-4" /><Expand className="size-3.5" /></div></div><p className="flex min-h-[92px] items-center justify-center text-[40px] font-medium tracking-[-0.035em] sm:text-[48px] lg:text-[54px]">{value}</p></article>
}

function ChartPanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <article className={`border-b border-[#d7dbe5] bg-white lg:border-b-0 ${className}`}><div className="flex items-center justify-between px-4 pt-3"><h2 className="text-sm font-medium">{title}</h2><div className="flex items-center gap-4 text-[#666a73]"><MoreHorizontal className="size-4" /><Expand className="size-3.5" /></div></div>{children}</article>
}

function StatusLegend({ data, mode }: { data: ReturnType<typeof buildBidDashboard>["status"]; mode: "value" | "count" }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pt-2 text-[9px] text-[#555961]">{data.map((item) => <span key={item.name} className="flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}<span className="text-[#9a9da4]">{mode === "value" ? compactMoney(item.value) : item.count}</span></span>)}</div>
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = { Sent: "bg-[#cacbcd] text-[#484a4e]", "Follow-Up": "bg-[#f5b4df] text-[#743057]", Won: "bg-[#a4eccb] text-[#1f664c]", Lost: "bg-[#e7aaa8] text-[#792d2b]" }
  return <span className={`rounded-md px-2 py-1 ${palette[status] ?? palette.Sent}`}>{status}</span>
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-40 items-center justify-center text-xs font-medium text-[#8a8e97]">{label}</div>
}

function EditableText({ value, label, onCommit }: { value: string | null; label: string; onCommit: (value: string) => void | Promise<void> }) {
  return <input aria-label={label} defaultValue={value ?? ""} onBlur={(event) => { if (event.target.value !== (value ?? "")) void onCommit(event.target.value) }} className={`${fieldClass} min-w-28 px-1.5`} />
}

function EditableNumber({ value, label, onCommit, moneyInput = false }: { value: number | null; label: string; onCommit: (value: number | null) => void | Promise<void>; moneyInput?: boolean }) {
  return <div className="flex items-center justify-end"><span className="text-[#777b83]">{moneyInput ? "$" : ""}</span><input aria-label={label} type="number" defaultValue={value ?? ""} onBlur={(event) => { const nextValue = event.target.value === "" ? null : Number(event.target.value); if (nextValue !== value) void onCommit(nextValue) }} className={`${fieldClass} w-24 px-1 text-right`} /></div>
}
