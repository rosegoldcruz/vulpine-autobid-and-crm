"use client"

import { ArrowUpRight } from "lucide-react"
import { erpnextUrl } from "@/lib/erpnext"

const workspaces = [
  ["Quotes & bids", "Create customer quotations and sales orders.", "/app/quotation"],
  ["Invoices", "Manage invoices, payment terms, and receivables.", "/app/sales-invoice"],
  ["Purchase orders", "Manage supplier purchasing and orders.", "/app/purchase-order"],
  ["Accounting", "Open your accounting workspace and company ledgers.", "/app/accounting"],
  ["Payroll", "Manage salary structures and payroll entries.", "/app/payroll-entry"],
  ["Time clock", "Record and review employee check-ins and check-outs.", "/app/employee-checkin"],
] as const

export function ErpnextSection() {
  const base = erpnextUrl(process.env.NEXT_PUBLIC_ERPNEXT_URL)
  return (
    <section className="space-y-6" data-testid="erpnext-workspace">
      <header className="rounded-2xl border border-border/60 bg-card/70 p-6">
        <p className="font-mono text-xs tracking-widest text-primary">FINANCE & OPERATIONS</p>
        <h1 className="mt-3 font-display text-3xl font-bold">ERPNext</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Accounting, purchasing, payroll, and employee time in one workspace. Sign in to ERPNext with your assigned account; your company and role permissions apply there.</p>
        {base ? <a href={`${base}/app`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Open ERPNext <ArrowUpRight className="size-4" /></a> : <p role="status" className="mt-5 text-sm text-muted-foreground">ERPNext is not connected yet. These workspaces will open when deployment is ready.</p>}
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workspaces.map(([label, description, path]) => (
          <article key={path} className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h2 className="font-display text-lg font-bold">{label}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            {base ? <a href={`${base}${path}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Open {label.toLowerCase()} <ArrowUpRight className="size-4" /></a> : <p className="mt-4 text-xs text-muted-foreground">Awaiting connection</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
