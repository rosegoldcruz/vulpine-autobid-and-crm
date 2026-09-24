export type DriveItemType = "file" | "folder" | "unknown"

export type DrivePreviewKind = "image" | "video" | "model" | "pdf" | "text" | "file" | "folder"

export type DriveItem = {
  name: string
  path: string
  type: DriveItemType
  size: number
  modifiedAt: string | null
  rights?: string
}

export type RecentDriveItem = DriveItem & {
  lastAccessedAt: string | null
  recentAt: string | null
}

export type DirectoryListing = {
  path: string
  parent: string
  items: DriveItem[]
  generatedAt: string
}

export type DriveRecentListing = {
  items: RecentDriveItem[]
  generatedAt: string
}

export type DriveUploadResult = {
  uploaded: number
}

export type DriveHealth = {
  status: "ok"
  service: "vulpine-documents"
  generatedAt: string
}
