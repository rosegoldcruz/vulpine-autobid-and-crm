import { NextRequest, NextResponse } from 'next/server';
import { getDb, writeDb } from '@/lib/db';
import {
  LEADS_HANDOFF_AUTH_HEADER,
  LEADS_HANDOFF_SOURCE_SYSTEM,
  validateVisionHandoffPayloadV1,
  type VisionHandoffPayloadV1,
} from '@/lib/contracts/leads-handoff-v1';

interface HandoffRequest {
  businessId: string;
  opportunityId?: string;
  projectName?: string;
  notes?: string;
  attachmentRefs?: string[];
}

function cleanBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function defaultProjectName(companyName: string): string {
  return `${companyName} - Bid Package`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandoffRequest;
    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const visionBase = cleanBaseUrl(process.env.VISION_API_URL || '');
    const visionKey = process.env.VISION_INTEGRATION_KEY || '';
    if (!visionBase || !visionKey) {
      return NextResponse.json(
        {
          error: 'VISION_API_URL and VISION_INTEGRATION_KEY must be configured',
        },
        { status: 503 },
      );
    }

    const db = await getDb();
    const business = db.businesses.find((entry) => entry.id === body.businessId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const correlationId = `lead-${business.id}-${Date.now()}`;
    const payload: VisionHandoffPayloadV1 = {
      projectName: body.projectName || defaultProjectName(business.name),
      sourceSystem: LEADS_HANDOFF_SOURCE_SYSTEM,
      leadId: business.id,
      accountName: business.name,
      contactName: business.name,
      contactEmail: business.email || undefined,
      contactPhone: business.phone || undefined,
      opportunityName: body.opportunityId || undefined,
      notes: body.notes || undefined,
      attachmentRefs: body.attachmentRefs || [],
      correlationId,
    };

    const contractErrors = validateVisionHandoffPayloadV1(payload);
    if (contractErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Generated handoff payload failed contract validation',
          details: contractErrors,
        },
        { status: 500 },
      );
    }

    const response = await fetch(`${visionBase}/api/integrations/leads/handoff`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [LEADS_HANDOFF_AUTH_HEADER]: visionKey,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const resultText = await response.text();
    let resultJson: unknown = null;
    try {
      resultJson = JSON.parse(resultText);
    } catch {
      resultJson = { raw: resultText };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Vision handoff failed',
          status: response.status,
          details: resultJson,
        },
        { status: 502 },
      );
    }

    db.agent_logs.push({
      id: `log_handoff_${Math.random().toString(36).slice(2, 9)}`,
      agent_name: 'Sales',
      action_taken: 'Lead Handoff to Vision',
      status: 'success',
      message: `Lead ${business.id} handed off to Vision with correlation ${correlationId}.`,
      timestamp: new Date().toISOString(),
    });

    const opportunity = body.opportunityId
      ? db.crm_opportunities.find((entry) => entry.id === body.opportunityId)
      : db.crm_opportunities.find((entry) => entry.business_id === body.businessId);

    if (opportunity) {
      opportunity.notes = `${opportunity.notes || ''}\n[Vision Handoff] correlation=${correlationId}`.trim();
      opportunity.updated_at = new Date().toISOString();
    }

    await writeDb(db);

    return NextResponse.json({
      success: true,
      correlationId,
      vision: resultJson,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to handoff lead' }, { status: 500 });
  }
}
