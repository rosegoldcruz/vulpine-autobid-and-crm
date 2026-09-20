export const serverEnvNames = {
  nextAuthUrl: "NEXTAUTH_URL",
  nextAuthSecret: "NEXTAUTH_SECRET",
  zitadelIssuer: "ZITADEL_ISSUER",
  zitadelClientId: "ZITADEL_CLIENT_ID",
  zitadelClientSecret: "ZITADEL_CLIENT_SECRET",
  zitadelAudience: "ZITADEL_AUDIENCE",
  bidsTrackerApiUrl: "BIDS_TRACKER_API_URL",
  bidsTrackerApiToken: "BIDS_TRACKER_API_TOKEN",
} as const

export const browserEnvNames = {
  apiBaseUrl: "NEXT_PUBLIC_API_BASE_URL",
} as const

export function optionalServerEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value || undefined
}

export function requiredServerEnv(name: string): string {
  const value = optionalServerEnv(name)
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}
