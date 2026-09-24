import { timingSafeEqual } from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import { normalizeCorrelationId, VULPINE_INTEGRATION_AUTH_HEADER } from "@vulpine/contracts"
import { requiredEnv } from "./config.js"

declare global {
  namespace Express {
    interface Request {
      actorId: string
      correlationId: string
    }
  }
}

function sameSecret(provided: string, expected: string) {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function requireIntegration(request: Request, response: Response, next: NextFunction) {
  const correlationId = normalizeCorrelationId(request.header("x-correlation-id"))
  const provided = request.header(VULPINE_INTEGRATION_AUTH_HEADER) ?? ""
  const expected = requiredEnv("DRIVE_API_TOKEN")
  if (!provided || !sameSecret(provided, expected)) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid integration credentials." }, correlationId })
    return
  }
  request.correlationId = correlationId
  request.actorId = (request.header("x-vulpine-actor") || "authenticated-user").slice(0, 200)
  next()
}
