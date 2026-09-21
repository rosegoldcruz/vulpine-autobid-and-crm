import "server-only"
import type { WorkflowState } from "./types.js"
import { VisionServiceError } from "./errors.js"

const transitions: Record<WorkflowState, readonly WorkflowState[]> = {
  created: ["files_ingested", "failed"],
  files_ingested: ["workbook_ingested", "failed"],
  workbook_ingested: ["pages_classified", "failed"],
  pages_classified: ["unit_mix_drafted", "failed"],
  unit_mix_drafted: ["unit_mix_review_required", "failed"],
  unit_mix_review_required: ["failed"],
  failed: [],
}

export function nextState(current: WorkflowState, target: WorkflowState): WorkflowState {
  if (!transitions[current].includes(target)) {
    throw new VisionServiceError(
      "INVALID_STATE_TRANSITION",
      `Cannot transition Vision job from ${current} to ${target}.`,
      409,
      { current, target },
    )
  }
  return target
}
