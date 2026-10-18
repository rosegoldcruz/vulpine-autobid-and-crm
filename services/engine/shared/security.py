"""Authenticate the Bid Engine's machine callers; contain other legacy APIs."""

import hmac
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RequireConfiguredApiAuthentication(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path != "/api/v1/ping":
            configured = os.environ.get("ENGINE_AGENT_API_KEY", "")
            if not path.startswith("/api/v1/auto-bid/") or len(configured) < 32:
                return JSONResponse(
                    status_code=503,
                    content={"error": {"code": "AUTH_NOT_CONFIGURED",
                                       "message": "Authenticated API integration is not configured."}},
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
                )
            provided = request.headers.get("x-vulpine-integration-key", "")
            if not hmac.compare_digest(provided.encode(), configured.encode()):
                return JSONResponse(
                    status_code=401,
                    content={"error": {"code": "UNAUTHORIZED", "message": "A Bid Engine integration credential is required."}},
                    headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
                )
        return await call_next(request)
