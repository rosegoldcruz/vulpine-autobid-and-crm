export type BidStatus = "Sent" | "Follow-Up" | "Won" | "Lost"

export type BidRecord = {
  id: number
  project_name: string | null
  company_name: string | null
  units: number | null
  bid_amount: number | null
  projected_profit: number | null
  sent_date: string | null
  status: BidStatus | string | null
  filename?: string | null
  created_at?: string | null
}

export type BidKpis = {
  totalBids: number
  totalValue: number
  totalUnits: number
  totalProfit: number
  estimatedCost: number
  revenueWithProfit: number
  profitCoverageCount: number
  profitCoveragePct: number
  recordsNeedingReview: number
  avgProfitPerBid: number
  avgBid: number
  byCompany: Record<string, number>
  byStatus: Record<string, number>
  byMonth: Record<string, number>
}

export type UpdateBidInput = Partial<Pick<BidRecord, "project_name" | "company_name" | "units" | "bid_amount" | "sent_date" | "status">>
