export type VulpineEvent<TType extends string = string, TPayload = unknown> = {
  id: string
  type: TType
  version: 1
  occurredAt: string
  correlationId: string
  actorId?: string
  payload: TPayload
}

export type BidTrackerEvent = VulpineEvent<
  "bids.record.created" | "bids.record.updated" | "bids.record.deleted",
  { bidId: number }
>
