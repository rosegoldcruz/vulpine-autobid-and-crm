"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  Archive,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  Grid2X2,
  HardDrive,
  Home,
  List,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Star,
  Upload,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import type { DriveItem, RecentDriveItem } from "@vulpine/contracts"
import { DriveClient } from "@vulpine/sdk"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

type DriveTab = "home" | "files" | "recent" | "favorites"
type DriveRecord = DriveItem | RecentDriveItem

const TABS: Array<{ id: DriveTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "files", label: "Files" },
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
]
const PAGE_SIZE = 50

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

function formatBytes(bytes: number) {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value: string | null) {
  if (!value) return "No timestamp"
  return dateFormatter.format(new Date(value))
}

function extension(path: string) {
  const name = path.split("/").at(-1) ?? ""
  const index = name.lastIndexOf(".")
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ""
}

function fileKind(item: DriveRecord) {
  if (item.type === "folder") return "Folder"
  const ext = extension(item.path)
  if (ext === "pdf") return "PDF"
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) return "Image"
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "Video"
  if (["xlsx", "xls", "csv"].includes(ext)) return "Spreadsheet"
  if (["zip", "7z", "rar", "tar", "gz"].includes(ext)) return "Archive"
  if (["doc", "docx", "txt", "md", "json"].includes(ext)) return "Document"
  return ext ? ext.toUpperCase() : "File"
}

function FileTypeIcon({ item, className = "size-4" }: { item: DriveRecord; className?: string }) {
  const kind = fileKind(item)
  const Icon = kind === "Folder" ? Folder
    : kind === "PDF" || kind === "Document" ? FileText
      : kind === "Image" ? FileImage
        : kind === "Video" ? Film
          : kind === "Spreadsheet" ? FileSpreadsheet
            : kind === "Archive" ? Archive
              : File
  const color = kind === "Folder" ? "text-sky-400"
    : kind === "PDF" ? "text-red-400"
      : kind === "Image" ? "text-violet-400"
        : kind === "Video" ? "text-purple-400"
          : kind === "Spreadsheet" ? "text-emerald-400"
            : kind === "Archive" ? "text-amber-400"
              : "text-muted-foreground"
  return <Icon className={`${className} ${color}`} aria-hidden="true" />
}

function PreviewSurface({ item, drive }: { item: DriveRecord; drive: DriveClient }) {
  const kind = fileKind(item)
  const previewUrl = drive.previewUrl(item.path)
  if (kind === "Image") {
    return (
      <div className="relative h-[min(62vh,34rem)] overflow-hidden rounded-xl border border-border/60 bg-black/30">
        <Image src={previewUrl} alt={item.name} fill unoptimized sizes="(max-width: 768px) 90vw, 720px" className="object-contain" />
      </div>
    )
  }
  if (kind === "Video") {
    return <video src={previewUrl} controls className="h-[min(62vh,34rem)] w-full rounded-xl border border-border/60 bg-black object-contain" />
  }
  if (kind === "PDF") {
    return <object data={previewUrl} type="application/pdf" className="h-[min(62vh,34rem)] w-full rounded-xl border border-border/60 bg-white"><p className="p-6 text-sm text-foreground">PDF preview unavailable. Download the file to view it.</p></object>
  }
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-border/60 bg-background/40">
      <div className="text-center">
        <FileTypeIcon item={item} className="mx-auto size-14" />
        <p className="mt-4 text-xs font-semibold text-muted-foreground">Preview is not available for this file type.</p>
      </div>
    </div>
  )
}

function QuickView({ item, drive, onClose }: { item: DriveRecord; drive: DriveClient; onClose: () => void }) {
  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-3xl border-border/70 bg-card/98">
        <DrawerHeader className="px-5 pb-3 text-left">
          <DrawerTitle className="truncate font-display text-lg font-black">{item.name}</DrawerTitle>
          <DrawerDescription className="truncate font-mono text-[10px]">{item.path}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4"><PreviewSurface item={item} drive={drive} /></div>
        <DrawerFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
          <DrawerClose asChild><button type="button" className="h-12 rounded-xl border border-border/60 px-4 text-xs font-semibold text-muted-foreground">Close</button></DrawerClose>
          <a href={drive.downloadUrl(item.path, item.type === "folder")} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground"><Download className="size-4" /> Download</a>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ActionMenu({
  item,
  favorite,
  selected,
  drive,
  onClose,
  onFavorite,
  onSelect,
  onPreview,
}: {
  item: DriveRecord
  favorite: boolean
  selected: boolean
  drive: DriveClient
  onClose: () => void
  onFavorite: () => void
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent className="mx-auto max-w-md border-border/70 bg-card/98 pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="px-5 text-left">
          <DrawerTitle className="truncate font-display text-lg font-black">{item.name}</DrawerTitle>
          <DrawerDescription className="truncate font-mono text-[10px]">{item.path}</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4 pb-5">
          {item.type !== "folder" ? <button type="button" onClick={onPreview} className="flex h-12 items-center gap-3 rounded-xl border border-border/60 px-4 text-left text-sm font-semibold text-foreground"><FileText className="size-5 text-primary" /> Preview</button> : null}
          <a href={drive.downloadUrl(item.path, item.type === "folder")} className="flex h-12 items-center gap-3 rounded-xl border border-border/60 px-4 text-left text-sm font-semibold text-foreground"><Download className="size-5 text-primary" /> {item.type === "folder" ? "Download folder as ZIP" : "Download"}</a>
          <button type="button" onClick={onFavorite} className="flex h-12 items-center gap-3 rounded-xl border border-border/60 px-4 text-left text-sm font-semibold text-foreground"><Star className={`size-5 text-primary ${favorite ? "fill-primary" : ""}`} /> {favorite ? "Remove favorite" : "Add to favorites"}</button>
          <button type="button" onClick={onSelect} className="flex h-12 items-center gap-3 rounded-xl border border-border/60 px-4 text-left text-sm font-semibold text-foreground"><Check className="size-5 text-primary" /> {selected ? "Clear selection" : "Select item"}</button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function DriveSection({ canWrite = false }: { canWrite?: boolean }) {
  const drive = useMemo(() => new DriveClient(), [])
  const [activeTab, setActiveTab] = useState<DriveTab>("home")
  const [path, setPath] = useState("/")
  const [items, setItems] = useState<DriveItem[]>([])
  const [recentItems, setRecentItems] = useState<RecentDriveItem[]>([])
  const [knownItems, setKnownItems] = useState<Record<string, DriveRecord>>({})
  const [loading, setLoading] = useState(true)
  const [recentLoading, setRecentLoading] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [favorites, setFavorites] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [actionItem, setActionItem] = useState<DriveRecord | null>(null)
  const [previewItem, setPreviewItem] = useState<DriveRecord | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const remember = useCallback((records: readonly DriveRecord[]) => {
    setKnownItems((current) => {
      const next = { ...current }
      records.forEach((item) => { next[item.path] = item })
      return next
    })
  }, [])

  const loadPath = useCallback(async (nextPath: string) => {
    setLoading(true)
    setError("")
    try {
      const listing = await drive.list(nextPath)
      setPath(listing.path)
      setItems(listing.items)
      remember(listing.items)
      setLastRefreshed(new Date())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Drive")
    } finally {
      setLoading(false)
    }
  }, [drive, remember])

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    setError("")
    try {
      const listing = await drive.recent()
      setRecentItems(listing.items)
      remember(listing.items)
      setLastRefreshed(new Date())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load recent files")
    } finally {
      setRecentLoading(false)
    }
  }, [drive, remember])

  useEffect(() => { void loadPath("/") }, [loadPath])
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("vulpine-drive-favorites")
      if (stored) setFavorites(JSON.parse(stored) as string[])
    } catch {
      setFavorites([])
    }
  }, [])

  const crumbs = useMemo(() => {
    const result = [{ label: "Root", path: "/" }]
    let current = ""
    path.split("/").filter(Boolean).forEach((part) => {
      current += `/${part}`
      result.push({ label: part, path: current })
    })
    return result
  }, [path])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const favoriteItems = useMemo(() => favorites.map((favorite) => knownItems[favorite]).filter(Boolean), [favorites, knownItems])
  const folders = useMemo(() => items.filter((item) => item.type === "folder"), [items])
  const sourceItems = useMemo<DriveRecord[]>(
    () => activeTab === "recent" ? recentItems : activeTab === "favorites" ? favoriteItems : items,
    [activeTab, favoriteItems, items, recentItems],
  )
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? sourceItems.filter((item) => item.name.toLowerCase().includes(needle) || item.path.toLowerCase().includes(needle)) : sourceItems
  }, [query, sourceItems])
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE))
  const pagedItems = useMemo(() => visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page, visibleItems])

  useEffect(() => { setPage(1) }, [activeTab, path, query])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  function selectTab(tab: DriveTab) {
    setActiveTab(tab)
    setQuery("")
    if (tab === "home") void loadPath("/")
    if (tab === "recent") void loadRecent()
  }

  function toggleFavorite(item: DriveRecord) {
    const adding = !favoriteSet.has(item.path)
    setFavorites((current) => {
      const next = adding ? [item.path, ...current] : current.filter((pathValue) => pathValue !== item.path)
      window.localStorage.setItem("vulpine-drive-favorites", JSON.stringify(next))
      return next
    })
    toast.success(adding ? "Added to favorites" : "Removed from favorites", { description: item.name })
  }

  function toggleSelected(item: DriveRecord) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      return next
    })
  }

  function openItem(item: DriveRecord) {
    void drive.logAccess(item.path).catch(() => undefined)
    if (item.type === "folder") {
      setActiveTab("files")
      setQuery("")
      void loadPath(item.path)
    } else {
      setPreviewItem(item)
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploading(true)
    setError("")
    const files = Array.from(fileList)
    const pending = toast.loading(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`)
    try {
      const result = await drive.upload(path, files)
      toast.success(`${result.uploaded} file${result.uploaded === 1 ? "" : "s"} uploaded`, { id: pending, description: path === "/" ? "Saved to Drive root." : `Saved to ${path}.` })
      await loadPath(path)
      if (activeTab === "recent") await loadRecent()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to upload files"
      setError(message)
      toast.error("Upload failed", { id: pending, description: message })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      if (cameraInputRef.current) cameraInputRef.current.value = ""
    }
  }

  const busy = loading || recentLoading

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col gap-5 pb-24 text-foreground lg:pb-0">
      <Toaster position="bottom-center" theme="dark" richColors closeButton />
      {canWrite ? <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void uploadFiles(event.currentTarget.files)} /> : null}
      {canWrite ? <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void uploadFiles(event.currentTarget.files)} /> : null}

      <section className="surface-card overflow-hidden rounded-2xl">
        <header className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 glow-teal-sm"><HardDrive className="size-5 text-primary" /></div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Vulpine Drive</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Secure project files and document storage.</p>
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {canWrite ? <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/15 disabled:opacity-50">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload files</button> : null}
            {canWrite ? <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading} className="flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs font-semibold text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50"><Camera className="size-4" /> Capture photo</button> : null}
            <div className="ml-1 hidden min-w-28 items-center gap-2 border-l border-border/50 pl-3 sm:flex">
              <span className={`size-2 rounded-full ${error ? "bg-destructive" : busy ? "animate-pulse bg-amber-400" : "bg-fin-gain"}`} />
              <div><p className="text-[10px] font-semibold text-foreground">{error ? "Drive degraded" : busy ? "Syncing" : "Drive ready"}</p><p className="text-[9px] text-muted-foreground">{lastRefreshed ? "Live service" : "Connecting"}</p></div>
            </div>
          </div>
        </header>

        <nav aria-label="Drive views" className="flex items-center gap-1 overflow-x-auto border-t border-border/40 px-4 py-3 lg:px-6">
          {TABS.map((tab) => <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={`h-11 shrink-0 rounded-xl px-4 text-xs font-semibold transition-colors ${activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}>{tab.label}</button>)}
        </nav>

        <div className="border-t border-border/40 px-5 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground">
              <Home className="size-4 shrink-0" />
              {crumbs.map((crumb, index) => <div key={crumb.path} className="flex shrink-0 items-center gap-1.5"><ChevronRight className="size-3 text-muted-foreground/50" /><button type="button" onClick={() => { setActiveTab("files"); void loadPath(crumb.path) }} className={`min-w-11 rounded-lg px-2 ${index === crumbs.length - 1 ? "font-semibold text-foreground" : "hover:text-foreground"}`}>{crumb.label}</button></div>)}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background/30 px-3 text-muted-foreground focus-within:border-primary/40 lg:w-72"><Search className="size-4 shrink-0" /><span className="sr-only">Search files and folders</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files and folders" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-xs" /></label>
              <button type="button" onClick={() => activeTab === "recent" ? void loadRecent() : void loadPath(path)} disabled={busy} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50" aria-label="Refresh Drive"><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /></button>
              <div className="hidden items-center rounded-xl border border-border/60 p-1 sm:flex"><button type="button" onClick={() => setViewMode("list")} className={`rounded-lg p-1.5 ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} aria-label="List view"><List className="size-4" /></button><button type="button" onClick={() => setViewMode("grid")} className={`rounded-lg p-1.5 ${viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} aria-label="Grid view"><Grid2X2 className="size-4" /></button></div>
            </div>
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive-foreground">Vulpine Drive unavailable: {error}</div> : null}

      {activeTab === "home" && folders.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-sm font-bold text-foreground">Folders</h2><button type="button" onClick={() => setActiveTab("files")} className="min-w-11 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground hover:text-primary">Show all</button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {folders.slice(0, 6).map((folder, index) => <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 360, damping: 30, delay: index * 0.025 }} key={folder.path} type="button" onClick={() => openItem(folder)} className="surface-card group min-h-28 rounded-2xl p-4 text-left transition-colors hover:border-primary/25 hover:bg-primary/[0.03]"><FileTypeIcon item={folder} className="size-7" /><p className="mt-4 truncate text-sm font-bold text-foreground group-hover:text-primary">{folder.name}</p><p className="mt-1 text-[11px] text-muted-foreground/60">Modified {formatDate(folder.modifiedAt)}</p></motion.button>)}
          </div>
        </section>
      ) : null}

      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-4 sm:px-5">
          <div><h2 className="font-display text-sm font-bold text-foreground">{activeTab === "recent" ? "Recent files" : activeTab === "favorites" ? "Favorites" : path === "/" ? "Drive contents" : path.split("/").at(-1)}</h2><p className="mt-0.5 text-[10px] text-muted-foreground">{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}{selected.size ? ` · ${selected.size} selected` : ""}</p></div>
          {selected.size ? <button type="button" onClick={() => setSelected(new Set())} className="h-11 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[10px] font-bold text-primary">Clear selection</button> : null}
        </div>

        {busy ? <div className="flex min-h-72 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Loading secure storage…</div> : (
          <>
            <div className="divide-y divide-border/40 md:hidden">
              {pagedItems.map((item, index) => (
                <motion.article
                  key={item.path}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, delay: Math.min(index, 8) * 0.025 }}
                  className={`flex min-h-20 items-center gap-2 px-4 py-3 ${selected.has(item.path) ? "bg-primary/[0.08]" : "bg-transparent"}`}
                >
                  <button type="button" onClick={() => openItem(item)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl text-left">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/30"><FileTypeIcon item={item} className="size-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-tight text-foreground">{item.name}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground/60">{fileKind(item)} · {item.type === "folder" ? "Folder" : formatBytes(item.size)} · {formatDate("recentAt" in item ? item.recentAt : item.modifiedAt)}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => setActionItem(item)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent/50 hover:text-foreground" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="size-5" /></button>
                </motion.article>
              ))}
            </div>

            {viewMode === "grid" ? (
              <div className="hidden gap-3 p-4 md:grid md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {pagedItems.map((item) => <article key={item.path} className={`rounded-xl border p-4 transition-colors ${selected.has(item.path) ? "border-primary/30 bg-primary/[0.06]" : "border-border/50 bg-background/20"}`}><div className="flex items-start justify-between"><button type="button" onClick={() => openItem(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/30"><FileTypeIcon item={item} className="size-5" /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-foreground">{item.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{fileKind(item)} · {formatBytes(item.size)}</p></div></button><button type="button" onClick={() => setActionItem(item)} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="size-4" /></button></div></article>)}
              </div>
            ) : (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead><tr className="border-b border-border/50 bg-muted/10 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"><th className="w-10 px-4 py-3"><span className="sr-only">Select</span></th><th className="px-2 py-3">Name</th><th className="w-32 px-4 py-3">Type</th><th className="w-28 px-4 py-3">Size</th><th className="w-52 px-4 py-3">Modified</th><th className="w-32 px-4 py-3 text-right">Actions</th></tr></thead>
                  <tbody>{pagedItems.map((item) => {
                    const isSelected = selected.has(item.path)
                    const isFavorite = favoriteSet.has(item.path)
                    return <tr key={item.path} className={`border-b border-border/30 last:border-0 ${isSelected ? "bg-primary/[0.08]" : "hover:bg-accent/20"}`}><td className="px-4 py-2.5"><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(item)} className="size-3.5 accent-[oklch(0.78_0.16_182)]" aria-label={`Select ${item.name}`} /></td><td className="px-2 py-2.5"><button type="button" onClick={() => openItem(item)} className="flex max-w-md items-center gap-3 text-left"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/25"><FileTypeIcon item={item} /></span><span className="truncate text-xs font-semibold text-foreground hover:text-primary">{item.name}</span></button></td><td className="px-4 py-2.5 text-xs text-muted-foreground">{fileKind(item)}</td><td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{item.type === "folder" ? "—" : formatBytes(item.size)}</td><td className="px-4 py-2.5 text-[11px] text-muted-foreground">{formatDate("recentAt" in item ? item.recentAt : item.modifiedAt)}</td><td className="px-4 py-2.5"><div className="flex justify-end gap-1"><button type="button" onClick={() => toggleFavorite(item)} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-primary" aria-label={`${isFavorite ? "Remove" : "Add"} ${item.name} ${isFavorite ? "from" : "to"} favorites`}><Star className={`size-4 ${isFavorite ? "fill-primary text-primary" : ""}`} /></button><a href={drive.downloadUrl(item.path, item.type === "folder")} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-primary" aria-label={`Download ${item.name}`}><Download className="size-4" /></a><button type="button" onClick={() => setActionItem(item)} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground" aria-label={`Actions for ${item.name}`}><MoreHorizontal className="size-4" /></button></div></td></tr>
                  })}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!busy && !visibleItems.length ? <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10"><Folder className="size-5 text-primary" /></div><div><p className="text-xs font-bold text-foreground">{query ? "No files matched your search" : activeTab === "favorites" ? "No favorites yet" : "This folder is empty"}</p><p className="mt-1 text-[10px] text-muted-foreground">{activeTab === "favorites" ? "Star a file or folder to keep it here." : query ? "Try a different filename or folder." : "Upload a file to get started."}</p></div></div> : null}
        {!busy && visibleItems.length > PAGE_SIZE ? <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 text-[10px] text-muted-foreground sm:px-5"><span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleItems.length)} of {visibleItems.length}</span><div className="flex items-center gap-1"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="flex size-11 items-center justify-center rounded-xl border border-border/60 hover:bg-accent/40 disabled:opacity-35" aria-label="Previous page"><ChevronLeft className="size-4" /></button><span className="px-2 font-mono">{page} / {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="flex size-11 items-center justify-center rounded-xl border border-border/60 hover:bg-accent/40 disabled:opacity-35" aria-label="Next page"><ChevronRight className="size-4" /></button></div></div> : null}
      </section>

      {path !== "/" && activeTab === "files" ? <button type="button" onClick={() => { const parent = path.split("/").slice(0, -1).join("/") || "/"; void loadPath(parent) }} className="fixed bottom-6 right-6 z-20 hidden h-11 items-center gap-2 rounded-xl border border-primary/20 bg-card/95 px-4 text-xs font-bold text-primary shadow-xl backdrop-blur-xl hover:bg-primary/10 lg:flex"><ArrowLeft className="size-4" /> Back</button> : null}

      <div className="mobile-action-dock lg:hidden">
        {path !== "/" && activeTab === "files" ? <button type="button" onClick={() => { const parent = path.split("/").slice(0, -1).join("/") || "/"; void loadPath(parent) }} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-bold text-foreground"><ArrowLeft className="size-4" /> Back</button> : null}
        {canWrite ? <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-50">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload</button> : null}
        {canWrite ? <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading} className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-50" aria-label="Capture photo"><Camera className="size-5" /></button> : null}
        <button type="button" onClick={() => activeTab === "recent" ? void loadRecent() : void loadPath(path)} disabled={busy} className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground disabled:opacity-50" aria-label="Refresh Drive"><RefreshCw className={`size-5 ${busy ? "animate-spin" : ""}`} /></button>
      </div>

      {actionItem ? <ActionMenu item={actionItem} favorite={favoriteSet.has(actionItem.path)} selected={selected.has(actionItem.path)} drive={drive} onClose={() => setActionItem(null)} onFavorite={() => { toggleFavorite(actionItem); setActionItem(null) }} onSelect={() => { toggleSelected(actionItem); setActionItem(null) }} onPreview={() => { setPreviewItem(actionItem); setActionItem(null) }} /> : null}
      {previewItem ? <QuickView item={previewItem} drive={drive} onClose={() => setPreviewItem(null)} /> : null}
    </div>
  )
}
