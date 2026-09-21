import type { BidRecord } from "@vulpine/sdk"

export const BID_STATUSES = ["Sent", "Follow-Up", "Won", "Lost"] as const

export type BidDashboardStatus = (typeof BID_STATUSES)[number]

export type BidStatusSummary = {
  name: BidDashboardStatus
  count: number
  value: number
  color: string
}

const STATUS_COLORS: Record<BidDashboardStatus, string> = {
  Sent: "#bfc1c5",
  "Follow-Up": "#ef8fcf",
  Won: "#52dda0",
  Lost: "#c43935",
}

export function normalizeBidStatus(status: string | null | undefined): BidDashboardStatus {
  const match = BID_STATUSES.find((candidate) => candidate.toLowerCase() === status?.trim().toLowerCase())
  return match ?? "Sent"
}

export function bidNeedsReview(bid: BidRecord) {
  return !bid.project_name || !bid.company_name || bid.units === null || bid.bid_amount === null
}

export function buildBidDashboard(bids: BidRecord[]) {
  const status = BID_STATUSES.map<BidStatusSummary>((name) => ({
    name,
    count: 0,
    value: 0,
    color: STATUS_COLORS[name],
  }))

  const summaryByName = new Map(status.map((item) => [item.name, item]))

  for (const bid of bids) {
    const bucket = summaryByName.get(normalizeBidStatus(bid.status))
    if (!bucket) continue
    bucket.count += 1
    bucket.value += bid.bid_amount ?? 0
  }

  return {
    wonValue: summaryByName.get("Won")?.value ?? 0,
    lostValue: summaryByName.get("Lost")?.value ?? 0,
    openValue: status
      .filter((item) => item.name !== "Won" && item.name !== "Lost")
      .reduce((sum, item) => sum + item.value, 0),
    totalValue: status.reduce((sum, item) => sum + item.value, 0),
    totalCount: bids.length,
    needsReview: bids.filter(bidNeedsReview).length,
    status,
  }
}
