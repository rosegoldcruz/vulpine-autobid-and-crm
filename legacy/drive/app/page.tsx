"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Camera,
  CheckSquare,
  Clock3,
  Download,
  Files,
  FileText,
  Folder,
  Home,
  Loader2,
  Mail,
  MoreVertical,
  Search,
  Star,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import SessionActions from "@/app/components/session-actions";
import type { DirectoryListing, DriveItem, RecentDriveItem } from "@/types/files";

type Tab = "home" | "favorites" | "recent" | "files";

const navItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "home", label: "HOME", icon: Home },
  { id: "favorites", label: "FAVORITES", icon: Star },
  { id: "recent", label: "RECENT", icon: Clock3 },
  { id: "files", label: "FILES", icon: Files },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "No timestamp";
  return dateFormatter.format(new Date(value));
}

function encodedPath(path: string) {
  return encodeURIComponent(path);
}

function downloadUrl(path: string) {
  return `/api/download?path=${encodedPath(path)}`;
}

function itemDownloadUrl(item: DriveItem | RecentDriveItem) {
  const folderParam = item.type === "folder" ? "&type=folder" : "";
  return `${downloadUrl(item.path)}${folderParam}`;
}

function previewUrl(path: string) {
  return `/api/preview?path=${encodedPath(path)}`;
}

function extension(path: string) {
  const name = path.split("/").at(-1) ?? "";
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function previewKind(item: DriveItem | RecentDriveItem) {
  if (item.type === "folder") return "folder";
  const ext = extension(item.path);
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["glb", "gltf"].includes(ext)) return "model";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "txt", "md", "csv", "json"].includes(ext)) return "document";
  return "file";
}

function triggerDownload(item: DriveItem | RecentDriveItem) {
  window.location.href = itemDownloadUrl(item);
}

function PreviewTile({ item, large = false }: { item: DriveItem | RecentDriveItem; large?: boolean }) {
  const kind = previewKind(item);
  const baseClass = large
    ? "h-72 w-full overflow-hidden rounded-lg border border-white/10 bg-black/30"
    : "h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30";
  const iconClass = large ? "h-12 w-12" : "h-6 w-6";

  if (kind === "image") {
    return (
      <div className={baseClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl(item.path)} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={baseClass}>
        <video src={previewUrl(item.path)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
      </div>
    );
  }

  const Icon =
    kind === "folder" ? Folder : kind === "model" ? Box : kind === "pdf" || kind === "document" ? FileText : Files;
  const label = kind === "model" ? "GLB" : kind === "pdf" ? "PDF" : kind === "document" ? extension(item.path).toUpperCase() || "DOC" : "";

  return (
    <div className={`${baseClass} grid place-items-center text-vulpine-brass`}>
      <div className="text-center">
        <Icon className={`${iconClass} mx-auto`} />
        {label ? <div className="mt-1 text-[10px] font-semibold tracking-normal text-stone-300">{label}</div> : null}
      </div>
    </div>
  );
}

function NavButton({
  id,
  activeTab,
  label,
  icon: Icon,
  onSelect,
  desktop = false,
}: {
  id: Tab;
  activeTab: Tab;
  label: string;
  icon: typeof Home;
  onSelect: (tab: Tab) => void;
  desktop?: boolean;
}) {
  const active = id === activeTab;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={[
        "group flex items-center justify-center gap-2 rounded-full border text-[11px] font-semibold tracking-normal transition",
        desktop ? "h-11 w-full px-4 justify-start" : "h-11 min-w-0 flex-1 px-2",
        active
          ? "border-vulpine-orange bg-vulpine-orange text-black shadow-ember"
          : "border-white/10 bg-white/[0.04] text-stone-300 hover:border-vulpine-brass/50 hover:text-white",
      ].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className={desktop ? "" : "hidden min-[390px]:inline"}>{label}</span>
    </button>
  );
}

function ItemActions({
  item,
  isFavorite,
  onToggleFavorite,
  onMore,
}: {
  item: DriveItem | RecentDriveItem;
  isFavorite: boolean;
  onToggleFavorite: (item: DriveItem | RecentDriveItem) => void;
  onMore: (item: DriveItem | RecentDriveItem) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(item);
        }}
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-vulpine-brass transition hover:border-vulpine-brass/60 hover:text-vulpine-orange"
        aria-label="Toggle favorite"
      >
        <Star className={`h-4 w-4 ${isFavorite ? "fill-vulpine-brass text-vulpine-brass" : ""}`} />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMore(item);
        }}
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-stone-300 transition hover:border-white/30 hover:text-white"
        aria-label="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

function FolderCard({
  item,
  onOpen,
  isFavorite,
  onToggleFavorite,
  onMore,
}: {
  item: DriveItem;
  onOpen: (path: string) => void;
  isFavorite: boolean;
  onToggleFavorite: (item: DriveItem | RecentDriveItem) => void;
  onMore: (item: DriveItem | RecentDriveItem) => void;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-ember">
      <div className="mb-4 flex items-start justify-between gap-3">
        <PreviewTile item={item} />
        <ItemActions item={item} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} onMore={onMore} />
      </div>
      <button type="button" onClick={() => onOpen(item.path)} className="block w-full text-left">
        <h3 className="break-words text-lg font-semibold leading-tight text-stone-50">{item.name}</h3>
        <p className="mt-2 text-sm text-stone-400">Modified {formatDate(item.modifiedAt)}</p>
      </button>
    </article>
  );
}

function FileRow({
  item,
  onOpen,
  context,
  isFavorite,
  onToggleFavorite,
  onMore,
}: {
  item: DriveItem | RecentDriveItem;
  onOpen: (item: DriveItem | RecentDriveItem) => void;
  context?: string;
  isFavorite: boolean;
  onToggleFavorite: (item: DriveItem | RecentDriveItem) => void;
  onMore: (item: DriveItem | RecentDriveItem) => void;
}) {
  const recentItem = "recentAt" in item ? item : null;
  const timestampLabel = recentItem?.lastAccessedAt === recentItem?.recentAt ? "Accessed" : "Modified";

  return (
    <div className="flex min-h-[72px] items-center gap-3 border-b border-white/[0.07] px-1 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <PreviewTile item={item} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-stone-100">{item.name}</span>
          <span className="mt-1 block truncate text-xs text-stone-500">
            {item.type === "folder" ? "Folder" : formatBytes(item.size)} ·{" "}
            {recentItem ? `${timestampLabel} ${formatDate(recentItem.recentAt)}` : `Modified ${formatDate(item.modifiedAt)}`}
          </span>
          {context ? <span className="mt-1 block truncate text-xs text-vulpine-brass/80">{context}</span> : null}
        </span>
      </button>
      <ItemActions item={item} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} onMore={onMore} />
    </div>
  );
}

function ActionModal({
  item,
  isFavorite,
  onClose,
  onToggleFavorite,
  onSelect,
}: {
  item: DriveItem | RecentDriveItem;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (item: DriveItem | RecentDriveItem) => void;
  onSelect: (item: DriveItem | RecentDriveItem) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 p-3 backdrop-blur-sm sm:place-items-center">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#12110f] p-4 shadow-ember">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{item.name}</h2>
            <p className="mt-1 truncate text-xs text-stone-500">{item.path}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              triggerDownload(item);
              onClose();
            }}
            className="flex h-12 items-center gap-3 rounded-lg border border-white/10 px-4 text-left text-sm text-stone-100 transition hover:border-vulpine-brass/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4 text-vulpine-brass" />
            {item.type === "folder" ? "Download folder as ZIP" : "Download"}
          </button>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex h-12 items-center gap-3 rounded-lg border border-white/10 px-4 text-left text-sm text-stone-100 transition hover:border-vulpine-brass/50"
          >
            <CheckSquare className="h-4 w-4 text-vulpine-brass" />
            Select
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            className="flex h-12 items-center gap-3 rounded-lg border border-white/10 px-4 text-left text-sm text-stone-100 transition hover:border-vulpine-brass/50"
          >
            <Star className={`h-4 w-4 text-vulpine-brass ${isFavorite ? "fill-vulpine-brass" : ""}`} />
            {isFavorite ? "Remove favorite" : "Favorite"}
          </button>
          <a
            href={`mailto:?subject=${encodeURIComponent(item.name)}&body=${encodeURIComponent(item.path)}`}
            className="flex h-12 items-center gap-3 rounded-lg border border-white/10 px-4 text-left text-sm text-stone-100 transition hover:border-vulpine-brass/50"
          >
            <Mail className="h-4 w-4 text-vulpine-brass" />
            Email
          </a>
          <button
            type="button"
            className="flex h-12 items-center gap-3 rounded-lg border border-red-400/20 px-4 text-left text-sm text-red-100 opacity-70"
            disabled
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function QuickViewModal({
  item,
  onClose,
  onDownload,
}: {
  item: DriveItem | RecentDriveItem;
  onClose: () => void;
  onDownload: (item: DriveItem | RecentDriveItem) => void;
}) {
  const kind = previewKind(item);
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 p-3 backdrop-blur-sm sm:place-items-center">
      <section className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#12110f] p-4 shadow-ember">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{item.name}</h2>
            <p className="mt-1 truncate text-xs text-stone-500">{item.path}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        {kind === "image" ? <PreviewTile item={item} large /> : null}
        {kind === "video" ? (
          <video src={previewUrl(item.path)} controls className="h-72 w-full rounded-lg border border-white/10 bg-black object-contain" />
        ) : null}
        {kind !== "image" && kind !== "video" ? <PreviewTile item={item} large /> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onDownload(item)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-vulpine-orange px-4 text-sm font-semibold text-black"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full border border-white/10 px-4 text-sm font-medium text-stone-200"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
      <h2 className="text-xl font-semibold text-stone-50">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">{body}</p>
    </section>
  );
}

export default function VulpineDrive() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [path, setPath] = useState("/");
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [recentItems, setRecentItems] = useState<RecentDriveItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");
  const [favoritePaths, setFavoritePaths] = useState<string[]>([]);
  const [actionItem, setActionItem] = useState<DriveItem | RecentDriveItem | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<DriveItem | RecentDriveItem | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const loadPath = useCallback(async (nextPath: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(nextPath)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load folder");
      setListing(data);
      setPath(data.path);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load folder");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError("");
    try {
      const response = await fetch("/api/recent", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load recent items");
      setRecentItems(data.items ?? []);
    } catch (loadError) {
      setRecentError(loadError instanceof Error ? loadError.message : "Unable to load recent items");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const logItemAccess = useCallback(async (item: DriveItem | RecentDriveItem) => {
    await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path, action: "view" }),
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadPath("/");
  }, [loadPath]);

  useEffect(() => {
    if (activeTab === "recent") {
      void loadRecent();
    }
  }, [activeTab, loadRecent]);

  const folders = useMemo(() => listing?.items.filter((item) => item.type === "folder") ?? [], [listing]);
  const filteredItems = useMemo(() => {
    const items = listing?.items ?? [];
    if (!query.trim()) return items;
    const needle = query.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [listing, query]);

  const crumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    const result = [{ label: "Root", path: "/" }];
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      result.push({ label: part, path: current });
    }
    return result;
  }, [path]);

  const favoriteSet = useMemo(() => new Set(favoritePaths), [favoritePaths]);
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const favoriteItems = useMemo(() => {
    const byPath = new Map<string, DriveItem | RecentDriveItem>();
    for (const item of listing?.items ?? []) byPath.set(item.path, item);
    for (const item of recentItems) byPath.set(item.path, item);
    return favoritePaths.map((favoritePath) => byPath.get(favoritePath)).filter(Boolean) as Array<DriveItem | RecentDriveItem>;
  }, [favoritePaths, listing, recentItems]);

  function toggleFavorite(item: DriveItem | RecentDriveItem) {
    setFavoritePaths((current) =>
      current.includes(item.path) ? current.filter((pathValue) => pathValue !== item.path) : [item.path, ...current],
    );
  }

  function toggleSelected(item: DriveItem | RecentDriveItem) {
    setSelectedPaths((current) =>
      current.includes(item.path) ? current.filter((pathValue) => pathValue !== item.path) : [item.path, ...current],
    );
  }

  function openItem(item: DriveItem | RecentDriveItem) {
    void logItemAccess(item);
    if (item.type === "folder") {
      setActiveTab("files");
      void loadPath(item.path);
    } else {
      setQuickViewItem(item);
      if (activeTab === "recent") void loadRecent();
    }
  }

  function goBack() {
    if (listing?.parent) void loadPath(listing.parent);
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("path", path);
      Array.from(fileList).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to upload file");
      await loadPath(path);
      if (activeTab === "recent") await loadRecent();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  return (
    <main className="noise min-h-screen pb-24 text-stone-100 md:pb-0">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl md:pl-72">
        <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-black/25 p-5 backdrop-blur-xl md:block">
          <div className="mb-8">
            <p className="text-sm font-semibold text-vulpine-orange">Vulpine</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">Drive</h1>
          </div>
          <nav className="space-y-2" aria-label="Primary">
            {navItems.map((item) => (
              <NavButton key={item.id} {...item} activeTab={activeTab} onSelect={setActiveTab} desktop />
            ))}
          </nav>
        </aside>

        <section className="w-full px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-vulpine-brass">vault.vulpine.llc sibling</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white">Vulpine Drive</h1>
              <p className="mt-2 text-sm text-stone-400">Private SFTP mirror for u611776.your-storagebox.de</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <SessionActions />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void uploadFiles(event.currentTarget.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => void uploadFiles(event.currentTarget.files)}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/20 text-vulpine-brass transition hover:border-vulpine-brass/50 disabled:opacity-50"
                aria-label="Capture photo"
              >
                <Camera className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="grid h-11 w-11 place-items-center rounded-full border border-vulpine-orange/40 bg-vulpine-orange text-black shadow-ember"
                aria-label="Upload"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </button>
            </div>
          </header>

          {error ? (
            <div className="mb-5 rounded-lg border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          {activeTab === "home" ? (
            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-50">Storage Box Root</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    {loading ? "Reading folders..." : `${folders.length} folders at root`}
                  </p>
                </div>
              </div>
              {loading ? (
                <div className="flex h-48 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <Loader2 className="h-6 w-6 animate-spin text-vulpine-orange" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {folders.map((item) => (
                    <FolderCard
                      key={item.path}
                      item={item}
                      isFavorite={favoriteSet.has(item.path)}
                      onToggleFavorite={toggleFavorite}
                      onMore={setActionItem}
                      onOpen={(nextPath) => {
                        setActiveTab("files");
                        void loadPath(nextPath);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "files" ? (
            <section>
              <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.045] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={!listing?.parent}
                    className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-sm font-medium text-stone-200 transition hover:border-vulpine-brass/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  {selectedPaths.length ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPaths([])}
                      className="h-10 rounded-full border border-vulpine-brass/40 px-3 text-sm text-vulpine-brass"
                    >
                      {selectedPaths.length} selected
                    </button>
                  ) : null}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                  {crumbs.map((crumb, index) => (
                    <button
                      key={crumb.path}
                      type="button"
                      onClick={() => void loadPath(crumb.path)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-stone-200 transition hover:border-vulpine-brass/50"
                    >
                      {crumb.label}
                      {index < crumbs.length - 1 ? "" : ""}
                    </button>
                  ))}
                </div>
                <label className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-stone-300">
                  <Search className="h-4 w-4 text-vulpine-brass" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search filenames in this folder"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-stone-600"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                {loading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-vulpine-orange" />
                  </div>
                ) : filteredItems.length ? (
                  filteredItems.map((item) => (
                    <div key={item.path} className={selectedSet.has(item.path) ? "rounded-lg bg-vulpine-orange/10" : ""}>
                      <FileRow
                        item={item}
                        onOpen={openItem}
                        isFavorite={favoriteSet.has(item.path)}
                        onToggleFavorite={toggleFavorite}
                        onMore={setActionItem}
                      />
                    </div>
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-stone-500">No files matched this view.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "recent" ? (
            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-50">Recent</h2>
                  <p className="mt-1 text-sm text-stone-400">
                    {recentLoading ? "Scanning Storage Box..." : `${recentItems.length} files and folders, newest first`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadRecent()}
                  className="h-10 rounded-full border border-white/10 px-4 text-sm font-medium text-stone-200 transition hover:border-vulpine-brass/50"
                >
                  Refresh
                </button>
              </div>

              {recentError ? (
                <div className="mb-5 rounded-lg border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
                  {recentError}
                </div>
              ) : null}

              <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                {recentLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-vulpine-orange" />
                  </div>
                ) : recentItems.length ? (
                  recentItems.map((item) => (
                    <FileRow
                      key={item.path}
                      item={item}
                      onOpen={openItem}
                      isFavorite={favoriteSet.has(item.path)}
                      onToggleFavorite={toggleFavorite}
                      onMore={setActionItem}
                      context={item.path === "/" ? "/" : item.path.split("/").slice(0, -1).join("/") || "/"}
                    />
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-stone-500">No recent items found.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "favorites" ? (
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-stone-50">Favorites</h2>
                <p className="mt-1 text-sm text-stone-400">{favoriteItems.length} pinned items in this browser session</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                {favoriteItems.length ? (
                  favoriteItems.map((item) => (
                    <FileRow
                      key={item.path}
                      item={item}
                      onOpen={openItem}
                      isFavorite={favoriteSet.has(item.path)}
                      onToggleFavorite={toggleFavorite}
                      onMore={setActionItem}
                      context={item.path === "/" ? "/" : item.path.split("/").slice(0, -1).join("/") || "/"}
                    />
                  ))
                ) : (
                  <p className="p-8 text-center text-sm text-stone-500">Tap a star to pin files and folders here.</p>
                )}
              </div>
            </section>
          ) : null}
        </section>
      </div>

      {actionItem ? (
        <ActionModal
          item={actionItem}
          isFavorite={favoriteSet.has(actionItem.path)}
          onClose={() => setActionItem(null)}
          onToggleFavorite={(item) => {
            toggleFavorite(item);
            setActionItem(null);
          }}
          onSelect={(item) => {
            toggleSelected(item);
            setActionItem(null);
          }}
        />
      ) : null}

      {quickViewItem ? (
        <QuickViewModal
          item={quickViewItem}
          onClose={() => setQuickViewItem(null)}
          onDownload={(item) => triggerDownload(item)}
        />
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#090806]/92 px-3 pb-3 pt-2 backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg gap-2">
          {navItems.map((item) => (
            <NavButton key={item.id} {...item} activeTab={activeTab} onSelect={setActiveTab} />
          ))}
        </div>
      </nav>
    </main>
  );
}
