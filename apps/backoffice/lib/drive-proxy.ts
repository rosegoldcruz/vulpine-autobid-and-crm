export function buildDriveUpstreamUrl(configuredUrl: string, upstreamPath: string) {
  const baseWithTrailingSlash = `${configuredUrl.replace(/\/+$/, "")}/`
  const relativePath = upstreamPath.replace(/^\/+/, "")
  return new URL(relativePath, baseWithTrailingSlash)
}

