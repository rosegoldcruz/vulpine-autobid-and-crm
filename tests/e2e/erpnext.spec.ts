import { expect, test } from "@playwright/test"
import { localAuth } from "./local-auth"

test.beforeEach(async ({ context }) => localAuth(context))

test("ERPNext is discoverable and shows an honest disconnected state", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("textbox", { name: "Find a module", exact: true }).fill("ERPNext")
  await page.getByRole("region", { name: "Platform directory" }).getByRole("link").click()
  await expect(page).toHaveURL(/\/finance\/erpnext$/)
  await expect(page.getByRole("heading", { name: "ERPNext", exact: true })).toBeVisible()
  await expect(page.getByRole("status")).toContainText("ERPNext is not connected yet")
  await expect(page.getByTestId("erpnext-workspace").getByRole("link")).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
})
