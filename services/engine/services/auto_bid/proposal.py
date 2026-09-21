"""
Proposal Engine.
Generates proposal documents from approved BOM + pricing versions.
Uses Jinja2 templates and ReportLab for PDF generation.
"""

import os
import uuid
from datetime import datetime, date, timezone
from typing import Optional, List
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from services.auto_bid.models import (
    ProposalVersion, PricingVersion, BOMVersion, BOMLine,
    QARun, AutoBidProject, PricingLine,
)

from shared.config import settings


# Default Jinja2 template for proposal HTML
PROPOSAL_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ title }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #1a1a1a;
            margin: 40px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 3px solid #c8a05c;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            color: #1a1a1a;
        }
        .header .subtitle {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            font-size: 18px;
            color: #c8a05c;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .summary-item {
            padding: 10px;
            background: #f8f8f8;
            border-radius: 4px;
        }
        .summary-item .label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
        }
        .summary-item .value {
            font-size: 18px;
            font-weight: bold;
            color: #1a1a1a;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th {
            text-align: left;
            padding: 8px 12px;
            background: #f0f0f0;
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
        }
        td {
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
        }
        .total-row td {
            font-weight: bold;
            border-top: 2px solid #c8a05c;
            font-size: 16px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ title }}</h1>
        <div class="subtitle">
            Proposal {{ proposal_number }} · {{ proposal_date }} · Valid until {{ valid_until }}
        </div>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <p>{{ executive_summary }}</p>
    </div>

    <div class="section">
        <h2>Scope Summary</h2>
        <p>{{ scope_summary }}</p>
    </div>

    <div class="section">
        <h2>Investment Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="label">Total Cabinets</div>
                <div class="value">{{ total_cabinets }}</div>
            </div>
            <div class="summary-item">
                <div class="label">Total Price</div>
                <div class="value">${{ "%.2f"|format(total_price) }}</div>
            </div>
            <div class="summary-item">
                <div class="label">Estimated Lead Time</div>
                <div class="value">{{ estimated_lead_time or 'TBD' }}</div>
            </div>
            <div class="summary-item">
                <div class="label">Valid Until</div>
                <div class="value">{{ valid_until }}</div>
            </div>
        </div>
    </div>

    {% if bom_lines %}
    <div class="section">
        <h2>Bill of Materials</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Cabinet Type</th>
                    <th>Room</th>
                    <th>Qty</th>
                    <th>SKU</th>
                </tr>
            </thead>
            <tbody>
                {% for line in bom_lines %}
                <tr>
                    <td>{{ line.line_number }}</td>
                    <td>{{ line.cabinet_type or 'N/A' }}</td>
                    <td>{{ line.room_label or 'N/A' }}</td>
                    <td>{{ line.quantity }}</td>
                    <td>{{ line.sku_code or 'Unmapped' }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}

    <div class="section">
        <h2>Terms</h2>
        <p><strong>Warranty:</strong> {{ warranty_terms or 'Standard manufacturer warranty applies.' }}</p>
        <p><strong>Payment:</strong> {{ payment_terms or '50% deposit with order, 50% upon delivery.' }}</p>
        <p><strong>Validity:</strong> This proposal is valid until {{ valid_until }}.</p>
    </div>

    <div class="footer">
        <p>Vulpine Cabinetry · Proposals are subject to final review and site verification.</p>
        <p>Generated: {{ generated_at }}</p>
    </div>
</body>
</html>"""


def generate_proposal_html(
    title: str,
    proposal_number: str,
    proposal_date: date,
    valid_until: date,
    executive_summary: str,
    scope_summary: str,
    total_price: float,
    total_cabinets: int,
    estimated_lead_time: str,
    warranty_terms: str,
    payment_terms: str,
    bom_lines: List[dict] = None,
) -> str:
    """Generate proposal HTML from template."""
    from jinja2 import Template

    template = Template(PROPOSAL_HTML_TEMPLATE)
    html = template.render(
        title=title,
        proposal_number=proposal_number,
        proposal_date=proposal_date.strftime("%B %d, %Y") if proposal_date else "",
        valid_until=valid_until.strftime("%B %d, %Y") if valid_until else "",
        executive_summary=executive_summary,
        scope_summary=scope_summary,
        total_price=total_price or 0,
        total_cabinets=total_cabinets or 0,
        estimated_lead_time=estimated_lead_time,
        warranty_terms=warranty_terms,
        payment_terms=payment_terms,
        bom_lines=bom_lines or [],
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    )
    return html


def generate_proposal_pdf(html: str, output_path: str) -> str:
    """Generate a PDF from HTML using ReportLab (simplified)."""
    # For now, we'll save the HTML and create a simple PDF with ReportLab
    # A full HTML-to-PDF would need weasyprint or similar
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=24, textColor=colors.HexColor('#1a1a1a'))
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#c8a05c'))

    story = []
    story.append(Paragraph("Vulpine Cabinetry — Proposal", title_style))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("This proposal was generated by the Vulpine Auto Bidder system.", styles['Normal']))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Full proposal details are available in the HTML version.", styles['Normal']))
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("Please contact your Vulpine representative for the complete proposal package.", styles['Normal']))

    doc.build(story)
    return output_path


async def generate_proposal(
    db: AsyncSession,
    auto_bid_project_id: uuid.UUID,
    pricing_version_id: uuid.UUID,
    bom_version_id: uuid.UUID,
    qa_run_id: Optional[uuid.UUID] = None,
    template_name: str = "default",
) -> ProposalVersion:
    """
    Generate a proposal version from approved BOM + pricing.
    The proposal is tied to specific versions of BOM, pricing, and QA.
    """
    # Get pricing version
    result = await db.execute(
        select(PricingVersion).where(PricingVersion.id == pricing_version_id)
    )
    pricing = result.scalar_one_or_none()
    if not pricing:
        raise ValueError(f"Pricing version {pricing_version_id} not found")

    # Get BOM version
    result = await db.execute(
        select(BOMVersion).where(BOMVersion.id == bom_version_id)
    )
    bom = result.scalar_one_or_none()
    if not bom:
        raise ValueError(f"BOM version {bom_version_id} not found")

    # Get BOM lines with SKU info
    result = await db.execute(
        select(BOMLine)
        .where(BOMLine.bom_version_id == bom_version_id)
        .order_by(BOMLine.line_number)
    )
    bom_lines = list(result.scalars().all())

    # Get pricing lines for SKU codes
    result = await db.execute(
        select(PricingLine)
        .where(PricingLine.pricing_version_id == pricing_version_id)
        .order_by(PricingLine.line_number)
    )
    pricing_lines = list(result.scalars().all())
    sku_code_map = {pl.bom_line_id: pl.sku_code for pl in pricing_lines}

    # Determine next proposal version
    result = await db.execute(
        select(func.max(ProposalVersion.version_number))
        .where(ProposalVersion.auto_bid_project_id == auto_bid_project_id)
    )
    max_version = result.scalar()
    next_version = (max_version or 0) + 1

    # Generate proposal number
    result = await db.execute(
        select(AutoBidProject).where(AutoBidProject.id == auto_bid_project_id)
    )
    project = result.scalar_one_or_none()
    project_name = project.name if project else "Project"
    proposal_number = f"VA-{date.today().year}-{next_version:04d}"

    today = date.today()
    from datetime import timedelta
    valid_until = today + timedelta(days=30)

    # Build BOM line data for template
    bom_line_data = [
        {
            "line_number": line.line_number,
            "cabinet_type": line.cabinet_type,
            "room_label": line.room_label,
            "quantity": line.quantity,
            "sku_code": sku_code_map.get(line.id),
        }
        for line in bom_lines
    ]

    # Generate content
    executive_summary = (
        f"Vulpine Cabinetry is pleased to submit this proposal for {project_name}. "
        f"This proposal includes {bom.total_cabinets} cabinet units across {bom.total_lines} line items, "
        f"with a total investment of ${float(pricing.suggested_sell_price or 0):,.2f}."
    )

    scope_summary = (
        f"The scope of work includes the supply of cabinetry as detailed in the attached bill of materials. "
        f"All cabinets are specified per the design intent documents. "
        f"This proposal is based on BOM version {bom.version_number} and pricing version {pricing.version_number}."
    )

    # Generate HTML
    html = generate_proposal_html(
        title=f"Vulpine Cabinetry — {project_name}",
        proposal_number=proposal_number,
        proposal_date=today,
        valid_until=valid_until,
        executive_summary=executive_summary,
        scope_summary=scope_summary,
        total_price=float(pricing.suggested_sell_price or 0),
        total_cabinets=bom.total_cabinets or 0,
        estimated_lead_time="6-8 weeks ARO",
        warranty_terms="Standard 5-year manufacturer warranty on all cabinet hardware and construction.",
        payment_terms="50% deposit with order, 50% upon delivery.",
        bom_lines=bom_line_data,
    )

    # Save files
    upload_dir = settings.upload_dir / "proposals" / str(auto_bid_project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    html_path = upload_dir / f"proposal_v{next_version}.html"
    pdf_path = upload_dir / f"proposal_v{next_version}.pdf"

    with open(html_path, 'w') as f:
        f.write(html)

    try:
        generate_proposal_pdf(html, str(pdf_path))
    except Exception as e:
        logger.warning(f"PDF generation failed: {e}")
        pdf_path = None

    # Create proposal version
    proposal = ProposalVersion(
        auto_bid_project_id=auto_bid_project_id,
        pricing_version_id=pricing_version_id,
        bom_version_id=bom_version_id,
        qa_run_id=qa_run_id,
        version_number=next_version,
        status="DRAFT",
        title=f"Vulpine Cabinetry — {project_name}",
        proposal_number=proposal_number,
        proposal_date=today,
        valid_until=valid_until,
        executive_summary=executive_summary,
        scope_summary=scope_summary,
        total_price=float(pricing.suggested_sell_price or 0),
        total_cabinets=bom.total_cabinets or 0,
        estimated_lead_time="6-8 weeks ARO",
        warranty_terms="Standard 5-year manufacturer warranty on all cabinet hardware and construction.",
        payment_terms="50% deposit with order, 50% upon delivery.",
        pdf_file_path=str(pdf_path) if pdf_path else None,
        html_file_path=str(html_path),
        template_name=template_name,
    )
    db.add(proposal)
    await db.flush()

    logger.info(f"Generated proposal v{next_version}: {proposal_number}")
    return proposal