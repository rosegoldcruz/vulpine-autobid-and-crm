import { z } from "zod"

export const LEADS_VISION_HANDOFF_VERSION = "v1" as const
export const LEADS_VISION_HANDOFF_AUTH_HEADER = "x-integration-key" as const
export const LEADS_VISION_SOURCE_SYSTEM = "vulpine-leads" as const

export const leadsVisionHandoffRequestV1Schema = z.object({
  projectName: z.string().trim().min(1).max(120),
  sourceSystem: z.string().trim().min(1).max(80).default(LEADS_VISION_SOURCE_SYSTEM),
  leadId: z.string().trim().min(1).max(120),
  accountName: z.string().trim().min(1).max(160).optional(),
  contactName: z.string().trim().min(1).max(120).optional(),
  contactEmail: z.string().trim().email().max(254).optional(),
  contactPhone: z.string().trim().min(3).max(50).optional(),
  opportunityName: z.string().trim().min(1).max(180).optional(),
  notes: z.string().max(2000).optional(),
  attachmentRefs: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  correlationId: z.string().trim().min(8).max(120).optional(),
})

export const leadHandoffContextV1Schema = leadsVisionHandoffRequestV1Schema.extend({
  correlationId: z.string().trim().min(8).max(120),
  createdAt: z.string().datetime(),
})

export const visionProjectFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  uploadedAt: z.string().datetime().optional(),
})

export const visionProjectManifestSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  files: z.array(visionProjectFileSchema),
  pdfFiles: z.array(visionProjectFileSchema),
  workbookFiles: z.array(visionProjectFileSchema),
  pageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  processingStatus: z.enum(["created", "uploaded", "processing", "ready", "failed"]),
  leadHandoff: leadHandoffContextV1Schema.optional(),
})

export const leadsVisionHandoffResponseV1Schema = z.object({
  project: visionProjectManifestSchema,
  handoff: z.object({
    projectId: z.string().min(1),
    correlationId: z.string().min(8).max(120),
    nextAction: z.string().min(1),
  }),
})

export type LeadsVisionHandoffRequestV1 = z.infer<typeof leadsVisionHandoffRequestV1Schema>
export type LeadHandoffContextV1 = z.infer<typeof leadHandoffContextV1Schema>
export type VisionProjectFile = z.infer<typeof visionProjectFileSchema>
export type VisionProjectManifest = z.infer<typeof visionProjectManifestSchema>
export type LeadsVisionHandoffResponseV1 = z.infer<typeof leadsVisionHandoffResponseV1Schema>

// Compatibility names for the standalone Vision/Leads source contract.
export const LEADS_HANDOFF_VERSION = LEADS_VISION_HANDOFF_VERSION
export const LEADS_HANDOFF_AUTH_HEADER = LEADS_VISION_HANDOFF_AUTH_HEADER
export const leadsHandoffRequestV1Schema = leadsVisionHandoffRequestV1Schema
export type LeadsHandoffRequestV1 = LeadsVisionHandoffRequestV1
