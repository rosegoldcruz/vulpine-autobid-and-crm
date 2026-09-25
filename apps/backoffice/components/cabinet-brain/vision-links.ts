export const CABINET_BRAIN_PATH = "/bids/vision"

/** Keep engine-provided notification targets inside the canonical Backoffice surface. */
export function cabinetBrainDeepLink(targetPath?: string) {
  if (!targetPath) return undefined

  const target = new URL(targetPath, "http://cabinet-brain.local")
  return `${CABINET_BRAIN_PATH}${target.search}${target.hash}`
}

/** Route engine-created artifact URLs back through the authenticated Vision gateway. */
export function cabinetBrainDownloadUrl(downloadUrl: string) {
  const target = new URL(downloadUrl, "http://cabinet-brain.local")
  const upstreamPath = target.pathname.startsWith("/api/")
    ? target.pathname.slice(4)
    : target.pathname.replace(/^\//, "")

  return `/api/vision/${upstreamPath}${target.search}${target.hash}`
}
