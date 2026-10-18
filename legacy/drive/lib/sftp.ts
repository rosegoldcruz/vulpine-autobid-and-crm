import type { Archiver } from "archiver";
import SftpClient from "ssh2-sftp-client";
import { logAccess } from "@/lib/access-log";
import { joinRemotePath, normalizeRemotePath, parentPath } from "@/lib/path";
import { serverEnv } from "@/lib/server-env";
import type { DirectoryListing, DriveItem } from "@/types/files";
import { sftpHostVerifier } from "@/lib/sftp-host-key";

type SftpListItem = {
  name: string;
  type: string;
  size: number;
  modifyTime?: number;
  rights?: { user?: string; group?: string; other?: string };
};

type ArchiverFactory = (format: "zip", options?: { zlib?: { level?: number } }) => Archiver;

function sftpConfig() {
  const username = serverEnv("SFTP_USERNAME", "STORAGE_BOX_USERNAME", "STORAGE_BOX_USER", "HETZNER_STORAGE_BOX_USERNAME") || "u611776";
  return {
    host: serverEnv("SFTP_HOST", "STORAGE_BOX_HOST") || "u611776.your-storagebox.de",
    port: Number(serverEnv("SFTP_PORT", "STORAGE_BOX_PORT") || "22"),
    username,
    password: serverEnv("SFTP_PASSWORD", "STORAGE_BOX_PASSWORD", "HETZNER_STORAGE_BOX_PASSWORD"),
    readyTimeout: 20000,
    hostVerifier: sftpHostVerifier(serverEnv("SFTP_HOST_KEY_SHA256")),
  };
}

function itemType(type: string): DriveItem["type"] {
  if (type === "d") return "folder";
  if (type === "-") return "file";
  return "unknown";
}

function rightsString(item: SftpListItem) {
  if (!item.rights) return undefined;
  return `${item.rights.user ?? ""}${item.rights.group ?? ""}${item.rights.other ?? ""}`;
}

async function withSftp<T>(handler: (client: SftpClient) => Promise<T>) {
  const client = new SftpClient("vulpine-drive");
  const config = sftpConfig();
  if (!config.password) {
    throw new Error("Missing SFTP password. Set SFTP_PASSWORD or STORAGE_BOX_PASSWORD.");
  }

  try {
    await client.connect(config);
    return await handler(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function toDriveItem(basePath: string, item: SftpListItem): DriveItem {
  return {
    name: item.name,
    path: joinRemotePath(basePath, item.name),
    type: itemType(item.type),
    size: item.size,
    modifiedAt: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
    rights: rightsString(item),
  };
}

export async function listDirectory(inputPath: string): Promise<DirectoryListing> {
  const path = normalizeRemotePath(inputPath);

  return withSftp(async (client) => {
    const rawItems = (await client.list(path)) as SftpListItem[];
    const items = rawItems
      .filter((item) => item.name !== "." && item.name !== "..")
      .map<DriveItem>((item) => toDriveItem(path, item))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });

    await logAccess(path, "view").catch(() => undefined);

    return {
      path,
      parent: parentPath(path),
      items,
      generatedAt: new Date().toISOString(),
    };
  });
}

export async function listAllItems() {
  const maxItems = Number(serverEnv("RECENT_SCAN_MAX_ITEMS") || "2500");
  const maxDepth = Number(serverEnv("RECENT_SCAN_MAX_DEPTH") || "10");

  return withSftp(async (client) => {
    const allItems: DriveItem[] = [];
    const queue: Array<{ path: string; depth: number }> = [{ path: "/", depth: 0 }];

    while (queue.length && allItems.length < maxItems) {
      const current = queue.shift()!;
      let rawItems: SftpListItem[] = [];
      try {
        rawItems = (await client.list(current.path)) as SftpListItem[];
      } catch {
        continue;
      }

      for (const rawItem of rawItems) {
        if (rawItem.name === "." || rawItem.name === "..") continue;
        const item = toDriveItem(current.path, rawItem);
        allItems.push(item);

        if (item.type === "folder" && current.depth < maxDepth && allItems.length < maxItems) {
          queue.push({ path: item.path, depth: current.depth + 1 });
        }

        if (allItems.length >= maxItems) break;
      }
    }

    return allItems;
  });
}

export async function readFile(inputPath: string): Promise<Buffer> {
  const path = normalizeRemotePath(inputPath);

  return withSftp(async (client) => {
    const data = await client.get(path);
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === "string") return Buffer.from(data);
    throw new Error("Unable to read remote file");
  });
}

export async function writeFile(inputPath: string, data: Buffer) {
  const path = normalizeRemotePath(inputPath);

  return withSftp(async (client) => {
    await client.put(data, path);
    await logAccess(path, "modify").catch(() => undefined);
  });
}

function archiveToBuffer(archive: Archiver) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    archive.on("warning", reject);
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function relativeArchivePath(rootPath: string, filePath: string) {
  const root = normalizeRemotePath(rootPath);
  const file = normalizeRemotePath(filePath);
  const relative = file.slice(root.length).replace(/^\/+/, "");
  return relative || file.split("/").filter(Boolean).at(-1) || "file";
}

export async function zipDirectory(inputPath: string): Promise<Buffer> {
  const rootPath = normalizeRemotePath(inputPath);
  const maxFiles = Number(serverEnv("FOLDER_DOWNLOAD_MAX_FILES") || "750");

  return withSftp(async (client) => {
    const archiver = (await import("archiver")) as unknown as ArchiverFactory;
    const archive = archiver("zip", { zlib: { level: 6 } });
    const archiveDone = archiveToBuffer(archive);
    const queue = [rootPath];
    let filesAdded = 0;

    while (queue.length) {
      const currentPath = queue.shift()!;
      const rawItems = (await client.list(currentPath)) as SftpListItem[];

      for (const rawItem of rawItems) {
        if (rawItem.name === "." || rawItem.name === "..") continue;
        const item = toDriveItem(currentPath, rawItem);

        if (item.type === "folder") {
          queue.push(item.path);
          continue;
        }

        if (item.type !== "file") continue;
        filesAdded += 1;
        if (filesAdded > maxFiles) {
          throw new Error(`Folder download stopped at ${maxFiles} files. Narrow the folder or raise FOLDER_DOWNLOAD_MAX_FILES.`);
        }

        const data = await client.get(item.path);
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
        archive.append(buffer, { name: relativeArchivePath(rootPath, item.path) });
      }
    }

    await archive.finalize();
    const zip = await archiveDone;
    await logAccess(rootPath, "view").catch(() => undefined);
    return zip;
  });
}
