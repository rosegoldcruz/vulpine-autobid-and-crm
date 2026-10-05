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

export function validateDeletePath(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/") || input === "/" ||
      input.includes("\0") || input.endsWith("/") ||
      input.split("/").slice(1).some((part) => !part || part === "." || part === "..")) {
    throw new Error("A valid item path is required; Drive root cannot be deleted.")
  }
  return input
}
