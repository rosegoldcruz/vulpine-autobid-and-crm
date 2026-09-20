export const API_CONTRACT_VERSION = "2026-09-20" as const
export const CORRELATION_ID_HEADER = "x-correlation-id" as const

export type ApiMeta = {
  contractVersion: typeof API_CONTRACT_VERSION
  correlationId: string
}

export type ApiSuccess<T> = {
  ok: true
  data: T
  meta: ApiMeta
}

export type ApiErrorCode =
  | "AUTH_NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "UPSTREAM_NOT_CONFIGURED"
  | "UPSTREAM_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"

export type ApiError = {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
  meta: ApiMeta
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function normalizeCorrelationId(value: string | null | undefined): string {
  const candidate = value?.trim()
  if (candidate && /^[a-zA-Z0-9._:-]{8,128}$/.test(candidate)) return candidate
  return crypto.randomUUID()
}

export type LeadsVisionHandoffV1 = {
  contractVersion: "1"
  businessId: string
  opportunityId: string
  projectName: string
  notes?: string
  attachmentRefs: string[]
}
