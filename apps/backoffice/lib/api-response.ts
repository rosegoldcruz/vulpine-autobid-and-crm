import { API_CONTRACT_VERSION, type ApiErrorCode, type ApiResponse } from "@vulpine/contracts"
import { NextResponse } from "next/server"

export function apiSuccess<T>(data: T, correlationId: string, status = 200) {
  const payload: ApiResponse<T> = {
    ok: true,
    data,
    meta: { contractVersion: API_CONTRACT_VERSION, correlationId },
  }
  return NextResponse.json(payload, { status, headers: { "x-correlation-id": correlationId } })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  correlationId: string,
  status: number,
  details?: unknown,
) {
  const payload: ApiResponse<never> = {
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
    meta: { contractVersion: API_CONTRACT_VERSION, correlationId },
  }
  return NextResponse.json(payload, { status, headers: { "x-correlation-id": correlationId } })
}
