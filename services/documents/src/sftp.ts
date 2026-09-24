import type { Archiver } from "archiver"
import SftpClient from "ssh2-sftp-client"
import type { DirectoryListing, DriveItem } from "@vulpine/contracts"
import { logAccess } from "./access-log.js"
import { positiveIntegerEnv, requiredEnv } from "./config.js"
import { joinRemotePath, normalizeRemotePath, parentPath } from "./path.js"

type SftpListItem = {
  name: string
  type: string
  size: number
  modifyTime?: number
  rights?: { user?: string; group?: string; other?: string }
}

type ArchiverFactory = (format: "zip", options?: { zlib?: { level?: number } }) => Archiver

function sftpConfig() {
  return {
    host: requiredEnv("SFTP_HOST", "STORAGE_BOX_HOST"),
    port: positiveIntegerEnv("SFTP_PORT", 22),
    username: requiredEnv("SFTP_USERNAME", "STORAGE_BOX_USERNAME", "STORAGE_BOX_USER"),
    password: requiredEnv("SFTP_PASSWORD", "STORAGE_BOX_PASSWORD", "HETZNER_STORAGE_BOX_PASSWORD"),
    readyTimeout: 20_000,
  }
}

async function withSftp<T>(handler: (client: SftpClient) => Promise<T>) {
  const client = new SftpClient("vulpine-documents")
  try {
    await client.connect(sftpConfig())
    return await handler(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

function toDriveItem(basePath: string, item: SftpListItem): DriveItem {
  return {
    name: item.name,
    path: joinRemotePath(basePath, item.name),
    type: item.type === "d" ? "folder" : item.type === "-" ? "file" : "unknown",
    size: item.size,
    modifiedAt: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
    ...(item.rights ? { rights: `${item.rights.user ?? ""}${item.rights.group ?? ""}${item.rights.other ?? ""}` } : {}),
  }
}

function hasUsableName(item: SftpListItem) {
  const name = item.name?.trim().replaceAll("/", "").replaceAll("\\", "")
  return Boolean(name && name !== "." && name !== "..")
}

export async function listDirectory(inputPath: string): Promise<DirectoryListing> {
  const path = normalizeRemotePath(inputPath)
  return withSftp(async (client) => {
    const items = ((await client.list(path)) as SftpListItem[])
      .filter(hasUsableName)
      .map((item) => toDriveItem(path, item))
      .sort((left, right) => left.type === right.type
        ? left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" })
        : left.type === "folder" ? -1 : 1)
    await logAccess(path, "view").catch(() => undefined)
    return { path, parent: parentPath(path), items, generatedAt: new Date().toISOString() }
  })
}

export async function listAllItems() {
  const maxItems = positiveIntegerEnv("RECENT_SCAN_MAX_ITEMS", 2_500)
  const maxDepth = positiveIntegerEnv("RECENT_SCAN_MAX_DEPTH", 10)
  return withSftp(async (client) => {
    const allItems: DriveItem[] = []
    const queue: Array<{ path: string; depth: number }> = [{ path: "/", depth: 0 }]
    while (queue.length && allItems.length < maxItems) {
      const current = queue.shift()!
      let rawItems: SftpListItem[] = []
      try {
        rawItems = (await client.list(current.path)) as SftpListItem[]
      } catch {
        continue
      }
      for (const rawItem of rawItems) {
        if (!hasUsableName(rawItem)) continue
        const item = toDriveItem(current.path, rawItem)
        allItems.push(item)
        if (item.type === "folder" && current.depth < maxDepth) queue.push({ path: item.path, depth: current.depth + 1 })
        if (allItems.length >= maxItems) break
      }
    }
    return allItems
  })
}

export async function readFile(inputPath: string) {
  const path = normalizeRemotePath(inputPath)
  return withSftp(async (client) => {
    const data = await client.get(path)
    if (Buffer.isBuffer(data)) return data
    if (typeof data === "string") return Buffer.from(data)
    throw new Error("Unable to read remote file")
  })
}

export async function writeFile(inputPath: string, data: Buffer) {
  const path = normalizeRemotePath(inputPath)
  await withSftp(async (client) => {
    await client.put(data, path)
  })
  await logAccess(path, "modify").catch(() => undefined)
}

function archiveToBuffer(archive: Archiver) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    archive.on("warning", reject)
    archive.on("error", reject)
    archive.on("end", () => resolve(Buffer.concat(chunks)))
  })
}

export async function zipDirectory(inputPath: string) {
  const rootPath = normalizeRemotePath(inputPath)
  const maxFiles = positiveIntegerEnv("FOLDER_DOWNLOAD_MAX_FILES", 750)
  return withSftp(async (client) => {
    const archiver = (await import("archiver")).default as unknown as ArchiverFactory
    const archive = archiver("zip", { zlib: { level: 6 } })
    const archiveDone = archiveToBuffer(archive)
    const queue = [rootPath]
    let filesAdded = 0
    while (queue.length) {
      const currentPath = queue.shift()!
      const rawItems = (await client.list(currentPath)) as SftpListItem[]
      for (const rawItem of rawItems) {
        if (!hasUsableName(rawItem)) continue
        const item = toDriveItem(currentPath, rawItem)
        if (item.type === "folder") {
          queue.push(item.path)
          continue
        }
        if (item.type !== "file") continue
        filesAdded += 1
        if (filesAdded > maxFiles) throw new Error(`Folder download exceeds the ${maxFiles}-file limit.`)
        const data = await client.get(item.path)
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data))
        archive.append(buffer, { name: item.path.slice(rootPath.length).replace(/^\/+/, "") || item.name })
      }
    }
    await archive.finalize()
    const zip = await archiveDone
    await logAccess(rootPath, "view").catch(() => undefined)
    return zip
  })
}
