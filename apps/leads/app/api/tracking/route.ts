import { NextRequest, NextResponse } from "next/server";
import { getDb, writeDb, EmailEvent, CRMOpportunity } from "@/lib/db";

// Transparent 1x1 pixel image in Base64
const PIXEL_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUFFER = Buffer.from(PIXEL_B64, 'base64');

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');
    const seqId = searchParams.get('seqId') || '';
    const bizId = searchParams.get('bizId') || '';

    if (action === 'open' && bizId) {
      const db = await getDb();
      
      // Add event
      const event: EmailEvent = {
        id: `evt_open_${Math.random().toString(36).substring(2, 9)}`,
        sequence_id: seqId,
        business_id: bizId,
        event_type: 'open',
        timestamp: new Date().toISOString(),
        user_agent: req.headers.get('user-agent') || 'Unknown'
      };
      db.email_events.push(event);

      // Recalculate engagement score
      await recalculateEngagement(db, bizId, 'open');

      await writeDb(db);
    }

    // Always return transparent 1x1 pixel for image tracking
    return new NextResponse(PIXEL_BUFFER, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error("Tracking open event failed:", error);
    // Silent fail so we don't break emails
    return new NextResponse(PIXEL_BUFFER, { headers: { 'Content-Type': 'image/gif' } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, bizId, seqId, linkClicked } = await req.json();
    
    if (!bizId) {
      return NextResponse.json({ error: "Missing bizId" }, { status: 400 });
    }

    const db = await getDb();
    
    // Add event
    const event: EmailEvent = {
      id: `evt_${action}_${Math.random().toString(36).substring(2, 9)}`,
      sequence_id: seqId || '',
      business_id: bizId,
      event_type: action === 'cta_click' ? 'cta_click' : 'visit_preview',
      timestamp: new Date().toISOString(),
      link_clicked: linkClicked,
      user_agent: req.headers.get('user-agent') || 'Unknown'
    };
    db.email_events.push(event);

    // Recalculate engagement score
    const newScore = await recalculateEngagement(db, bizId, action);

    await writeDb(db);

    return NextResponse.json({ success: true, engagement_score: newScore });
  } catch (error: any) {
    console.error("Tracking event failed:", error);
    return NextResponse.json({ error: error.message || "Failed to log event" }, { status: 500 });
  }
}

/**
 * COMPUTES ENGAGEMENT SCORE 0-100 BASED ON RECENT SIGNALS AND UPDATES GHL MIRROR STATE
 */
async function recalculateEngagement(db: any, bizId: string, trigger: string): Promise<number> {
  const events = db.email_events.filter((e: any) => e.business_id === bizId);
  const opp: CRMOpportunity | undefined = db.crm_opportunities.find((o: any) => o.business_id === bizId);

  if (!opp) return 0;

  // Weighted Scoring Calculation
  let score = 10; // Baseline starting score
  
  const openCount = events.filter((e: any) => e.event_type === 'open').length;
  const visitCount = events.filter((e: any) => e.event_type === 'visit_preview').length;
  const ctaClickCount = events.filter((e: any) => e.event_type === 'cta_click').length;

  score += openCount * 15; // 15 points per email open
  score += visitCount * 25; // 25 points per preview visit
  score += ctaClickCount * 35; // 35 points per CTA click

  // Cap at 100
  const finalScore = Math.min(score, 100);
  opp.lead_engagement_score = finalScore;

  // Automatically advance GoHighLevel mirrored stage based on engagement triggers
  if (trigger === 'cta_click' && opp.pipeline_stage === 'EMAIL_SENT') {
    opp.pipeline_stage = 'CLICKED';
    opp.notes = `Lead clicked Website Preview CTA button. High-value intent triggered. Stage synchronized to CLICKED.`;
  } else if (trigger === 'visit_preview' && opp.pipeline_stage === 'EMAIL_SENT') {
    opp.pipeline_stage = 'OPENED';
    opp.notes = `Lead visited customized website preview concept. Stage synchronized to OPENED.`;
  }

  opp.updated_at = new Date().toISOString();

  // Create immediate alert in log for hot lead (score >= 70)
  if (finalScore >= 70) {
    db.agent_logs.push({
      id: `log_hot_${Math.random().toString(36).substring(2, 9)}`,
      agent_name: 'Success',
      action_taken: 'Hot Intent Pipeline Alert',
      status: 'warning',
      message: `CRITICAL ALERT: Lead "${db.businesses.find((b: any) => b.id === bizId)?.name}" has hit an engagement score of ${finalScore}! Action required: manual close sequence triggered.`,
      timestamp: new Date().toISOString()
    });
  }

  return finalScore;
}
