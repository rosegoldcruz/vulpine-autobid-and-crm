import path from "node:path"
import { expect, test } from "@playwright/test"

const bids = [
  { id: 1, project_name: "Riverside Commons", company_name: "Northline Construction", status: "Sent", units: 84, bid_amount: 248000, projected_profit: 42000, sent_date: "2026-09-18", sent_time: "10:30 AM", sent_to_name: "Casey", sent_to_email: "casey@example.com" },
  { id: 2, project_name: "Juniper Court", company_name: "Apex Builders", status: "Won", units: 36, bid_amount: 112000, projected_profit: 19000, sent_date: "2026-09-12", sent_time: "2:15 PM", sent_to_name: "Jordan", sent_to_email: "jordan@example.com" },
  { id: 3, project_name: "Harbor Place", company_name: "Civic Partners", status: "Lost", units: 24, bid_amount: 91000, projected_profit: 12000, sent_date: "2026-09-04", sent_time: "4:00 PM", sent_to_name: "Morgan", sent_to_email: "morgan@example.com" },
]

function envelope(data: unknown) {
  return { ok: true, data, meta: { contractVersion: "2026-09-20", correlationId: "bids-mobile-qa" } }
}

test("Bids Tracker mobile navigation and edit actions work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/bids-tracker/**", async (route) => {
    if (route.request().method() === "PATCH") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope({ updated: true })) })
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(bids)) })
  })

  await page.goto("/bids/tracker")
  await expect(page.getByRole("heading", { name: "Bids Tracker" })).toBeVisible()
  await expect(page.getByLabel("Bid KPIs").getByText("$112,000", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Edit Riverside Commons", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Edit bid" })).toBeVisible()
  await page.locator('[data-slot="drawer-content"]').getByRole("textbox", { name: "Company" }).fill("Northline Builders")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Bid saved", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "More" }).click()
  await expect(page.getByRole("heading", { name: "All modules" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Cabinet Brain" })).toBeVisible()

  const output = process.env.BIDS_SCREENSHOT_DIR || test.info().outputDir
  await page.keyboard.press("Escape")
  await page.screenshot({ path: path.join(output, "bids-mobile.png"), fullPage: false })
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")).toHaveCount(0)
})
