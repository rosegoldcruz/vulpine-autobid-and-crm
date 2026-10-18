export function normalizeRemotePath(input: string | null | undefined) {
  if (!input || input === "/") return "/"
  const parts = input.split("/").filter(Boolean)
  const safeParts = parts.filter((part) => part !== "." && part !== "..")
  return `/${safeParts.join("/")}`
}

export function parentPath(path: string) {
  const normalized = normalizeRemotePath(path)
  if (normalized === "/") return "/"
  const parts = normalized.split("/").filter(Boolean)
  parts.pop()
  return parts.length ? `/${parts.join("/")}` : "/"
}

export function joinRemotePath(base: string, name: string) {
  const normalized = normalizeRemotePath(base)
  const cleanName = name.replaceAll("/", "").replaceAll("\\", "")
  if (!cleanName || cleanName === "." || cleanName === "..") throw new Error("Invalid filename")
  return normalized === "/" ? `/${cleanName}` : `${normalized}/${cleanName}`
}

/** Validate the entire folder manifest before writing any uploaded file. */
export function resolveUploadPaths(base: string, filenames: string[], manifest: unknown): string[] {
  if (manifest === undefined) return filenames.map(name => joinRemotePath(base, name))
  if (typeof manifest !== "string" || Buffer.byteLength(manifest) > 256 * 1024) throw new Error("Invalid folder upload manifest.")
  let paths: unknown
  try { paths = JSON.parse(manifest) } catch { throw new Error("Invalid folder upload manifest.") }
  if (!Array.isArray(paths) || paths.length !== filenames.length) throw new Error("Folder paths must match the uploaded files.")
  const prefix = normalizeRemotePath(base).replace(/\/$/, "")
  const result = paths.map((relative: unknown) => {
    if (typeof relative !== "string" || !relative || relative.length > 2000 || /^(?:\/|[A-Za-z]:)/.test(relative) || /[\\\x00-\x1f]/.test(relative) || relative.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Folder upload contains an unsafe relative path.")
    return `${prefix}/${relative}`
  })
  if (new Set(result).size !== result.length) throw new Error("Folder upload contains duplicate paths.")
  return result
}

export function validateDeletePath(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/") || input === "/" ||
      input.includes("\0") || input.endsWith("/") ||
      input.split("/").slice(1).some((part) => !part || part === "." || part === "..")) {
    throw new Error("A valid item path is required; Drive root cannot be deleted.")
  }
  return input
}
