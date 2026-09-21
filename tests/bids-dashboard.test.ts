import assert from "node:assert/strict"
import test from "node:test"
import type { BidRecord } from "../packages/sdk/src/index.ts"
import { bidNeedsReview, buildBidDashboard, normalizeBidStatus } from "../apps/backoffice/lib/bids-dashboard.ts"

function bid(overrides: Partial<BidRecord> = {}): BidRecord {
  return {
    id: 1,
    project_name: "Maple Apartments",
    company_name: "Vulpine Builders",
    units: 12,
    bid_amount: 100_000,
    projected_profit: 18_000,
    sent_date: "2026-09-20",
    status: "Sent",
    ...overrides,
  }
}

test("buildBidDashboard derives truthful won, lost, and open pipeline totals", () => {
  const dashboard = buildBidDashboard([
    bid({ id: 1, status: "Sent", bid_amount: 100_000 }),
    bid({ id: 2, status: "Follow-Up", bid_amount: 50_000 }),
    bid({ id: 3, status: "Won", bid_amount: 80_000 }),
    bid({ id: 4, status: "Lost", bid_amount: 20_000 }),
  ])

  assert.equal(dashboard.openValue, 150_000)
  assert.equal(dashboard.wonValue, 80_000)
  assert.equal(dashboard.lostValue, 20_000)
  assert.equal(dashboard.totalValue, 250_000)
  assert.deepEqual(dashboard.status.map(({ name, count }) => ({ name, count })), [
    { name: "Sent", count: 1 },
    { name: "Follow-Up", count: 1 },
    { name: "Won", count: 1 },
    { name: "Lost", count: 1 },
  ])
})

test("unknown legacy statuses remain visible in the default sent bucket", () => {
  assert.equal(normalizeBidStatus(" sent "), "Sent")
  assert.equal(normalizeBidStatus("pending"), "Sent")
  assert.equal(normalizeBidStatus(null), "Sent")
})

test("review state catches incomplete operational fields", () => {
  assert.equal(bidNeedsReview(bid()), false)
  assert.equal(bidNeedsReview(bid({ company_name: null })), true)
  assert.equal(bidNeedsReview(bid({ bid_amount: null })), true)
})
