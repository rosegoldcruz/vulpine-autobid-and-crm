"use client"

import { useDeferredValue, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Layers3, Search, ShieldCheck, Workflow } from "lucide-react"
import { platformGroups, platformModules, moduleForId, type PlatformModuleId } from "@/lib/platform-modules"

function SurfaceLink({ id }: { id: PlatformModuleId }) {
  const workspace = moduleForId(id)
  return (
    <Link href={workspace.path} prefetch={false} className="group flex min-h-20 items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers3 className="size-5" /></span>
      <div className="min-w-0 flex-1"><p className="font-display text-sm font-bold">{workspace.label}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{workspace.purpose}</p></div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </Link>
  )
}

export function PlatformOverviewSection({ allowedSections }: { allowedSections?: readonly PlatformModuleId[] }) {
  const [search, setSearch] = useState("")
  const query = useDeferredValue(search.trim().toLocaleLowerCase())
  const available = platformModules.filter((workspace) => !allowedSections || allowedSections.includes(workspace.id))
  const matched = available.filter((workspace) => workspace.id !== "dashboard" && `${workspace.label} ${workspace.group} ${workspace.purpose}`.toLocaleLowerCase().includes(query))
  const workspaces = available.filter((workspace) => ["bidstracker", "vision", "drive"].includes(workspace.id))
  return (
    <div className="space-y-6" data-testid="platform-overview">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 sm:p-8">
        <p className="font-mono text-xs tracking-[.18em] text-primary">VULPINE OS / COMMAND CENTER</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">One company. One workspace.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Your bids, drawings, documents, and operations—together. Continue in an existing workspace or explore the next part of the platform.</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Shared identity and capability-controlled access</div>
      </section>
      {workspaces.length > 0 ? <section aria-label="Existing workspaces"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Continue your work</h2><span className="text-xs text-muted-foreground">Existing workspaces</span></div><div className="grid gap-3 xl:grid-cols-3">{workspaces.map((workspace) => <SurfaceLink key={workspace.id} id={workspace.id} />)}</div></section> : null}
      <section aria-label="Platform directory">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-bold">Explore the platform</h2><p className="mt-1 text-xs text-muted-foreground">New workspaces show what is connected and what still needs integration.</p></div><label className="flex min-h-12 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 sm:w-80"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Find a module" placeholder="Find a module…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none sm:text-sm" /></label></div>
        {platformGroups.map((group) => {
          const modules = matched.filter((workspace) => workspace.group === group)
          if (!modules.length) return null
          return <section key={group} aria-label={group} className="mb-6"><h3 className="mb-3 font-mono text-[11px] tracking-[.16em] text-muted-foreground">{group}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((workspace) => <SurfaceLink key={workspace.id} id={workspace.id} />)}</div></section>
        })}
        {!matched.length ? <p role="status" className="rounded-2xl border border-border/60 p-6 text-sm text-muted-foreground">No modules match “{search}”.</p> : null}
      </section>
    </div>
  )
}

export function PlatformModuleSection({ id, allowedSections }: { id: PlatformModuleId; allowedSections?: readonly PlatformModuleId[] }) {
  const workspace = moduleForId(id)
  const related = platformModules.filter((item) => item.id !== id && item.group === workspace.group && (!allowedSections || allowedSections.includes(item.id)))
  const existing = platformModules.filter((item) => ["bidstracker", "vision", "drive"].includes(item.id) && (!allowedSections || allowedSections.includes(item.id)))
  return (
    <div className="space-y-6" data-testid="platform-module">
      <header><p className="font-mono text-xs tracking-[.15em] text-primary">{workspace.group} / VULPINE OS</p><h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{workspace.label}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{workspace.purpose}</p></header>
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/70">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4"><h2 className="flex items-center gap-2 font-display text-sm font-bold"><Workflow className="size-4 text-primary" />Workspace connection</h2><span className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-xs text-amber-300">Not connected</span></div>
        <div className="p-5 sm:p-8"><div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 className="size-7" /></div><h3 className="font-display text-xl font-bold">The workspace is ready. The integration is next.</h3><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">This section belongs to your Backoffice. Its data service is not connected here yet, so no records, activity, or service health are shown. Your existing workspaces remain available below.</p><dl className="mt-6 grid gap-5 border-t border-border/50 pt-5 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Integration boundary</dt><dd className="mt-2 text-sm font-medium">{workspace.boundary}</dd></div><div><dt className="text-xs text-muted-foreground">Access requirement</dt><dd className="mt-2 font-mono text-sm text-primary">{workspace.capability}</dd></div></dl></div>
      </section>
      {related.length ? <section aria-label="Related modules"><h2 className="mb-3 font-display text-lg font-bold">In this workspace</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{related.map((item) => <SurfaceLink key={item.id} id={item.id} />)}</div></section> : null}
      {existing.length ? <section aria-label="Existing workspaces"><h2 className="mb-3 font-display text-lg font-bold">Keep working</h2><div className="grid gap-3 xl:grid-cols-3">{existing.map((item) => <SurfaceLink key={item.id} id={item.id} />)}</div></section> : null}
    </div>
  )
}
