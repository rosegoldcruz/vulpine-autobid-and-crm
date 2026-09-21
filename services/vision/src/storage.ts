import "server-only"
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { VisionServiceError } from "./errors.js"

function dataRoot(): string {
  const configured = process.env.VISION_DATA_DIR?.trim()
  if (configured && !path.isAbsolute(configured)) {
    throw new VisionServiceError("VISION_STORAGE_NOT_CONFIGURED", "VISION_DATA_DIR must be an absolute path.", 503)
  }
  return configured || path.join(process.cwd(), ".data", "vision")
}

function safePath(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) {
    throw new VisionServiceError("INVALID_STORAGE_PATH", "Vision storage path is invalid.", 400)
  }
  const root = path.resolve(dataRoot())
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new VisionServiceError("INVALID_STORAGE_PATH", "Vision storage path escapes the data directory.", 400)
  }
  return resolved
}

export async function ensureDataDirs(): Promise<void> {
  await Promise.all(["projects", "jobs", "uploads"].map((directory) => mkdir(safePath(directory), { recursive: true })))
}

export async function writeBinary(relativePath: string, data: Uint8Array): Promise<void> {
  const destination = safePath(relativePath)
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.${randomUUID()}.tmp`
  await writeFile(temporary, data)
  await rename(temporary, destination)
}

export async function readBinary(relativePath: string): Promise<Buffer> {
  return readFile(safePath(relativePath))
}

export async function writeJson(relativePath: string, value: unknown): Promise<void> {
  await writeBinary(relativePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"))
}

export async function readJson<T>(relativePath: string): Promise<T | null> {
  try {
    return JSON.parse((await readBinary(relativePath)).toString("utf8")) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export async function listFiles(relativeDirectory: string): Promise<string[]> {
  try {
    return (await readdir(safePath(relativeDirectory))).map((name) => path.posix.join(relativeDirectory, name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}
