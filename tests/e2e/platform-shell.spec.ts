import { expect, test } from "@playwright/test"
import { platformModules } from "../../apps/backoffice/lib/platform-modules"

test("directory search and module links retain the Backoffice shell", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await expect(page.getByTestId("platform-overview")).toBeVisible()
  await expect(page).toHaveTitle("Vulpine Command Center")
  await expect(page.locator("main > div").first()).toHaveCSS("opacity", "1")
  await page.screenshot({ path: "/tmp/vulpine-os-desktop.png", fullPage: false })
  await page.getByRole("textbox", { name: "Find a module", exact: true }).fill("Hermes")
  const directory = page.getByRole("region", { name: "Platform directory" })
  await expect(directory.getByRole("link")).toHaveCount(1)
  await directory.getByRole("link").click()
  await expect(page).toHaveURL(/\/ai\/hermes$/)
  await expect(page.getByRole("heading", { name: "Hermes", exact: true })).toBeVisible()
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId("platform-overview")).toBeVisible()
  expect(errors).toEqual([])
})

test("mobile More drawer searches and navigates; notifications contain no synthetic events", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/ai/fox")
  await expect(page.getByRole("heading", { name: "Fox", exact: true })).toBeVisible()
  const nav = page.getByRole("navigation", { name: "Mobile navigation" })
  await nav.getByRole("button", { name: "More", exact: true }).click()
  await expect(page.getByRole("heading", { name: "All modules" })).toBeVisible()
  await page.getByRole("searchbox", { name: "Find a module in navigation" }).fill("Paperclip")
  await page.getByRole("button", { name: "Paperclip", exact: true }).click()
  await expect(page).toHaveURL(/\/ai\/paperclip$/)
  await expect(page.getByRole("heading", { name: "Paperclip", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "All modules" })).not.toBeVisible()
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0)
  await page.screenshot({ path: "/tmp/vulpine-os-mobile.png", fullPage: false })
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
  for (const button of await nav.getByRole("button").all()) {
    const box = await button.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole("button", { name: "Notifications", exact: true }).click()
  await expect(page.getByText("No notifications loaded.", { exact: false })).toBeVisible()
  await expect(page.getByText("Core Modules Connected")).toHaveCount(0)
})

test("unknown module routes return a real 404", async ({ page }) => {
  const response = await page.goto("/ai/not-a-module")
  expect(response?.status()).toBe(404)
})

test("every registered module is addressable without replacing established routes", async ({ request }) => {
  for (const workspace of platformModules) {
    const response = await request.get(workspace.path)
    expect(response.status(), workspace.path).toBe(200)
    expect(await response.text(), workspace.path).toContain("Vulpine")
  }
})
