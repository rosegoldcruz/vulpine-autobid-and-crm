export type EntityId = string
export type IsoDateTime = string

export type AuditedEntity = {
  id: EntityId
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
