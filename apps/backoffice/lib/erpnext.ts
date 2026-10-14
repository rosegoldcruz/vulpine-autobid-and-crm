/** Only allow a configured HTTPS origin; credentials never belong in module links. */
export function erpnextUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined
    return url.origin
  } catch {
    return undefined
  }
}
