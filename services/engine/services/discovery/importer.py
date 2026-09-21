"""
Lead Importer Service
Normalizes, deduplicates, validates, and imports leads into GHL.

Supports:
- CSV files (Seamless, ZoomInfo exports, rep lists, any spreadsheet)
- ZoomInfo API enrichment
- Manual JSON payloads via API
"""

import csv
import io
import re
from typing import Optional
from dataclasses import dataclass, field
from email_validator import validate_email, EmailNotValidError
from loguru import logger

from shared.config import settings
from shared.ai import ai, AIMessage, TaskType
from services.ghl_bridge.client import ghl, GHLContact
from services.ghl_bridge.custom_fields import CABINET_TAGS


# ── Data Classes ────────────────────────────────────────────


@dataclass
class RawLead:
    """Unprocessed lead from any source before normalization."""
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    phone: str = ""
    company_name: str = ""
    title: str = ""
    source: str = "csv_import"
    raw_data: dict = field(default_factory=dict)


@dataclass
class ImportResult:
    total: int = 0
    created: int = 0
    updated: int = 0
    skipped_duplicate: int = 0
    skipped_invalid: int = 0
    errors: list[str] = field(default_factory=list)


# ── Normalization ───────────────────────────────────────────


def normalize_phone(phone: str) -> str:
    """Strip to digits, handle US country code."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return f"+{digits}" if digits else ""


def normalize_email(email: str) -> str:
    """Lowercase and strip whitespace."""
    return email.strip().lower() if email else ""


def validate_email_address(email: str) -> bool:
    """Check if email is deliverable format."""
    if not email:
        return False
    try:
        validate_email(email, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def is_disposable_email(email: str) -> bool:
    """Check for disposable email domains."""
    disposable_domains = {
        "mailinator.com", "guerrillamail.com", "10minutemail.com",
        "tempmail.com", "throwaway.email", "yopmail.com", "sharklasers.com",
        "trashmail.com", "dispostable.com", "fakeinbox.com",
    }
    domain = email.split("@")[-1] if "@" in email else ""
    return domain.lower() in disposable_domains


def normalize_company(company: str) -> str:
    """Clean company name."""
    if not company:
        return ""
    company = company.strip()
    # Remove common suffixes for matching
    suffixes = [", Inc.", ", Inc", " Inc.", " Inc", ", LLC", " LLC", ", Ltd.", " Ltd"]
    return company


def normalize_lead(raw: RawLead) -> GHLContact:
    """Convert a raw lead into a normalized GHLContact."""
    email = normalize_email(raw.email)
    phone = normalize_phone(raw.phone)

    contact = GHLContact(
        email=email,
        phone=phone,
        first_name=raw.first_name.strip().title() if raw.first_name else "",
        last_name=raw.last_name.strip().title() if raw.last_name else "",
        company_name=normalize_company(raw.company_name),
        title=raw.title.strip() if raw.title else "",
        source=raw.source,
        custom_fields={"lead_source": raw.source},
    )

    return contact


# ── Deduplication ───────────────────────────────────────────


async def find_duplicate(contact: GHLContact) -> Optional[GHLContact]:
    """Check if a contact already exists in GHL by email or phone."""
    if contact.email:
        matches = await ghl.search_contacts(email=contact.email)
        if matches:
            return matches[0]
    if contact.phone:
        matches = await ghl.search_contacts(phone=contact.phone)
        if matches:
            return matches[0]
    return None


# ── AI Classification ───────────────────────────────────────


async def classify_contact_role(contact: GHLContact) -> dict:
    """Use AI to classify contact role and company type from title and company."""
    prompt = f"""
Analyze this construction industry contact and classify them.

Contact:
- Name: {contact.full_name}
- Title: {contact.title}
- Company: {contact.company_name}

Return JSON:
{{
    "role_category": "Estimator|Project Manager|Purchasing Agent|Preconstruction|Project Executive|Owner/Developer|Architect|General Contractor|Subcontractor|Property Manager|Hospitality Director|Other",
    "company_type": "General Contractor|Developer|Owner/Operator|Architect|Construction Manager|Subcontractor|Property Management|Hospitality Group|Senior Living Operator|Student Housing|Multifamily Developer|Renovation Contractor|Other",
    "buyer_influence": "Direct Decision Maker|Influencer|Gatekeeper|No Influence|Unknown",
    "confidence": 0.0-1.0
}}
"""
    messages = [
        AIMessage(role="system", content="You are a construction industry classification expert. Be conservative in estimates. Return only JSON."),
        AIMessage(role="user", content=prompt),
    ]

    try:
        result = await ai.complete_json(messages, task=TaskType.CHEAP, model=settings.cheap_model)
        return result
    except Exception as e:
        logger.warning(f"AI classification failed for {contact.full_name}: {e}")
        return {"role_category": "Other", "company_type": "Other", "buyer_influence": "Unknown", "confidence": 0.0}


# ── CSV Import ──────────────────────────────────────────────


def parse_csv(file_content: str) -> list[RawLead]:
    """Parse CSV content into raw leads. Handles various column naming conventions."""
    reader = csv.DictReader(io.StringIO(file_content))
    leads = []

    # Map common column name variations
    field_map = {
        "first_name": ["first name", "firstname", "fname", "first", "given name"],
        "last_name": ["last name", "lastname", "lname", "last", "surname", "family name"],
        "email": ["email", "e-mail", "email address", "e mail", "work email", "primary email"],
        "phone": ["phone", "phone number", "telephone", "mobile", "cell", "direct phone", "work phone"],
        "company_name": ["company", "company name", "organization", "org", "business", "account name"],
        "title": ["title", "job title", "position", "role", "designation"],
    }

    for row in reader:
        # Normalize header names
        normalized = {}
        for row_key, row_val in row.items():
            rk = row_key.strip().lower()
            normalized[rk] = row_val

        def _get(*keys):
            for k in keys:
                if k in normalized and normalized[k]:
                    return normalized[k]
            return ""

        lead = RawLead(
            first_name=_get("first name", "firstname", "fname", "first", "given name"),
            last_name=_get("last name", "lastname", "lname", "last", "surname"),
            email=_get("email", "e-mail", "email address", "work email"),
            phone=_get("phone", "phone number", "telephone", "mobile", "cell", "direct phone"),
            company_name=_get("company", "company name", "organization", "org", "business"),
            title=_get("title", "job title", "position", "role"),
            source="csv_import",
            raw_data=row,
        )
        leads.append(lead)

    return leads


# ── Main Import Pipeline ────────────────────────────────────


async def import_leads(leads: list[RawLead], classify: bool = True) -> ImportResult:
    """Full import pipeline: normalize → validate → deduplicate → classify → insert."""
    result = ImportResult(total=len(leads))

    for raw in leads:
        try:
            # Normalize
            contact = normalize_lead(raw)

            # Validate
            if not contact.email or not validate_email_address(contact.email):
                result.skipped_invalid += 1
                logger.debug(f"Invalid email: {raw.email}")
                continue

            if is_disposable_email(contact.email):
                result.skipped_invalid += 1
                logger.debug(f"Disposable email: {contact.email}")
                continue

            # Deduplicate
            existing = await find_duplicate(contact)
            if existing:
                result.skipped_duplicate += 1
                logger.debug(f"Duplicate: {contact.email} → existing {existing.id}")
                # Still update if we have new info
                if raw.title and not existing.title:
                    await ghl.update_contact(existing.id, GHLContact(title=raw.title))
                continue

            # AI Classification
            if classify and (raw.title or raw.company_name):
                classification = await classify_contact_role(contact)
                contact.custom_fields["contact_role_category"] = classification.get("role_category", "Other")
                contact.custom_fields["company_type"] = classification.get("company_type", "Other")
                contact.custom_fields["buyer_influence_level"] = classification.get("buyer_influence", "Unknown")

            # Insert into GHL
            await ghl.create_contact(contact)
            result.created += 1

        except Exception as e:
            result.errors.append(f"{raw.email}: {str(e)}")
            logger.error(f"Import error for {raw.email}: {e}")

    logger.info(f"Import complete: {result}")
    return result
