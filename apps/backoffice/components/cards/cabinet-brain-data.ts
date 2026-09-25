export type SheetGroup = "Relevant" | "Unit Plans" | "Elevations" | "Schedules" | "Ignored"

export type PlanSheet = {
  id: string
  number: string
  title: string
  group: SheetGroup
  relevantCount: number
  pageNumber: number
  document: string
  classification: string
}

export const SHEET_GROUPS: readonly SheetGroup[] = ["Relevant", "Unit Plans", "Elevations", "Schedules", "Ignored"]
