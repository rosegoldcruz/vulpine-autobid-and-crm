"""Contain legacy APIs until an authenticated caller contract is provisioned."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RequireConfiguredApiAuthentication(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path.startswith("/api/") and request.url.path != "/api/v1/ping":
            # No verified API authentication contract exists in this legacy stack.
            # Provider credentials are not application authentication credentials.
            return JSONResponse(
                status_code=503,
                content={"error": {"code": "AUTH_NOT_CONFIGURED",
                                   "message": "Authenticated API integration is not configured."}},
                headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            )
        return await call_next(request)
