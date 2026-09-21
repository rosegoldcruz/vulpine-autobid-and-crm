"""
GoHighLevel Custom Field Definitions for Vulpine Cabinets.
These fields must exist in GHL for the engine to function.
Run `python -m services.ghl_bridge.setup_fields` to ensure they exist.
"""

from enum import Enum


# ── Field Categories ────────────────────────────────────────

class FieldType(str, Enum):
    TEXT = "text"
    TEXTAREA = "large_text"
    NUMBER = "numeric"
    DATE = "date"
    DROPDOWN = "single_options"
    MULTI_SELECT = "multiple_options"
    CHECKBOX = "checkbox"
    URL = "url"
    CURRENCY = "monetary"


# ── Contact Custom Fields ───────────────────────────────────

CONTACT_FIELDS = [
    {
        "name": "cabinet_opportunity_score",
        "label": "Cabinet Opportunity Score",
        "type": FieldType.NUMBER.value,
        "description": "0-100 score for cabinet buying likelihood",
    },
    {
        "name": "cabinet_score_tier",
        "label": "Cabinet Score Tier",
        "type": FieldType.DROPDOWN.value,
        "options": ["BID_NOW", "HIGH_PRIORITY", "DEVELOP", "MONITOR", "ARCHIVE", "DISQUALIFIED"],
        "description": "Classification tier based on opportunity score",
    },
    {
        "name": "contact_role_category",
        "label": "Contact Role Category",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "Estimator",
            "Project Manager",
            "Purchasing Agent",
            "Preconstruction",
            "Project Executive",
            "Owner/Developer",
            "Architect",
            "General Contractor",
            "Subcontractor",
            "Property Manager",
            "Hospitality Director",
            "Other",
        ],
        "description": "Classified role in buying process",
    },
    {
        "name": "buyer_influence_level",
        "label": "Buyer Influence Level",
        "type": FieldType.DROPDOWN.value,
        "options": ["Direct Decision Maker", "Influencer", "Gatekeeper", "No Influence", "Unknown"],
        "description": "Level of purchasing influence",
    },
    {
        "name": "company_type",
        "label": "Company Type",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "General Contractor",
            "Developer",
            "Owner/Operator",
            "Architect",
            "Construction Manager",
            "Subcontractor",
            "Property Management",
            "Hospitality Group",
            "Senior Living Operator",
            "Student Housing",
            "Multifamily Developer",
            "Renovation Contractor",
            "Other",
        ],
        "description": "Classified company type for cabinet demand",
    },
    {
        "name": "active_projects_count",
        "label": "Active Projects Count",
        "type": FieldType.NUMBER.value,
        "description": "Number of active construction projects known",
    },
    {
        "name": "estimated_annual_cabinet_volume",
        "label": "Estimated Annual Cabinet Volume",
        "type": FieldType.CURRENCY.value,
        "description": "Estimated annual spend on cabinets/casework",
    },
    {
        "name": "geographic_markets",
        "label": "Geographic Markets",
        "type": FieldType.TEXT.value,
        "description": "Primary markets served (states/regions)",
    },
    {
        "name": "last_outreach_date",
        "label": "Last Outreach Date",
        "type": FieldType.DATE.value,
        "description": "Date of most recent outreach",
    },
    {
        "name": "last_reply_date",
        "label": "Last Reply Date",
        "type": FieldType.DATE.value,
        "description": "Date contact last replied",
    },
    {
        "name": "outreach_sequence",
        "label": "Outreach Sequence",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "project_specific",
            "gc_account",
            "developer_owner",
            "renovation_refacing",
            "none",
        ],
        "description": "Active outreach sequence type",
    },
    {
        "name": "reply_intent",
        "label": "Reply Intent",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "send_plans",
            "add_to_bid_list",
            "contact_estimator",
            "bid_date_confirmed",
            "already_have_supplier",
            "not_interested",
            "wrong_person",
            "call_me",
            "future_projects",
            "vendor_registration",
            "out_of_office",
            "unsubscribe",
            "pending",
        ],
        "description": "Classified intent of last reply",
    },
    {
        "name": "lead_source",
        "label": "Lead Source",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "PlanHub",
            "BuildingConnected",
            "Seamless",
            "ZoomInfo",
            "VIP Cabinets",
            "RefaceKit",
            "Cabinets4Less",
            "Rep Submission",
            "Email Bid Invite",
            "Inbound",
            "CSV Import",
            "Other",
        ],
        "description": "Origin of the lead",
    },
    {
        "name": "supplier_indicators",
        "label": "Supplier Indicators",
        "type": FieldType.TEXT.value,
        "description": "Known existing cabinet supplier relationships",
    },
    {
        "name": "product_fit",
        "label": "Product Fit",
        "type": FieldType.DROPDOWN.value,
        "options": ["Excellent", "Good", "Fair", "Poor", "Unknown"],
        "description": "How well Vulpine products match this buyer's needs",
    },
]


# ── Opportunity Custom Fields ───────────────────────────────

OPPORTUNITY_FIELDS = [
    {
        "name": "project_name",
        "label": "Project Name",
        "type": FieldType.TEXT.value,
        "description": "Name of the construction project",
    },
    {
        "name": "project_type",
        "label": "Project Type",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "Multifamily",
            "Hospitality",
            "Senior Living",
            "Student Housing",
            "Commercial",
            "Mixed-Use",
            "Single Family",
            "Renovation",
            "Tenant Improvement",
            "Government",
            "Healthcare",
            "Education",
            "Other",
        ],
        "description": "Type of construction project",
    },
    {
        "name": "project_value",
        "label": "Project Value",
        "type": FieldType.CURRENCY.value,
        "description": "Total project construction value",
    },
    {
        "name": "cabinet_scope",
        "label": "Cabinet Scope",
        "type": FieldType.TEXTAREA.value,
        "description": "Description of cabinet/casework scope",
    },
    {
        "name": "unit_count",
        "label": "Unit Count",
        "type": FieldType.NUMBER.value,
        "description": "Number of units or rooms requiring cabinets",
    },
    {
        "name": "bid_date",
        "label": "Bid Date",
        "type": FieldType.DATE.value,
        "description": "Project bid due date",
    },
    {
        "name": "bid_time",
        "label": "Bid Time",
        "type": FieldType.TEXT.value,
        "description": "Time of bid deadline",
    },
    {
        "name": "plans_received",
        "label": "Plans Received",
        "type": FieldType.CHECKBOX.value,
        "description": "Have plans/specs been received?",
    },
    {
        "name": "plans_location",
        "label": "Plans Location",
        "type": FieldType.URL.value,
        "description": "URL or path to plan documents",
    },
    {
        "name": "addenda_count",
        "label": "Addenda Count",
        "type": FieldType.NUMBER.value,
        "description": "Number of addenda issued",
    },
    {
        "name": "addenda_acknowledged",
        "label": "Addenda Acknowledged",
        "type": FieldType.CHECKBOX.value,
        "description": "All addenda acknowledged?",
    },
    {
        "name": "submission_method",
        "label": "Submission Method",
        "type": FieldType.DROPDOWN.value,
        "options": ["Email", "Portal", "In-Person", "Other"],
        "description": "How the bid must be submitted",
    },
    {
        "name": "submission_portal_url",
        "label": "Submission Portal URL",
        "type": FieldType.URL.value,
        "description": "URL for bid submission portal",
    },
    {
        "name": "estimated_package_size",
        "label": "Estimated Package Size",
        "type": FieldType.CURRENCY.value,
        "description": "Estimated dollar value of cabinet package",
    },
    {
        "name": "supplier_quoted",
        "label": "Supplier Quoted",
        "type": FieldType.DROPDOWN.value,
        "options": ["Not Sent", "Sent", "Acknowledged", "Pricing Received", "N/A"],
        "description": "RFQ status with supplier",
    },
    {
        "name": "bid_status",
        "label": "Bid Status",
        "type": FieldType.DROPDOWN.value,
        "options": [
            "Not Started",
            "Estimating",
            "Supplier RFQ Out",
            "Pricing",
            "Pending Approval",
            "Submitted",
            "Revision Requested",
            "Verbal Award",
            "Contracted",
            "Lost",
            "Dead",
            "No Bid",
        ],
        "description": "Current status of the bid",
    },
    {
        "name": "competitor_notes",
        "label": "Competitor Notes",
        "type": FieldType.TEXTAREA.value,
        "description": "Known competing bidders or supplier information",
    },
    {
        "name": "win_probability",
        "label": "Win Probability",
        "type": FieldType.NUMBER.value,
        "description": "Estimated win probability 0-100",
    },
]


# ── Tags for Automated Workflows ────────────────────────────

CABINET_TAGS = {
    # Scoring tags
    "score_bid_now": "CABINET_BID_NOW",
    "score_high": "CABINET_HIGH_PRIORITY",
    "score_develop": "CABINET_DEVELOP",
    "score_monitor": "CABINET_MONITOR",
    "score_archive": "CABINET_ARCHIVE",
    "disqualified": "CABINET_DISQUALIFIED",

    # Sequence tags
    "seq_project": "SEQ_PROJECT_SPECIFIC",
    "seq_gc": "SEQ_GC_ACCOUNT",
    "seq_developer": "SEQ_DEVELOPER_OWNER",
    "seq_renovation": "SEQ_RENOVATION_REFACING",

    # Status tags
    "plans_received": "PLANS_RECEIVED",
    "bid_submitted": "BID_SUBMITTED",
    "revision_requested": "REVISION_REQUESTED",
    "verbal_award": "VERBAL_AWARD",
    "contracted": "CONTRACTED",
    "lost": "CABINET_LOST",
    "dead": "CABINET_DEAD",

    # Reply tags
    "reply_hot": "REPLY_HOT",
    "reply_needs_attention": "REPLY_NEEDS_ATTENTION",
    "reply_out_of_office": "REPLY_OUT_OF_OFFICE",
    "reply_unsubscribe": "UNSUBSCRIBE",

    # Role tags
    "role_estimator": "ROLE_ESTIMATOR",
    "role_pm": "ROLE_PROJECT_MANAGER",
    "role_purchasing": "ROLE_PURCHASING",
    "role_executive": "ROLE_EXECUTIVE",
    "role_developer": "ROLE_DEVELOPER",

    # Source tags
    "source_planhub": "SOURCE_PLANHUB",
    "source_bc": "SOURCE_BUILDINGCONNECTED",
    "source_zoominfo": "SOURCE_ZOOMINFO",
    "source_seamless": "SOURCE_SEAMLESS",
    "source_rep": "SOURCE_REP",
    "source_inbound": "SOURCE_INBOUND",
}


def get_all_field_definitions() -> list[dict]:
    """Return all custom field definitions for setup."""
    fields = []
    for f in CONTACT_FIELDS:
        f["model"] = "contact"
        fields.append(f.copy())
    for f in OPPORTUNITY_FIELDS:
        f["model"] = "opportunity"
        fields.append(f.copy())
    return fields
