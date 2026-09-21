import "server-only"

export class VisionServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "VisionServiceError"
  }
}

export function asVisionServiceError(error: unknown): VisionServiceError {
  return error instanceof VisionServiceError
    ? error
    : new VisionServiceError("INTERNAL_ERROR", "Vision operation failed.", 500)
}
