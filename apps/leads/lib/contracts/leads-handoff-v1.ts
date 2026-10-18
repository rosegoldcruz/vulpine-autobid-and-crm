export const LEADS_HANDOFF_VERSION = 'v1' as const;
export const LEADS_HANDOFF_AUTH_HEADER = 'x-integration-key' as const;
export const LEADS_HANDOFF_SOURCE_SYSTEM = 'vulpine-leads' as const;

export interface VisionHandoffPayloadV1 {
  projectName: string;
  sourceSystem: string;
  leadId: string;
  accountName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  opportunityName?: string;
  notes?: string;
  attachmentRefs?: string[];
  correlationId: string;
}

function isNonEmptyString(value: unknown, maxLen: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLen;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateVisionHandoffPayloadV1(payload: VisionHandoffPayloadV1): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(payload.projectName, 120)) errors.push('projectName must be a non-empty string <= 120 chars');
  if (!isNonEmptyString(payload.sourceSystem, 80)) errors.push('sourceSystem must be a non-empty string <= 80 chars');
  if (!isNonEmptyString(payload.leadId, 120)) errors.push('leadId must be a non-empty string <= 120 chars');
  if (!isNonEmptyString(payload.correlationId, 120) || payload.correlationId.length < 8) {
    errors.push('correlationId must be a string between 8 and 120 chars');
  }

  if (payload.contactEmail && (!isNonEmptyString(payload.contactEmail, 254) || !isValidEmail(payload.contactEmail))) {
    errors.push('contactEmail must be a valid email');
  }

  if (payload.attachmentRefs) {
    if (!Array.isArray(payload.attachmentRefs) || payload.attachmentRefs.length > 100) {
      errors.push('attachmentRefs must be an array with max length 100');
    } else if (payload.attachmentRefs.some((ref) => !isNonEmptyString(ref, 300))) {
      errors.push('attachmentRefs entries must be non-empty strings <= 300 chars');
    }
  }

  return errors;
}
