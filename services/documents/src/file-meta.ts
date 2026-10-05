const mimeByExtension: Record<string, string> = {
  bmp: "image/bmp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  opus: "audio/ogg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  zip: "application/zip",
}

export function filenameFromPath(path: string) {
  return path.split("/").filter(Boolean).at(-1) || "download"
}

export function zipFilenameFromPath(path: string) {
  return `${filenameFromPath(path).replace(/\.zip$/i, "") || "folder"}.zip`
}

export function extensionFromPath(path: string) {
  const filename = filenameFromPath(path)
  const last = filename.lastIndexOf(".")
  return last >= 0 ? filename.slice(last + 1).toLowerCase() : ""
}

export function contentTypeForPath(path: string) {
  return mimeByExtension[extensionFromPath(path)] ?? "application/octet-stream"
}

export function contentDisposition(type: "attachment" | "inline", filename: string) {
  const fallback = filename.replace(/[^\w .()-]/g, "_")
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape)
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
