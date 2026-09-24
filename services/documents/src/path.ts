export function normalizeRemotePath(input: string | null | undefined) {
  if (!input || input === "/") return "/"
  const decoded = input.replaceAll("\\", "/")
  const parts = decoded.split("/").filter(Boolean)
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
