"use client"

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutDashboard, Users, Building2, DollarSign, Wrench, HardDrive,
  Settings, ChevronRight, ChevronLeft, Bell, Search, X, Check, AlertTriangle, Info,
  Clock, LogOut, Activity, Zap, Shield, TrendingUp, Upload, FileText,
  GitBranch, Package, Calculator, ClipboardCheck, Download, CircleSlash,
  UserCircle, BellRing, Lock, Monitor, CreditCard, Menu,
} from "lucide-react"

// ─── Design tokens ──────────────────────────────────────────────

const CARD_SHADOW =
  "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px"

const SECTION_MIN_H = "min-h-[calc(100vh-4.5rem)]"

const C = {
  teal: "oklch(0.78 0.16 182)",
  azure: "oklch(0.68 0.14 245)",
  amber: "oklch(0.76 0.14 75)",
  rose: "oklch(0.62 0.22 18)",
}

const SPRING = { type: "spring" as const, stiffness: 400, damping: 32 }
const EASE_OUT = [0.16, 1, 0.3, 1] as const

// ─── Navigation ─────────────────────────────────────────────────

type SectionId = "dashboard" | "leads" | "contacts" | "companies" | "revenue" | "autobid" | "drive" | "settings"

interface NavItem {
  id: SectionId
  label: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "CORE",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "CRM",
    items: [
      { id: "leads", label: "Leads", icon: Users },
      { id: "contacts", label: "Contacts", icon: UserCircle },
      { id: "companies", label: "Companies", icon: Building2 },
    ],
  },
  {
    label: "REVENUE",
    items: [
      { id: "revenue", label: "Revenue", icon: DollarSign },
      { id: "autobid", label: "Bid Engine", icon: Wrench },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { id: "drive", label: "Vulpine Drive", icon: HardDrive },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
]

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

// ─── Shared UI ──────────────────────────────────────────────────

function GlowOrb({ className }: { className?: string }) {
  return <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />
}

function SectionPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}
      className={`rounded-2xl surface-card p-5 lg:p-6 ${className}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      {children}
    </motion.div>
  )
}

function SectionHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h3 className="text-sm font-bold text-foreground tracking-tight font-display">{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function PlaceholderBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] uppercase bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-lg font-mono">
      <div className="size-1.5 rounded-full bg-primary/60" />
      {label}
    </span>
  )
}

function PlaceholderModule({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ElementType
  title: string
  description: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      className="relative overflow-hidden rounded-2xl surface-card p-5 lg:p-6 flex flex-col gap-4"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 glow-teal-sm">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-foreground font-display tracking-tight">{title}</h4>
          <p className="text-[11px] text-muted-foreground font-sans mt-0.5">{description}</p>
        </div>
      </div>
      <div className="h-px bg-border/40" />
      <div className="flex items-center justify-between">
        <PlaceholderBadge label="Coming in next phase" />
        <CircleSlash className="size-3.5 text-muted-foreground/40" />
      </div>
    </motion.div>
  )
}

function StatShell({
  label,
  delay = 0,
  icon: Icon,
}: {
  label: string
  delay?: number
  icon?: React.ElementType
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      className="relative overflow-hidden rounded-2xl surface-card p-4 lg:p-5"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.03] pointer-events-none">
        {Icon && <Icon className="size-24 -translate-y-4 translate-x-4" />}
      </div>
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-3 font-sans">{label}</p>
      <div className="h-8 rounded-lg bg-muted/30 w-3/4 animate-pulse" />
      <div className="h-4 rounded-md bg-muted/20 w-1/2 mt-2 animate-pulse" />
    </motion.div>
  )
}

// ─── Notification types ─────────────────────────────────────────

type NotifType = "success" | "warning" | "info"

const NOTIF_ITEMS: Array<{
  id: number; type: NotifType; title: string; message: string; time: string; read: boolean
}> = [
  { id: 1, type: "info", title: "Command Center Ready", message: "Vulpine Command Center shell is live and ready for module wiring.", time: "just now", read: false },
  { id: 2, type: "warning", title: "Backend Not Connected", message: "NEXT_PUBLIC_API_BASE_URL is not set. Modules will load once backend is wired.", time: "just now", read: false },
  { id: 3, type: "success", title: "Bid Engine Shell Created", message: "Workflow stage placeholders are ready for backend integration.", time: "1 min ago", read: true },
]

function NotificationIcon({ type }: { type: NotifType }) {
  if (type === "success") return <Check className="size-3.5" />
  if (type === "warning") return <AlertTriangle className="size-3.5" />
  return <Info className="size-3.5" />
}

function NotificationPanel({
  isOpen, onClose, items, onMarkRead, onMarkAllRead,
}: {
  isOpen: boolean
  onClose: () => void
  items: typeof NOTIF_ITEMS
  onMarkRead: (id: number) => void
  onMarkAllRead: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  const unreadCount = items.filter((n) => !n.read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="absolute top-full right-0 mt-3 w-[400px] max-h-[30rem] rounded-2xl surface-elevated overflow-hidden z-50 glow-teal-sm"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between p-5 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-bold text-foreground font-display tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} className="text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-1 transition-colors">
                  Mark all read
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors" aria-label="Close notifications">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[23rem]">
            {items.map((notif, i) => (
              <motion.button
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                onClick={() => onMarkRead(notif.id)}
                className={`w-full flex items-start gap-3.5 p-4 text-left border-b border-border/30 hover:bg-accent/30 transition-all duration-200 ${!notif.read ? "bg-primary/[0.04]" : ""}`}
              >
                <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  notif.type === "success" ? "bg-fin-gain/12 text-fin-gain" : notif.type === "warning" ? "bg-chart-3/12 text-chart-3" : "bg-chart-2/12 text-chart-2"
                }`}>
                  <NotificationIcon type={notif.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground truncate font-sans">{notif.title}</p>
                    {!notif.read && <div className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse-soft" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed font-sans">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1 font-mono">
                    <Clock className="size-2.5" />{notif.time}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Section: Dashboard ─────────────────────────────────────────

function DashboardSection() {
  const kpis = [
    { label: "Active Leads", icon: Users },
    { label: "Open Bids", icon: Wrench },
    { label: "Pipeline Value", icon: DollarSign },
    { label: "Closed This Month", icon: TrendingUp },
  ]

  const modules = [
    { icon: Users, title: "Lead Pipeline", description: "Track inbound leads, qualification status, and follow-up cadences." },
    { icon: Activity, title: "Activity Feed", description: "Live log of CRM events, bid updates, and system actions." },
    { icon: TrendingUp, title: "Revenue Summary", description: "Monthly and YTD revenue breakdown across all projects." },
    { icon: Zap, title: "Quick Actions", description: "Shortcuts to create a lead, start a bid, or upload a document." },
  ]

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl surface-card p-5 lg:p-6 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <GlowOrb className="w-48 h-48 -top-24 -right-24 bg-primary/6" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-foreground font-display tracking-tight">Command Overview</h2>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Live KPIs, activity, and pipeline summary will populate here once the backend is connected.
            </p>
          </div>
          <PlaceholderBadge label="Shell" />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <StatShell key={kpi.label} label={kpi.label} icon={kpi.icon} delay={i * 0.06} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modules.map((mod, i) => (
          <PlaceholderModule key={mod.title} icon={mod.icon} title={mod.title} description={mod.description} delay={0.1 + i * 0.06} />
        ))}
      </div>
    </div>
  )
}

// ─── Section: Leads ─────────────────────────────────────────────

function LeadsSection() {
  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <SectionPanel>
        <SectionHeader title="Lead Management" subtitle="Inbound lead tracking, qualification, and follow-up workflow." />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
            <Users className="size-7 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-bold text-foreground font-display">Lead management module placeholder.</p>
            <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
              Lead table, pipeline stages, qualification scoring, and follow-up sequences will be built here in a later phase.
            </p>
          </div>
          <PlaceholderBadge label="Not yet implemented" />
        </div>
      </SectionPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Users, title: "Lead Intake", description: "Manual entry and form-based lead capture." },
          { icon: Activity, title: "Lead Scoring", description: "Automated qualification based on engagement signals." },
          { icon: GitBranch, title: "Pipeline Stages", description: "Kanban-style lead lifecycle management." },
        ].map((mod, i) => (
          <PlaceholderModule key={mod.title} icon={mod.icon} title={mod.title} description={mod.description} delay={i * 0.07} />
        ))}
      </div>
    </div>
  )
}

// ─── Section: Contacts ──────────────────────────────────────────

function ContactsSection() {
  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <SectionPanel>
        <SectionHeader title="Contact Management" subtitle="People, relationships, and communication history." />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
            <UserCircle className="size-7 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-bold text-foreground font-display">Contact management module placeholder.</p>
            <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
              Contact directory, communication log, tagging, and relationship history will be built in a later phase.
            </p>
          </div>
          <PlaceholderBadge label="Not yet implemented" />
        </div>
      </SectionPanel>
    </div>
  )
}

// ─── Section: Companies ─────────────────────────────────────────

function CompaniesSection() {
  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <SectionPanel>
        <SectionHeader title="Company Management" subtitle="Organizations, deal history, and project associations." />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
            <Building2 className="size-7 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-bold text-foreground font-display">Company management module placeholder.</p>
            <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
              Company profiles, associated contacts, active deals, and project history will be built in a later phase.
            </p>
          </div>
          <PlaceholderBadge label="Not yet implemented" />
        </div>
      </SectionPanel>
    </div>
  )
}

// ─── Section: Revenue ───────────────────────────────────────────

function RevenueSection() {
  const kpis = [
    { label: "MTD Revenue", icon: DollarSign },
    { label: "YTD Revenue", icon: TrendingUp },
    { label: "Avg Deal Size", icon: Activity },
    { label: "Win Rate", icon: Shield },
  ]

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl surface-card p-5 lg:p-6 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <GlowOrb className="w-48 h-48 -top-24 -right-24 bg-primary/6" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-foreground font-display tracking-tight">Revenue</h2>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Revenue analytics, deal tracking, and financial reporting will populate here once the backend is connected.
            </p>
          </div>
          <PlaceholderBadge label="Shell" />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <StatShell key={kpi.label} label={kpi.label} icon={kpi.icon} delay={i * 0.06} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: TrendingUp, title: "Revenue Chart", description: "Monthly and quarterly revenue trend visualization." },
          { icon: DollarSign, title: "Deal Breakdown", description: "Revenue by project type, region, and sales rep." },
        ].map((mod, i) => (
          <PlaceholderModule key={mod.title} icon={mod.icon} title={mod.title} description={mod.description} delay={i * 0.08} />
        ))}
      </div>
    </div>
  )
}

// ─── Section: Bid Engine ────────────────────────────────────────

const BID_WORKFLOW_STAGES = [
  { id: "workbook", label: "Workbook", icon: FileText, description: "Load and parse uploaded project workbook files." },
  { id: "plans", label: "Plans", icon: GitBranch, description: "Architectural plans and drawing set ingestion." },
  { id: "unit-mix", label: "Unit Mix", icon: Package, description: "Room types, quantities, and cabinet configuration by unit." },
  { id: "takeoff", label: "Cabinet Takeoff", icon: ClipboardCheck, description: "Door and drawer count extraction per room per unit." },
  { id: "sku-mapping", label: "SKU Mapping", icon: Zap, description: "Map takeoff items to catalog SKUs and pricing tiers." },
  { id: "pricing", label: "Pricing", icon: Calculator, description: "Apply labor, material, and margin rules to generate bid totals." },
  { id: "qa", label: "QA", icon: Shield, description: "Validation checks, flag anomalies, and approval gate." },
  { id: "export", label: "Export", icon: Download, description: "Generate bid package, PDF summary, and CSV export." },
]

const BID_ZONES = [
  { label: "Ingestion Hub", description: "Upload project workbooks, plans, and supporting documents.", icon: Upload },
  { label: "Workflow Control Center", description: "Manage active bid jobs, monitor stage progress, and trigger re-runs.", icon: Activity },
  { label: "Workspace Draft Viewer", description: "Live preview of extracted data, unit mix, and pricing draft.", icon: FileText },
  { label: "Review & Export", description: "Final QA review, approval sign-off, and bid package export.", icon: ClipboardCheck },
]

function BidEngineSection() {
  const [activeStage, setActiveStage] = useState<string | null>(null)

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl surface-card p-5 lg:p-7 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <GlowOrb className="w-64 h-64 -top-32 -right-32 bg-primary/5" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center glow-teal-sm shrink-0">
                <Wrench className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground font-display tracking-tight">Bid Engine</h2>
                <p className="text-[11px] text-muted-foreground font-sans">Cabinet bidding workflow shell</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xl">
              Workbook, plans, unit mix, takeoff, pricing, QA, and export will be built in later phases. This shell defines the layout and workflow stages ready for backend wiring.
            </p>
          </div>
          <PlaceholderBadge label="Shell" />
        </div>
      </motion.div>

      {/* Workflow stage rail */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
        className="rounded-2xl surface-card p-5 lg:p-6"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground font-display tracking-tight">Workflow Stages</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">Select a stage to preview its placeholder.</p>
          </div>
        </div>

        {/* Stage tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
          {BID_WORKFLOW_STAGES.map((stage, i) => {
            const Icon = stage.icon
            const isActive = activeStage === stage.id
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(isActive ? null : stage.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 font-sans ${
                  isActive
                    ? "bg-primary/12 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-transparent"
                }`}
              >
                <span className="text-[10px] font-mono text-muted-foreground/50 mr-0.5">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-3.5" />
                {stage.label}
              </button>
            )
          })}
        </div>

        {/* Stage detail */}
        <AnimatePresence mode="wait">
          {activeStage && (() => {
            const stage = BID_WORKFLOW_STAGES.find((s) => s.id === activeStage)
            if (!stage) return null
            const Icon = stage.icon
            return (
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mt-4 rounded-xl bg-muted/20 border border-border/30 p-5 flex items-start gap-4"
              >
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 glow-teal-sm">
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-foreground font-display">{stage.label}</p>
                  <p className="text-xs text-muted-foreground font-sans mt-1 leading-relaxed">{stage.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <PlaceholderBadge label="Backend wiring required" />
                  </div>
                </div>
              </motion.div>
            )
          })()}
        </AnimatePresence>
      </motion.div>

      {/* Workflow zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BID_ZONES.map((zone, i) => {
          const Icon = zone.icon
          return (
            <motion.div
              key={zone.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.07, ease: EASE_OUT }}
              className="rounded-2xl surface-card p-5 flex flex-col gap-3"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-foreground font-display tracking-tight">{zone.label}</h4>
                  <p className="text-[11px] text-muted-foreground font-sans mt-0.5">{zone.description}</p>
                </div>
              </div>
              <div className="h-px bg-border/40" />
              <div className="rounded-lg bg-muted/20 border border-border/30 p-3 flex items-center justify-center min-h-[80px]">
                <p className="text-[11px] text-muted-foreground/50 font-sans text-center">
                  Content area — ready for backend wiring
                </p>
              </div>
              <PlaceholderBadge label="Placeholder" />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section: Vulpine Drive ─────────────────────────────────────

function DriveSection() {
  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <SectionPanel>
        <SectionHeader title="Vulpine Drive" subtitle="File storage, document management, and project assets." />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
            <HardDrive className="size-7 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-sm font-bold text-foreground font-display">Vulpine Drive module placeholder.</p>
            <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
              File browser, folder hierarchy, project document linking, and upload management will be built in a later phase.
            </p>
          </div>
          <PlaceholderBadge label="Not yet implemented" />
        </div>
      </SectionPanel>
    </div>
  )
}

// ─── Section: Settings ──────────────────────────────────────────

function SettingsSection() {
  const [activeTab, setActiveTab] = useState("profile")
  const tabs = [
    { id: "profile", label: "Profile", icon: UserCircle },
    { id: "notifications", label: "Notifications", icon: BellRing },
    { id: "security", label: "Security", icon: Lock },
    { id: "display", label: "Display", icon: Monitor },
    { id: "billing", label: "Billing", icon: CreditCard },
  ]

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl surface-card p-5 lg:p-6 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <GlowOrb className="w-48 h-48 -top-24 -right-24 bg-primary/6" />
        <h3 className="text-lg font-bold text-foreground font-display tracking-tight">Account Settings</h3>
        <p className="text-xs text-muted-foreground mt-1 font-sans">Manage your profile, preferences, and system configuration.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl surface-card p-3.5 lg:col-span-1"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 w-full text-left font-sans ${
                    activeTab === tab.id
                      ? "text-foreground bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight className="size-3.5 ml-auto text-primary" />}
                </button>
              )
            })}
            <div className="border-t border-border/50 my-2" />
            <button className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-fin-loss/70 hover:text-fin-loss hover:bg-fin-loss/5 transition-all duration-200 w-full text-left font-sans">
              <LogOut className="size-4" />Sign Out
            </button>
          </nav>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl surface-card p-5 lg:p-7 lg:col-span-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "profile" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
                    <UserCircle className="size-6 text-primary" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-bold text-foreground font-display">Profile settings placeholder.</p>
                    <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
                      User profile management will be built once authentication is wired.
                    </p>
                  </div>
                  <PlaceholderBadge label="Auth required" />
                </div>
              )}
              {activeTab === "notifications" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
                    <BellRing className="size-6 text-primary" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-bold text-foreground font-display">Notification preferences placeholder.</p>
                    <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
                      Notification channels and alert rules will be configured here.
                    </p>
                  </div>
                  <PlaceholderBadge label="Not yet implemented" />
                </div>
              )}
              {activeTab === "security" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
                    <Lock className="size-6 text-primary" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-bold text-foreground font-display">Security settings placeholder.</p>
                    <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
                      Two-factor authentication, sessions, and API key management will be built here.
                    </p>
                  </div>
                  <PlaceholderBadge label="Auth required" />
                </div>
              )}
              {activeTab === "display" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
                    <Monitor className="size-6 text-primary" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-bold text-foreground font-display">Display preferences placeholder.</p>
                    <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
                      Theme, density, and layout customization will be available here.
                    </p>
                  </div>
                  <PlaceholderBadge label="Not yet implemented" />
                </div>
              )}
              {activeTab === "billing" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center glow-teal-sm">
                    <CreditCard className="size-6 text-primary" />
                  </div>
                  <div className="text-center max-w-xs">
                    <p className="text-sm font-bold text-foreground font-display">Billing & subscription placeholder.</p>
                    <p className="text-xs text-muted-foreground mt-2 font-sans leading-relaxed">
                      Plan management, payment methods, and invoice history will be here.
                    </p>
                  </div>
                  <PlaceholderBadge label="Not yet implemented" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Section map ────────────────────────────────────────────────

const SECTION_COMPONENTS: Record<SectionId, React.FC> = {
  dashboard: DashboardSection,
  leads: LeadsSection,
  contacts: ContactsSection,
  companies: CompaniesSection,
  revenue: RevenueSection,
  autobid: BidEngineSection,
  drive: DriveSection,
  settings: SettingsSection,
}

// ─── Sidebar ────────────────────────────────────────────────────

function Sidebar({
  activeSection,
  onNavigate,
  isOpen,
  onToggle,
}: {
  activeSection: SectionId
  onNavigate: (id: SectionId) => void
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <motion.aside
      animate={{ width: isOpen ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="relative z-20 flex flex-col shrink-0 border-r border-border/50 bg-card/70 backdrop-blur-xl overflow-hidden"
      style={{ minHeight: "100%" }}
    >
      {/* Logo row */}
      <div className="flex items-center h-16 px-3.5 border-b border-border/50 shrink-0">
        {/* Expanded: logo + brand name left, collapse button right */}
        {isOpen ? (
          <>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="size-9 rounded-xl bg-primary/12 flex items-center justify-center glow-teal-sm shrink-0">
                <Wrench className="size-4 text-primary" />
              </div>
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="text-[15px] font-extrabold tracking-tight text-foreground font-display whitespace-nowrap overflow-hidden"
                  >
                    Vulpine
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onToggle}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all duration-200 shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="size-4" />
            </button>
          </>
        ) : (
          /* Collapsed: expand button centered, logo icon below if desired — or just the button */
          <div className="flex flex-col items-center w-full gap-1.5">
            <div className="size-8 rounded-lg bg-primary/12 flex items-center justify-center glow-teal-sm shrink-0">
              <Wrench className="size-3.5 text-primary" />
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all duration-200"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 flex flex-col gap-0.5" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {/* Section subheading */}
            <AnimatePresence>
              {isOpen && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground/50 px-2.5 pt-3 pb-1.5 font-sans select-none"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {!isOpen && <div className="h-2" />}

            {/* Nav items */}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = item.id === activeSection
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-3 w-full rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-all duration-200 font-sans group ${
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"
                      style={{ boxShadow: `0 0 8px 2px oklch(0.78 0.16 182 / 0.4)` }}
                      transition={SPRING}
                    />
                  )}
                  <Icon className={`size-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  <AnimatePresence>
                    {isOpen && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.16 }}
                        className="truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Tooltip when collapsed */}
                  {!isOpen && (
                    <span className="pointer-events-none absolute left-14 z-50 rounded-lg bg-popover border border-border/60 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap font-sans">
                      {item.label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: user */}
      <div className="border-t border-border/50 p-2 shrink-0">
        <div className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-accent/30 transition-colors cursor-pointer ${isOpen ? "" : "justify-center"}`}>
          <div className="size-8 rounded-xl bg-primary/12 flex items-center justify-center glow-teal-sm shrink-0">
            <span className="text-[11px] font-bold text-primary font-display">VC</span>
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.16 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-bold text-foreground truncate font-sans">Vulpine User</p>
                <p className="text-[10px] text-muted-foreground/60 truncate font-mono">command@vulpine.app</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

// ─── Root Component ─────────────────────────────────────────────

export default function VulpineCommandCenter() {
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifItems, setNotifItems] = useState(NOTIF_ITEMS)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleNavigation = useCallback(
    (sectionId: SectionId) => {
      if (sectionId === activeSection) return
      setIsTransitioning(true)
      setTimeout(() => {
        setActiveSection(sectionId)
        setIsTransitioning(false)
      }, 180)
    },
    [activeSection],
  )

  const handleMarkRead = useCallback((id: number) => {
    setNotifItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const handleMarkAllRead = useCallback(() => {
    setNotifItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const unreadCount = useMemo(() => notifItems.filter((n) => !n.read).length, [notifItems])
  const ActiveComponent = useMemo(() => SECTION_COMPONENTS[activeSection], [activeSection])
  const activeNav = useMemo(() => ALL_NAV_ITEMS.find((n) => n.id === activeSection), [activeSection])

  return (
    <div className="w-full min-h-screen bg-background text-foreground flex flex-col relative">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.03] blur-[120px] animate-float" style={{ background: C.teal }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.02] blur-[100px] animate-float" style={{ background: C.azure, animationDelay: "3s" }} />
      </div>

      {/* Top header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-xl sticky top-0 z-30 relative">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="size-4 text-muted-foreground" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
            <span className="font-semibold text-foreground/50">Command Center</span>
            <ChevronRight className="size-3 text-muted-foreground/40" />
            <span className="font-semibold text-foreground">{activeNav?.label}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button className="p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200" aria-label="Search">
              <Search className="size-4 text-muted-foreground" />
            </button>
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 relative"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="size-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={SPRING}
                    className="absolute -top-0.5 -right-0.5 size-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center font-mono"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </button>
              <NotificationPanel
                isOpen={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                items={notifItems}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
              />
            </div>
            <button
              className="p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200"
              aria-label="Settings"
              onClick={() => handleNavigation("settings")}
            >
              <Settings className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 relative z-10" style={{ minHeight: "calc(100vh - 4rem)" }}>
        {/* Sidebar */}
        <Sidebar
          activeSection={activeSection}
          onNavigate={handleNavigation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 px-5 lg:px-8 xl:px-10 py-6 lg:py-8 overflow-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isTransitioning ? 0.3 : 1, y: isTransitioning ? 6 : 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="border-t border-border/40 shrink-0">
            <div className="px-5 lg:px-8 xl:px-10 py-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-fin-gain animate-pulse-soft" />
                  <span className="font-medium">Vulpine Command Center — Shell</span>
                </div>
                <span className="font-mono text-muted-foreground/60">v0.1.0 — Backend not connected</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
