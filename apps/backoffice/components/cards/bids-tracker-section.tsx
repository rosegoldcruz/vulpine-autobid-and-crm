"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { AlertTriangle, BarChart3, Building2, CircleDollarSign, FileUp, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ApiResponse } from "@vulpine/contracts"
import type { BidKpis, BidRecord, UpdateBidInput } from "@vulpine/sdk"

const STATUS_OPTIONS = ["Sent", "Follow-Up", "Won", "Lost"] as const
const CHART_COLORS = ["#5eead4", "#60a5fa", "#fbbf24", "#fb7185", "#a78bfa", "#94a3b8"]

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/bids-tracker/${path}`, { cache: "no-store", ...options })
  const payload = await response.json() as ApiResponse<T>
  if (!payload.ok) throw new Error(payload.error.message)
  return payload.data
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

export function BidsTrackerSection() {
  const [bids, setBids] = useState<BidRecord[]>([])
  const [kpis, setKpis] = useState<BidKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bidRows, metrics] = await Promise.all([request<BidRecord[]>("bids"), request<BidKpis>("kpis")])
      setBids(bidRows)
      setKpis(metrics)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Bids Tracker")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredBids = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return bids
    return bids.filter((bid) => [bid.project_name, bid.company_name, bid.status].some((value) => value?.toLowerCase().includes(normalized)))
  }, [bids, query])

  const companyData = useMemo(() => Object.entries(kpis?.byCompany ?? {}).map(([name, value]) => ({ name, value })).slice(0, 8), [kpis])
  const statusData = useMemo(() => Object.entries(kpis?.byStatus ?? {}).map(([name, value]) => ({ name, value })), [kpis])
  const monthData = useMemo(() => Object.entries(kpis?.byMonth ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })), [kpis])

  async function updateBid(id: number, input: UpdateBidInput) {
    setMutating(true)
    setError(null)
    try {
      await request(`bids/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      setNotice("Bid updated from Backoffice.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update bid")
    } finally {
      setMutating(false)
    }
  }

  async function deleteBid(id: number) {
    if (!window.confirm("Delete this bid record? This changes the authoritative Bids Tracker database.")) return
    setMutating(true)
    setError(null)
    try {
      await request(`bids/${id}`, { method: "DELETE" })
      setNotice("Bid deleted.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete bid")
    } finally {
      setMutating(false)
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setMutating(true)
    setError(null)
    setNotice(null)
    let succeeded = 0
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("pdf", file)
        await request("upload", { method: "POST", body: formData })
        succeeded += 1
      }
      setNotice(`${succeeded} bid PDF${succeeded === 1 ? "" : "s"} processed.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload bid PDF")
    } finally {
      setMutating(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const metricCards = [
    { label: "Total bids", value: kpis ? String(kpis.totalBids) : "—", icon: BarChart3 },
    { label: "Pipeline revenue", value: money(kpis?.totalValue), icon: CircleDollarSign },
    { label: "Projected profit", value: money(kpis?.totalProfit), icon: CircleDollarSign },
    { label: "Units bid", value: kpis ? kpis.totalUnits.toLocaleString() : "—", icon: Building2 },
    { label: "Needs review", value: kpis ? String(kpis.recordsNeedingReview) : "—", icon: AlertTriangle },
  ]

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col gap-5">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="surface-card relative overflow-hidden rounded-2xl p-5 lg:p-7">
        <div className="pointer-events-none absolute -right-28 -top-28 size-64 rounded-full bg-primary/6 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <div className="glow-teal-sm flex size-10 items-center justify-center rounded-xl bg-primary/10"><BarChart3 className="size-5 text-primary" /></div>
              <div><h2 className="font-display text-xl font-extrabold tracking-tight">Bids Tracker</h2><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">Server-authoritative · transitional SQLite</p></div>
            </div>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">Operational bid history and KPIs from the existing server service. Backoffice does not own or copy the tracker database.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={loading || mutating} className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 text-xs font-bold transition-colors hover:bg-accent/50 disabled:opacity-50"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => void uploadFiles(event.target.files)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={mutating} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">{mutating ? <Loader2 className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />} Upload bid PDF</button>
          </div>
        </div>
      </motion.section>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-fin-loss/30 bg-fin-loss/[0.05] p-4 text-xs text-fin-loss"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-bold">Bids Tracker unavailable</p><p className="mt-1 text-fin-loss/80">{error}</p></div></div>}
      {notice && !error && <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-xs text-primary">{notice}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metricCards.map(({ label, value, icon: Icon }, index) => <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="surface-card rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{label}</p><Icon className="size-3.5 text-primary/70" /></div><p className="font-display text-xl font-extrabold tracking-tight">{loading ? "…" : value}</p></motion.div>)}
      </div>

      {kpis && <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel title="Bid value by company">{companyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={companyData}><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={compactNumber} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#5eead4" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}</ChartPanel>
        <ChartPanel title="Bid status">{statusData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>{statusData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer> : <EmptyChart />}</ChartPanel>
        <ChartPanel title="Bids sent per month">{monthData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={monthData}><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={{ fill: "#60a5fa", r: 3 }} /></LineChart></ResponsiveContainer> : <EmptyChart />}</ChartPanel>
      </div>}

      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col justify-between gap-3 border-b border-border/50 p-4 sm:flex-row sm:items-center"><div><h3 className="font-display text-sm font-bold">Bid history</h3><p className="mt-0.5 text-[11px] text-muted-foreground">Edits save to the standalone tracker on blur.</p></div><label className="flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 text-muted-foreground focus-within:border-primary/40"><Search className="size-3.5" /><span className="sr-only">Search bids</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, company, status" className="w-56 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60" /></label></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-xs"><thead><tr className="border-b border-border/50 text-[10px] uppercase tracking-[0.08em] text-muted-foreground"><th className="px-4 py-3">Project</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Bid amount</th><th className="px-4 py-3">Projected profit</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {!loading && filteredBids.map((bid) => <tr key={bid.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/20"><EditableText value={bid.project_name} onCommit={(value) => updateBid(bid.id, { project_name: value })} /><EditableText value={bid.company_name} onCommit={(value) => updateBid(bid.id, { company_name: value })} /><EditableNumber value={bid.units} onCommit={(value) => updateBid(bid.id, { units: value })} /><EditableNumber value={bid.bid_amount} onCommit={(value) => updateBid(bid.id, { bid_amount: value })} moneyInput /><td className="px-4 py-3 font-mono text-[11px] text-fin-gain">{money(bid.projected_profit)}</td><td className="px-4 py-3"><input type="date" defaultValue={bid.sent_date ?? ""} onBlur={(event) => { if (event.target.value !== (bid.sent_date ?? "")) void updateBid(bid.id, { sent_date: event.target.value }) }} className={inputClass} /></td><td className="px-4 py-3"><select defaultValue={bid.status ?? "Sent"} onChange={(event) => void updateBid(bid.id, { status: event.target.value })} className={inputClass}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td className="px-4 py-3"><button type="button" onClick={() => void deleteBid(bid.id)} disabled={mutating} aria-label={`Delete ${bid.project_name ?? "bid"}`} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-fin-loss/10 hover:text-fin-loss"><Trash2 className="size-3.5" /></button></td></tr>)}
        </tbody></table></div>
        {!loading && !error && filteredBids.length === 0 && <div className="p-12 text-center"><BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/40" /><p className="text-sm font-bold">No bid records found.</p><p className="mt-1 text-xs text-muted-foreground">Upload a real bid PDF or adjust the search.</p></div>}
        {loading && <div className="flex items-center justify-center gap-2 p-12 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading authoritative bid records…</div>}
      </section>
    </div>
  )
}

const inputClass = "w-full min-w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-border hover:bg-muted/20 focus:border-primary/40 focus:bg-muted/30"
const tooltipStyle = { background: "#171a21", border: "1px solid rgba(148,163,184,.2)", borderRadius: 10, fontSize: 11 }

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="surface-card rounded-2xl p-4"><h3 className="mb-3 text-xs font-bold text-foreground">{title}</h3><div className="h-52">{children}</div></section> }
function EmptyChart() { return <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">No recorded data</div> }
function EditableText({ value, onCommit }: { value: string | null; onCommit: (value: string) => void | Promise<void> }) { return <td className="px-4 py-3"><input defaultValue={value ?? ""} onBlur={(event) => { if (event.target.value !== (value ?? "")) void onCommit(event.target.value) }} className={inputClass} /></td> }
function EditableNumber({ value, onCommit, moneyInput = false }: { value: number | null; onCommit: (value: number | null) => void | Promise<void>; moneyInput?: boolean }) { return <td className="px-4 py-3"><div className="flex items-center">{moneyInput && <span className="text-muted-foreground">$</span>}<input type="number" defaultValue={value ?? ""} onBlur={(event) => { const nextValue = event.target.value === "" ? null : Number(event.target.value); if (nextValue !== value) void onCommit(nextValue) }} className={inputClass} /></div></td> }
