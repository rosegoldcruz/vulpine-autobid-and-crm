import { defineConfig } from "@playwright/test"

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:3100",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: externalBaseUrl ? undefined : {
    command: "corepack pnpm --filter @vulpine/backoffice exec next dev --port 3100",
    url: "http://127.0.0.1:3100/bids/vision",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
