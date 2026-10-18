import unittest
from unittest.mock import patch
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient
from shared.security import RequireConfiguredApiAuthentication


class ApiContainmentTests(unittest.TestCase):
    @patch.dict("os.environ", {}, clear=True)
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

    def test_machine_key_only_unlocks_bid_engine_routes(self):
        async def endpoint(request):
            return JSONResponse({"ok": True})
        app = Starlette(routes=[Route("/{path:path}", endpoint)])
        app.add_middleware(RequireConfiguredApiAuthentication)
        with patch.dict("os.environ", {"ENGINE_AGENT_API_KEY": "test-only-engine-integration-key-32-characters"}):
            with TestClient(app) as client:
                self.assertEqual(client.get("/api/v1/auto-bid/stats").status_code, 401)
                self.assertEqual(client.get("/api/v1/auto-bid/stats", headers={"x-vulpine-integration-key": "wrong"}).status_code, 401)
                headers = {"x-vulpine-integration-key": "test-only-engine-integration-key-32-characters"}
                self.assertEqual(client.get("/api/v1/auto-bid/stats", headers=headers).status_code, 200)
                self.assertEqual(client.get("/api/v1/outreach/batch", headers=headers).status_code, 503)


if __name__ == "__main__":
    unittest.main()
