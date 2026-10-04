"use client"

import { useDeferredValue, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Layers3, Search, ShieldCheck } from "lucide-react"
import { OperationsWorkspace } from "./operations-workspace"
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
      <OperationsWorkspace id="dashboard" compact />
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

export function PlatformModuleSection({ id }: { id: PlatformModuleId; allowedSections?: readonly PlatformModuleId[] }) {
  return <OperationsWorkspace id={id} />
}
