import type { Response } from "express"
import { positiveIntegerEnv } from "./config.js"

let activeTransfers = 0

export function reserveTransfer(response: Response) {
  if (activeTransfers >= positiveIntegerEnv("DRIVE_TRANSFER_MAX_CONCURRENCY", 2)) {
    response.status(429).set("retry-after", "5").json({ error: { code: "TRANSFER_BUSY", message: "Document transfers are busy. Try again shortly." } })
    return false
  }
  activeTransfers += 1
  let released = false
  // Release when upstream work settles, even if the caller disconnects earlier.
  response.locals.releaseTransfer = () => {
    if (!released) { released = true; activeTransfers -= 1 }
  }
  return true
}

export function releaseTransfer(response: Response) {
  response.locals.releaseTransfer?.()
}
