"""
GoHighLevel API Client — the central nervous system of Vulpine Engine.
Every service reads/writes through this bridge rather than touching GHL directly.
"""

import hashlib
import hmac
import json
from typing import Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from loguru import logger

from shared.config import settings


# ── Data Classes ────────────────────────────────────────────


@dataclass
class GHLContact:
    id: str = ""
    email: str = ""
    phone: str = ""
    first_name: str = ""
    last_name: str = ""
    company_name: str = ""
    title: str = ""
    tags: list[str] = field(default_factory=list)
    custom_fields: dict[str, Any] = field(default_factory=dict)
    source: str = ""
    date_added: str = ""

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


@dataclass
class GHLOpportunity:
    id: str = ""
    contact_id: str = ""
    name: str = ""
    pipeline_id: str = ""
    stage_id: str = ""
    status: str = "open"
    monetary_value: float = 0.0
    custom_fields: dict[str, Any] = field(default_factory=dict)
    notes: str = ""
    created_at: str = ""


@dataclass
class GHLPipeline:
    id: str
    name: str
    stages: list[dict] = field(default_factory=list)


@dataclass
class GHLCampaign:
    id: str
    name: str
    status: str
    contact_count: int = 0


# ── API Client ──────────────────────────────────────────────


class GHLClient:
    """Async client for the GoHighLevel v2 API."""

    def __init__(self):
        self.base_url = settings.ghl_api_base
        self.location_id = settings.ghl_location_id
        self._access_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create an authenticated HTTP client."""
        if self._client is None:
            await self._refresh_token()
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30,
                headers=self._auth_headers(),
            )
        return self._client

    def _auth_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Version": "2021-07-28",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _refresh_token(self):
        """Exchange private integration key for access token."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self.base_url}/oauth/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.ghl_private_integration_key,
                    "client_secret": settings.ghl_private_integration_key,
                    "code": settings.ghl_access_token,  # private integration uses token as code
                },
            )
            # GHL private integrations may use token directly
            # Fallback: just use the access token directly
            if resp.status_code >= 400:
                logger.debug("OAuth exchange not needed for private integration, using token directly")
                self._access_token = f"pit-{settings.ghl_access_token.removeprefix('pit-')}"
            else:
                data = resp.json()
                self._access_token = data.get("access_token", settings.ghl_access_token)

            # Ensure token has pit- prefix
            if not self._access_token.startswith("pit-"):
                self._access_token = f"pit-{self._access_token}"

            self._token_expiry = datetime.now(timezone.utc)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Make an authenticated API request."""
        client = await self._get_client()
        resp = await client.request(method, path, **kwargs)

        if resp.status_code == 401:
            # Token expired, refresh and retry once
            await self._refresh_token()
            client.headers.update(self._auth_headers())
            resp = await client.request(method, path, **kwargs)

        if resp.status_code >= 400:
            logger.error(f"GHL API error: {resp.status_code} {path} → {resp.text[:500]}")
            resp.raise_for_status()

        return resp.json() if resp.text else {}

    # ── Contacts ────────────────────────────────────────────

    async def search_contacts(
        self,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 100,
    ) -> list[GHLContact]:
        """Search contacts by email, phone, or query string."""
        payload: dict = {"locationId": self.location_id, "limit": limit}
        filters: list[dict] = []

        if email:
            filters.append({"field": "email", "operator": "eq", "value": email})
        if phone:
            filters.append({"field": "phone", "operator": "eq", "value": phone})
        if query:
            filters.append({"field": "name", "operator": "contains", "value": query})

        if filters:
            payload["filters"] = filters

        data = await self._request("POST", "/contacts/search", json=payload)
        return [self._parse_contact(c) for c in data.get("contacts", [])]

    async def get_contact(self, contact_id: str) -> Optional[GHLContact]:
        """Get a single contact by ID."""
        data = await self._request("GET", f"/contacts/{contact_id}")
        return self._parse_contact(data.get("contact", {}))

    async def create_contact(self, contact: GHLContact) -> GHLContact:
        """Create a new contact in GHL."""
        payload = self._serialize_contact(contact)
        payload["locationId"] = self.location_id

        data = await self._request("POST", "/contacts/", json=payload)
        created = self._parse_contact(data.get("contact", {}))
        logger.info(f"GHL: Created contact {created.id} — {created.full_name}")
        return created

    async def update_contact(self, contact_id: str, contact: GHLContact) -> GHLContact:
        """Update an existing contact."""
        payload = self._serialize_contact(contact)
        data = await self._request("PUT", f"/contacts/{contact_id}", json=payload)
        updated = self._parse_contact(data.get("contact", {}))
        logger.info(f"GHL: Updated contact {contact_id}")
        return updated

    async def upsert_contact(self, contact: GHLContact) -> GHLContact:
        """Create or update a contact based on email match."""
        if contact.email:
            existing = await self.search_contacts(email=contact.email)
            if existing:
                return await self.update_contact(existing[0].id, contact)
        if contact.phone:
            existing = await self.search_contacts(phone=contact.phone)
            if existing:
                return await self.update_contact(existing[0].id, contact)
        return await self.create_contact(contact)

    async def delete_contact(self, contact_id: str) -> bool:
        """Delete a contact."""
        await self._request("DELETE", f"/contacts/{contact_id}")
        logger.info(f"GHL: Deleted contact {contact_id}")
        return True

    async def add_tags(self, contact_id: str, tags: list[str]):
        """Add tags to a contact."""
        await self._request("POST", f"/contacts/{contact_id}/tags", json={"tags": tags})

    async def remove_tags(self, contact_id: str, tags: list[str]):
        """Remove tags from a contact."""
        await self._request("DELETE", f"/contacts/{contact_id}/tags", json={"tags": tags})

    # ── Opportunities ───────────────────────────────────────

    async def search_opportunities(
        self, pipeline_id: Optional[str] = None, stage_id: Optional[str] = None, limit: int = 100
    ) -> list[GHLOpportunity]:
        """Search opportunities."""
        payload: dict = {"locationId": self.location_id, "limit": limit}
        if pipeline_id:
            payload["pipelineId"] = pipeline_id
        if stage_id:
            payload["pipelineStageId"] = stage_id

        data = await self._request("POST", "/opportunities/search", json=payload)
        return [self._parse_opportunity(o) for o in data.get("opportunities", [])]

    async def create_opportunity(self, opp: GHLOpportunity) -> GHLOpportunity:
        """Create an opportunity."""
        payload = {
            "locationId": self.location_id,
            "contactId": opp.contact_id,
            "name": opp.name,
            "pipelineId": opp.pipeline_id,
            "pipelineStageId": opp.stage_id,
            "status": opp.status,
            "monetaryValue": opp.monetary_value,
            "customFields": opp.custom_fields,
            "notes": opp.notes,
        }
        data = await self._request("POST", "/opportunities/", json=payload)
        created = self._parse_opportunity(data.get("opportunity", {}))
        logger.info(f"GHL: Created opportunity {created.id} — {created.name}")
        return created

    async def update_opportunity(self, opp_id: str, updates: dict) -> GHLOpportunity:
        """Update an opportunity."""
        data = await self._request("PUT", f"/opportunities/{opp_id}", json=updates)
        return self._parse_opportunity(data.get("opportunity", {}))

    # ── Pipelines ───────────────────────────────────────────

    async def list_pipelines(self) -> list[GHLPipeline]:
        """List all pipelines for this location."""
        data = await self._request("GET", f"/pipelines?locationId={self.location_id}")
        pipelines = []
        for p in data.get("pipelines", []):
            pipelines.append(GHLPipeline(
                id=p.get("id", ""),
                name=p.get("name", ""),
                stages=p.get("stages", []),
            ))
        return pipelines

    # ── Campaigns ───────────────────────────────────────────

    async def list_campaigns(self) -> list[GHLCampaign]:
        """List all email campaigns."""
        data = await self._request("GET", f"/campaigns?locationId={self.location_id}")
        return [
            GHLCampaign(
                id=c.get("id", ""),
                name=c.get("name", ""),
                status=c.get("status", ""),
                contact_count=c.get("contactCount", 0),
            )
            for c in data.get("campaigns", [])
        ]

    async def add_to_campaign(self, contact_id: str, campaign_id: str):
        """Add a contact to an email campaign."""
        await self._request("POST", f"/contacts/{contact_id}/campaigns/{campaign_id}")
        logger.info(f"GHL: Added contact {contact_id} to campaign {campaign_id}")

    # ── Custom Fields ───────────────────────────────────────

    async def list_custom_fields(self) -> list[dict]:
        """List all custom fields."""
        data = await self._request("GET", f"/custom-fields?locationId={self.location_id}")
        return data.get("customFields", [])

    async def create_custom_field(self, field_def: dict) -> dict:
        """Create a custom field."""
        field_def["locationId"] = self.location_id
        data = await self._request("POST", "/custom-fields/", json=field_def)
        return data.get("customField", {})

    # ── Webhook Verification ────────────────────────────────

    @staticmethod
    def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify a GHL webhook signature."""
        computed = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, signature)

    # ── Parsing Helpers ─────────────────────────────────────

    def _parse_contact(self, raw: dict) -> GHLContact:
        if not raw:
            return GHLContact()
        return GHLContact(
            id=raw.get("id", ""),
            email=raw.get("email", ""),
            phone=raw.get("phone", ""),
            first_name=raw.get("firstName", raw.get("first_name", "")),
            last_name=raw.get("lastName", raw.get("last_name", "")),
            company_name=raw.get("companyName", raw.get("company_name", "")),
            title=raw.get("title", ""),
            tags=raw.get("tags", []),
            custom_fields=raw.get("customFields", raw.get("custom_fields", {})),
            source=raw.get("source", ""),
            date_added=raw.get("dateAdded", raw.get("date_added", "")),
        )

    def _serialize_contact(self, c: GHLContact) -> dict:
        payload: dict = {}
        if c.email:
            payload["email"] = c.email
        if c.phone:
            payload["phone"] = c.phone
        if c.first_name:
            payload["firstName"] = c.first_name
        if c.last_name:
            payload["lastName"] = c.last_name
        if c.company_name:
            payload["companyName"] = c.company_name
        if c.title:
            payload["title"] = c.title
        if c.tags:
            payload["tags"] = c.tags
        if c.custom_fields:
            payload["customFields"] = c.custom_fields
        if c.source:
            payload["source"] = c.source
        return payload

    def _parse_opportunity(self, raw: dict) -> GHLOpportunity:
        if not raw:
            return GHLOpportunity()
        return GHLOpportunity(
            id=raw.get("id", ""),
            contact_id=raw.get("contactId", raw.get("contact_id", "")),
            name=raw.get("name", ""),
            pipeline_id=raw.get("pipelineId", raw.get("pipeline_id", "")),
            stage_id=raw.get("pipelineStageId", raw.get("pipeline_stage_id", "")),
            status=raw.get("status", "open"),
            monetary_value=float(raw.get("monetaryValue", raw.get("monetary_value", 0))),
            custom_fields=raw.get("customFields", raw.get("custom_fields", {})),
            notes=raw.get("notes", ""),
            created_at=raw.get("createdAt", raw.get("created_at", "")),
        )


# Singleton
ghl = GHLClient()
