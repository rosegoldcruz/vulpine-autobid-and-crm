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

export type ReviewState = "quick-review" | "verified" | "custom"

export type CabinetFinding = {
  id: string
  label: string
  family: string
  rawWidth: string
  normalizedWidth: string
  sku: string
  catalog: string
  takeoffGroup: string
  source: string
  status: ReviewState
  rule: string
  confidence: Array<{ label: string; value: number }>
}

export const SAMPLE_SHEETS: readonly PlanSheet[] = [
  { id: "a101", number: "A101", title: "Level 1", group: "Relevant", relevantCount: 3, pageNumber: 1, document: "Garden_Villas_IFC_Rev3.pdf", classification: "FLOOR_PLAN" },
  { id: "a401", number: "A401", title: "Unit Plans", group: "Unit Plans", relevantCount: 18, pageNumber: 4, document: "Garden_Villas_IFC_Rev3.pdf", classification: "UNIT_PLAN" },
  { id: "a402", number: "A402", title: "Unit Plans", group: "Unit Plans", relevantCount: 6, pageNumber: 5, document: "Garden_Villas_IFC_Rev3.pdf", classification: "UNIT_PLAN" },
  { id: "a501", number: "A501", title: "Interior Elevations", group: "Elevations", relevantCount: 12, pageNumber: 12, document: "Garden_Villas_IFC_Rev3.pdf", classification: "CASEWORK_SCHEDULE" },
  { id: "a601", number: "A601", title: "Finish Schedule", group: "Schedules", relevantCount: 3, pageNumber: 18, document: "Garden_Villas_IFC_Rev3.pdf", classification: "FINISH_SCHEDULE" },
]

export const SAMPLE_FINDINGS: readonly CabinetFinding[] = [
  {
    id: "sink-base-33",
    label: "Sink Base",
    family: "Sink Base",
    rawWidth: "32.96 in",
    normalizedWidth: "33 in",
    sku: "SB33",
    catalog: "Alta Euro",
    takeoffGroup: "Clubhouse Kitchen",
    source: "A6.12",
    status: "quick-review",
    rule: "SB + 33 in + Alta Euro → SB33",
    confidence: [
      { label: "Dimension visibility", value: 99 },
      { label: "Family agreement", value: 95 },
      { label: "Plan/elevation agreement", value: 93 },
      { label: "Catalog compatibility", value: 100 },
    ],
  },
  {
    id: "millwork-panel",
    label: "Millwork Panel",
    family: "Custom Millwork",
    rawWidth: "30.12 in",
    normalizedWidth: "Unresolved",
    sku: "No catalog match",
    catalog: "Alta Euro",
    takeoffGroup: "Clubhouse Kitchen",
    source: "A5.01",
    status: "custom",
    rule: "Unsupported scope → estimator review",
    confidence: [
      { label: "Dimension visibility", value: 88 },
      { label: "Family agreement", value: 74 },
      { label: "Plan/elevation agreement", value: 91 },
      { label: "Catalog compatibility", value: 0 },
    ],
  },
]

export const SHEET_GROUPS: readonly SheetGroup[] = ["Relevant", "Unit Plans", "Elevations", "Schedules", "Ignored"]
