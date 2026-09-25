import assert from "node:assert/strict"
import test from "node:test"
import {
  API_CONTRACT_VERSION,
  VULPINE_PRINCIPAL_HEADER,
  LEADS_VISION_HANDOFF_AUTH_HEADER,
  LEADS_VISION_HANDOFF_VERSION,
  leadsVisionHandoffRequestV1Schema,
  leadsVisionHandoffResponseV1Schema,
  normalizeCorrelationId,
} from "../packages/contracts/src/index.ts"

test("API contract version is explicit", () => {
  assert.equal(API_CONTRACT_VERSION, "2026-09-20")
  assert.equal(VULPINE_PRINCIPAL_HEADER, "x-vulpine-principal")
})

test("correlation IDs preserve valid callers and replace invalid input", () => {
  assert.equal(normalizeCorrelationId("request-1234"), "request-1234")
  assert.match(normalizeCorrelationId("bad"), /^[0-9a-f-]{36}$/)
})

test("Leads to Vision v1 request remains compatible with the promoted contract", () => {
  const parsed = leadsVisionHandoffRequestV1Schema.parse({ projectName: "Riverside", leadId: "lead-42" })
  assert.equal(LEADS_VISION_HANDOFF_VERSION, "v1")
  assert.equal(LEADS_VISION_HANDOFF_AUTH_HEADER, "x-integration-key")
  assert.equal(parsed.sourceSystem, "vulpine-leads")
  assert.deepEqual(parsed.attachmentRefs, [])
})

test("Leads to Vision response requires a canonical project and correlation ID", () => {
  const createdAt = new Date().toISOString()
  const response = leadsVisionHandoffResponseV1Schema.parse({
    project: { projectId: "project-1", projectName: "Riverside", files: [], pdfFiles: [], workbookFiles: [], pageCount: 0, createdAt, processingStatus: "created" },
    handoff: { projectId: "project-1", correlationId: "request-1234", nextAction: "Upload bid files." },
  })
  assert.equal(response.project.projectId, response.handoff.projectId)
})
