"use client"

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "motion/react"
import {
  LayoutDashboard, Users, Building2, DollarSign, Wrench, HardDrive,
  Settings, ChevronRight, ChevronLeft, Bell, Search, X, Check, AlertTriangle, Info,
  Clock, LogOut, Activity, Zap, Shield, TrendingUp, FileText,
  GitBranch, Package, ClipboardCheck, CircleSlash, BarChart3,
  UserCircle, BellRing, Lock, Monitor, CreditCard, Mail, Send, ScanLine,
  MoreHorizontal,
} from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { CabinetBidEngineSection } from "./cabinet-bid-engine-section"
import type { BackofficeSectionId } from "@/lib/backoffice-access"

const BidsTrackerSection = dynamic(
  () => import("./bids-tracker-section").then((module) => module.BidsTrackerSection),
  {
    loading: () => (
      <div className="surface-card flex min-h-72 items-center justify-center rounded-2xl text-xs text-muted-foreground">
        Loading Bids Tracker module…
      </div>
    ),
  },
)

const VisionSection = dynamic(
  () => import("./vision-section").then((module) => module.VisionSection),
  {
    loading: () => (
      <div className="surface-card flex min-h-72 items-center justify-center rounded-2xl text-xs text-muted-foreground">
        Loading Vision workspace…
      </div>
    ),
  },
)

const DriveSection = dynamic(
  () => import("./drive-section").then((module) => module.DriveSection),
  {
    loading: () => (
      <div className="surface-card flex min-h-72 items-center justify-center rounded-2xl text-xs text-muted-foreground">
        Loading Vulpine Drive…
      </div>
    ),
  },
)

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

// ─── Navigation ─────────────────────────────────────────────────

type SectionId = BackofficeSectionId

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
      { id: "bidstracker", label: "Bids Tracker", icon: BarChart3 },
      { id: "vision", label: "Cabinet Brain", icon: ScanLine },
      { id: "emailblaster", label: "Email Blaster", icon: Mail },
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
      transition={{ ...SPRING, delay: 0.08 }}
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
      transition={{ ...SPRING, delay }}
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
      transition={{ ...SPRING, delay }}
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
  { id: 1, type: "success", title: "Core Modules Connected", message: "Bids Tracker, Vision, and Vulpine Drive are connected to their authoritative services.", time: "just now", read: false },
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
          transition={SPRING}
          className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 max-h-[70dvh] overflow-hidden rounded-2xl surface-elevated glow-teal-sm sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[400px] sm:max-h-[30rem]"
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
                <button onClick={onMarkAllRead} className="min-h-11 px-2 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80">
                  Mark all read
                </button>
              )}
              <button onClick={onClose} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-accent" aria-label="Close notifications">
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
                transition={{ ...SPRING, delay: i * 0.025 }}
                onClick={() => onMarkRead(notif.id)}
                className={`flex min-h-20 w-full items-start gap-3.5 border-b border-border/30 p-4 text-left transition-colors hover:bg-accent/30 ${!notif.read ? "bg-primary/[0.04]" : ""}`}
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
        transition={SPRING}
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
        transition={SPRING}
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

// ─── Section: Email Blaster ─────────────────────────────────────

const EMAIL_BLASTER_STAGES = [
  { id: "audience", label: "Audience", icon: Users, description: "Select contact lists, companies, filters, tags, and saved segments." },
  { id: "template", label: "Template", icon: FileText, description: "Choose or draft reusable email templates for outbound campaigns." },
  { id: "sender", label: "Sender", icon: UserCircle, description: "Configure sender profile, reply-to address, and domain verification." },
  { id: "compliance", label: "Compliance", icon: Shield, description: "Validate unsubscribe rules, suppression lists, sender identity, and send limits." },
  { id: "suppressions", label: "Suppressions", icon: X, description: "Review and manage global suppression lists before any send." },
  { id: "batch", label: "Batch Queue", icon: Package, description: "Prepare controlled send batches and monitor pending delivery jobs." },
  { id: "send-review", label: "Send Review", icon: Send, description: "Final human review and approval gate before any outbound job runs." },
  { id: "delivery", label: "Delivery", icon: Check, description: "Track sent, failed, bounced, opened, replied, and suppressed outcomes." },
]

const EMAIL_ZONES = [
  { label: "Audience Builder", description: "Select contacts, companies, filters, tags, and saved segments.", icon: Users },
  { label: "Template Center", description: "Choose or draft reusable email templates for outbound campaigns.", icon: FileText },
  { label: "Compliance Gate", description: "Validate unsubscribe rules, suppression lists, sender identity, and send limits.", icon: Shield },
  { label: "Batch Queue", description: "Prepare controlled send batches and monitor pending delivery jobs.", icon: Package },
  { label: "Delivery Monitor", description: "Track sent, failed, bounced, opened, replied, and suppressed outcomes.", icon: Activity },
  { label: "Review & Launch", description: "Human review area before any outbound email job is allowed to send.", icon: ClipboardCheck },
]

function EmailBlasterSection() {
  const [activeStage, setActiveStage] = useState<string | null>(null)

  return (
    <div className={`flex flex-col gap-5 ${SECTION_MIN_H}`}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="rounded-2xl surface-card p-5 lg:p-7 relative overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <GlowOrb className="w-64 h-64 -top-32 -right-32 bg-primary/5" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center glow-teal-sm shrink-0">
                <Mail className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground font-display tracking-tight">Email Blaster</h2>
                <p className="text-[11px] text-muted-foreground font-sans">Bulk outbound email workflow shell</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed max-w-xl">
              Audience selection, templates, compliance checks, suppression rules, batch sending, and delivery tracking will be built in later phases. This shell defines the layout and workflow stages ready for backend wiring.
            </p>
          </div>
          <PlaceholderBadge label="Shell" />
        </div>
      </motion.div>

      {/* Workflow stage rail */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.08 }}
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
          {EMAIL_BLASTER_STAGES.map((stage, i) => {
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
            const stage = EMAIL_BLASTER_STAGES.find((s) => s.id === activeStage)
            if (!stage) return null
            const Icon = stage.icon
            return (
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={SPRING}
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

      {/* Placeholder content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EMAIL_ZONES.map((zone, i) => {
          const Icon = zone.icon
          return (
            <motion.div
              key={zone.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.12 + i * 0.04 }}
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

      {/* Compliance warning */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.28 }}
        className="rounded-2xl surface-card p-5 flex items-start gap-4 border border-amber-500/20 bg-amber-500/[0.03]"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="size-4 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-foreground font-display tracking-tight">Sending Disabled</p>
          <p className="text-xs text-muted-foreground font-sans mt-1 leading-relaxed">
            No emails can be sent from this shell. Sending will remain disabled until backend mail transport, suppression handling, unsubscribe logic, sender verification, and audit logging are implemented.
          </p>
        </div>
      </motion.div>
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
        transition={SPRING}
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
          transition={{ ...SPRING, delay: 0.08 }}
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
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/signed-out" })}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-fin-loss/70 hover:text-fin-loss hover:bg-fin-loss/5 transition-all duration-200 w-full text-left font-sans"
            >
              <LogOut className="size-4" />Sign Out
            </button>
          </nav>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.14 }}
          className="rounded-2xl surface-card p-5 lg:p-7 lg:col-span-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING}
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

const SECTION_COMPONENTS: Record<SectionId, React.ComponentType> = {
  dashboard: DashboardSection,
  leads: LeadsSection,
  contacts: ContactsSection,
  companies: CompaniesSection,
  revenue: RevenueSection,
  autobid: CabinetBidEngineSection,
  bidstracker: BidsTrackerSection,
  vision: VisionSection,
  emailblaster: EmailBlasterSection,
  drive: DriveSection,
  settings: SettingsSection,
}

// ─── Sidebar ────────────────────────────────────────────────────

function Sidebar({
  activeSection,
  onNavigate,
  isOpen,
  onToggle,
  allowedSections,
}: {
  activeSection: SectionId
  onNavigate: (id: SectionId) => void
  isOpen: boolean
  onToggle: () => void
  allowedSections?: readonly SectionId[]
}) {
  return (
    <motion.aside
      animate={{ width: isOpen ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className={`relative z-20 hidden shrink-0 flex-col overflow-hidden border-r border-border/50 bg-card/70 lg:flex ${isOpen ? "translate-x-0" : "lg:translate-x-0"}`}
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
                    transition={SPRING}
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
                  transition={SPRING}
                  className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground/50 px-2.5 pt-3 pb-1.5 font-sans select-none"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {!isOpen && <div className="h-2" />}

            {/* Nav items */}
            {group.items.filter((item) => !allowedSections || allowedSections.includes(item.id)).map((item) => {
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
                        transition={SPRING}
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
                transition={SPRING}
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

function MobileNavigation({
  activeSection,
  onNavigate,
  allowedSections,
}: {
  activeSection: SectionId
  onNavigate: (id: SectionId) => void
  allowedSections?: readonly SectionId[]
}) {
  const primaryIds: SectionId[] = ["dashboard", "bidstracker", "vision", "drive"]
  const primary = primaryIds
    .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is NavItem => Boolean(item && (!allowedSections || allowedSections.includes(item.id))))
  const available = ALL_NAV_ITEMS.filter((item) => !allowedSections || allowedSections.includes(item.id))
  const moreIsActive = !primaryIds.includes(activeSection)

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto grid h-[4.75rem] max-w-lg grid-cols-5 items-stretch">
        {primary.map((item) => {
          const Icon = item.icon
          const active = item.id === activeSection
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              {active ? <motion.span layoutId="mobile-nav-indicator" transition={SPRING} className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgba(45,212,191,.55)]" /> : null}
              <Icon className="size-5" />
              <span className="max-w-[4.5rem] truncate">{item.label.replace("Vulpine ", "")}</span>
            </button>
          )
        })}

        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold ${moreIsActive ? "text-primary" : "text-muted-foreground"}`}>
              {moreIsActive ? <motion.span layoutId="mobile-nav-indicator" transition={SPRING} className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-primary shadow-[0_0_10px_rgba(45,212,191,.55)]" /> : null}
              <MoreHorizontal className="size-5" />
              <span>More</span>
            </button>
          </DrawerTrigger>
          <DrawerContent className="border-border/70 bg-card/98 pb-[env(safe-area-inset-bottom)]">
            <DrawerHeader className="px-5 pb-3 text-left">
              <DrawerTitle className="font-display text-lg font-black">All modules</DrawerTitle>
              <DrawerDescription>Everything in Vulpine Backoffice, one thumb away.</DrawerDescription>
            </DrawerHeader>
            <div className="grid max-h-[58dvh] grid-cols-2 gap-2 overflow-y-auto px-4 pb-5">
              {available.map((item) => {
                const Icon = item.icon
                const active = item.id === activeSection
                return (
                  <DrawerClose key={item.id} asChild>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-bold ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 bg-background/30 text-foreground"}`}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icon className="size-5" /></span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </DrawerClose>
                )
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  )
}

// ─── Root Component ─────────────────────────────────────────────

export default function VulpineCommandCenter({
  initialSection = "dashboard",
  allowedSections,
  driveCanWrite = false,
}: {
  initialSection?: SectionId
  allowedSections?: readonly SectionId[]
  driveCanWrite?: boolean
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifItems, setNotifItems] = useState(NOTIF_ITEMS)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }, [])

  const handleNavigation = useCallback(
    (sectionId: SectionId) => {
      if (allowedSections && !allowedSections.includes(sectionId)) return
      if (sectionId === activeSection) return
      if (sectionId === "bidstracker" || sectionId === "vision" || sectionId === "drive") {
        router.push(sectionId === "vision" ? "/bids/vision" : sectionId === "drive" ? "/drive" : "/bids/tracker")
        return
      }
      setIsTransitioning(true)
      setTimeout(() => {
        setActiveSection(sectionId)
        setIsTransitioning(false)
      }, 180)
    },
    [activeSection, allowedSections, router],
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
  const ActiveNavIcon = activeNav?.icon ?? Wrench

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground">
      {/* Atmospheric background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.03] blur-[120px] animate-float" style={{ background: C.teal }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.02] blur-[100px] animate-float" style={{ background: C.azure, animationDelay: "3s" }} />
      </div>

      {/* Top header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-xl sticky top-0 z-30 relative">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 glow-teal-sm"><ActiveNavIcon className="size-5 text-primary" /></div>
            <div className="min-w-0"><p className="truncate font-display text-sm font-black text-foreground">{activeNav?.label}</p><p className="text-[10px] text-muted-foreground">Vulpine Backoffice</p></div>
          </div>

          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
            <span className="font-semibold text-foreground/50">Command Center</span>
            <ChevronRight className="size-3 text-muted-foreground/40" />
            <span className="font-semibold text-foreground">{activeNav?.label}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button className="flex size-11 items-center justify-center rounded-xl hover:bg-accent/50" aria-label="Search">
              <Search className="size-4 text-muted-foreground" />
            </button>
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative flex size-11 items-center justify-center rounded-xl hover:bg-accent/50"
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
              className="hidden size-11 items-center justify-center rounded-xl hover:bg-accent/50 sm:flex"
              aria-label="Settings"
              onClick={() => handleNavigation("settings")}
              disabled={Boolean(allowedSections && !allowedSections.includes("settings"))}
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
          allowedSections={allowedSections}
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 overflow-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 lg:px-8 lg:py-8 xl:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isTransitioning ? 0.3 : 1, y: isTransitioning ? 6 : 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={SPRING}
              >
                {activeSection === "drive" ? <DriveSection canWrite={driveCanWrite} /> : <ActiveComponent />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className={`hidden border-t border-border/40 lg:shrink-0 ${activeSection === "vision" ? "lg:hidden" : "lg:block"}`}>
            <div className="px-5 lg:px-8 xl:px-10 py-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-sans">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-fin-gain animate-pulse-soft" />
                  <span className="font-medium">Vulpine Command Center — Shell</span>
                </div>
                <span className="font-mono text-muted-foreground/60">v0.2.0 — Bids, Cabinet Brain &amp; Drive live</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
      <MobileNavigation activeSection={activeSection} onNavigate={handleNavigation} allowedSections={allowedSections} />
    </div>
  )
}
