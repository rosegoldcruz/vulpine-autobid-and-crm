import unittest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from shared.security import RequireConfiguredApiAuthentication


class ApiContainmentTests(unittest.TestCase):
    def test_every_sensitive_endpoint_fails_before_handler(self):
        called = []
        async def endpoint(request):
            called.append(request.url.path)
            return JSONResponse({"status": "ok"})
        app = Starlette(routes=[Route("/{path:path}", endpoint, methods=["GET", "POST", "DELETE", "PATCH"])])
        app.add_middleware(RequireConfiguredApiAuthentication)
        with TestClient(app) as client:
            for path in ["/api/v1/voice/campaign", "/api/v1/outreach/batch", "/api/v1/auto-bid/projects", "/api/v1/webhooks/vapi/call-completed", "/api/v1/webhooks/ghl/reply-received"]:
                for method in ["GET", "POST", "DELETE", "PATCH"]:
                    self.assertEqual(client.request(method, path, json={}).status_code, 503)
            self.assertEqual(called, [])
            for path in ["/", "/health", "/api/v1/ping"]:
                self.assertEqual(client.get(path).status_code, 200)


if __name__ == "__main__":
    unittest.main()
