import { NextRequest, NextResponse } from "next/server";
import { getDb, writeDb, updateDb, Business, BusinessScore, WebsiteAudit, WebsitePreview, EmailSequence, CRMOpportunity, AgentLog } from "@/lib/db";
import { getGeminiClient, GEMINI_TEXT_MODEL, parseMarkdownJson } from "@/lib/gemini";

// Standard templates colors mapping based on task 08
const COLOR_SCHEMES = {
  HVAC: { primary: '#0284c7', secondary: '#f97316' }, // Blue & Orange
  MedSpa: { primary: '#db2777', secondary: '#fdf2f8' }, // Pink & Rose
  Roofing: { primary: '#451a03', secondary: '#eab308' }, // Brown & Yellow
  Cabinetry: { primary: '#0f172a', secondary: '#f8fafc' }, // Slate & White
  Landscaping: { primary: '#15803d', secondary: '#f0fdf4' }, // Green & Mint
  Professional: { primary: '#1e3a8a', secondary: '#f8fafc' }, // Navy & White
  Restaurant: { primary: '#991b1b', secondary: '#fffbeb' }, // Red & Cream
  Contractor: { primary: '#b45309', secondary: '#fffbeb' }, // Amber & Cream
};

/**
 * MAIN GET DISPATCHER FOR RECOVERING THE DB OR RESOLVING A SPECIFIC PREVIEW
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const searchParams = req.nextUrl.searchParams;
    const slug = searchParams.get('slug');

    if (slug) {
      const preview = db.website_previews.find(p => p.slug === slug);
      if (!preview) {
        return NextResponse.json({ error: "Preview concept not found" }, { status: 404 });
      }
      const business = db.businesses.find(b => b.id === preview.business_id);
      return NextResponse.json({ success: true, preview, business });
    }

    return NextResponse.json({ success: true, db });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch database content" }, { status: 500 });
  }
}

/**
 * MAIN POST DISPATCHER FOR THE AUTONOMOUS PIPELINE
 */
export async function POST(req: NextRequest) {
  try {
    const { action, ...params } = await req.json();
    const db = await getDb();

    switch (action) {
      case "source":
        return await handleSourcing(params.niche, params.city);

      case "audit":
        return await handleAuditAndScoring(params.businessId);

      case "preview":
        return await handlePreviewGeneration(params.businessId);

      case "copywrite":
        return await handleCopywriting(params.businessId);

      case "ceo-run":
        return await handleCEORun();

      case "reset":
        // Helper to reset the db to default state
        const resetData = {
          businesses: [
            {
              id: 'biz_01',
              name: 'Apex Heating & Air',
              category: 'HVAC' as const,
              city: 'Denver',
              phone: '(303) 555-0142',
              website: 'apexdenverhvac.com',
              email: 'contact@apexdenverhvac.com',
              linkedin: 'linkedin.com/company/apex-denver-hvac',
              has_email: true,
              has_phone: true,
              has_website: true,
              has_linkedin: true,
              is_eligible: true,
              source: 'ZoomInfo' as const,
              company_size: '10-25',
              rating: 4.2,
              review_count: 38,
              created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
            },
            {
              id: 'biz_02',
              name: 'Greenfield Landscaping Solutions',
              category: 'Landscaping' as const,
              city: 'Boston',
              phone: '(617) 555-0199',
              website: '',
              email: 'greenfieldboston@gmail.com',
              linkedin: '',
              has_email: true,
              has_phone: true,
              has_website: false,
              has_linkedin: false,
              is_eligible: true,
              source: 'Places Scraper' as const,
              company_size: '2-5',
              rating: 4.8,
              review_count: 54,
              created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
            },
            {
              id: 'biz_03',
              name: 'Radiant Skin & Body MedSpa',
              category: 'MedSpa' as const,
              city: 'Dallas',
              phone: '(214) 555-0163',
              website: 'radiantdalmedspa.com',
              email: 'info@radiantdalmedspa.com',
              linkedin: 'linkedin.com/company/radiant-skin-medspa',
              has_email: true,
              has_phone: true,
              has_website: true,
              has_linkedin: true,
              is_eligible: true,
              source: 'ZoomInfo' as const,
              company_size: '5-10',
              rating: 3.8,
              review_count: 142,
              created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
            }
          ],
          business_scores: [
            {
              id: 'score_01',
              business_id: 'biz_01',
              score: 35,
              website_exists: 15,
              mobile_friendly: 5,
              page_speed: 5,
              clear_cta: 0,
              booking_form: 0,
              reviews_displayed: 5,
              service_pages: 5,
              tracking_pixel: 0,
              crm_indicators: 0,
              capture_elements: 0,
              modern_design: 0,
              analytics_detected: 0,
              classification: 'Weak' as const,
              reasoning: 'Website exists, but it loads very slowly on mobile devices and lacks a clear call-to-action above the fold. There is no automated contact or booking form, forcing customers to call. No CRM tracking pixel or analytics platforms are detected, missing massive retargeting opportunities.',
              created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
            }
          ],
          website_audits: [
            {
              id: 'audit_01',
              business_id: 'biz_01',
              executive_summary: 'Apex Heating & Air has a baseline digital presence that is severely hurting their mobile conversions. With a design language dating back 8+ years, they are leaking leads to competitors who offer online bookings.',
              design_quality: 3,
              conversion_assessment: 'Leads drop off immediately due to slow loading times (5.4 seconds on mobile) and the absence of any contact or booking form on the home page. The site relies solely on a flat phone number link.',
              strongest_asset: 'They display a few high-quality photos of real completed installations which adds credibility.',
              revenue_opportunities: [
                { description: 'Implement instant SMS-enabled online booking with automatic technician dispatch.', potential_dollars: 18500 },
                { description: 'Add Google review sync to showcase positive customer feedback above the fold.', potential_dollars: 12000 },
                { description: 'Deploy a missed-call text-back automated campaign via GoHighLevel to salvage unanswered phone leads.', potential_dollars: 24000 }
              ],
              infrastructure_gaps: ['Online Booking System', 'GoHighLevel Lead Capture Form', 'Google Analytics', 'Facebook Tracking Pixel', 'Missed-Call Text-Back Automation'],
              recommended_offer_tier: 'Rebuild Package + Lead Infrastructure',
              outreach_angle: 'BAD_WEBSITE' as const,
              created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
            }
          ],
          website_previews: [
            {
              id: 'preview_01',
              business_id: 'biz_01',
              slug: 'apex-heating-air-preview',
              template_id: 'hvac_plumbing',
              primary_color: '#0284c7',
              secondary_color: '#f97316',
              headline: 'Denver’s Fast, Reliable Heating & Cooling Specialists',
              services: ['Residential AC Install & Repair', 'Furnace Maintenance & Service', 'Emergency HVAC Support 24/7', 'Indoor Air Quality Audits'],
              about_text: 'For years, Apex Heating & Air has kept Denver families comfortable in every season. We combine elite-level HVAC expertise with transparent, upfront pricing and prompt service.',
              review_highlights: ['Fast AC repair on a 95-degree day! Absolutely saved us.', 'Super professional technicians and great explanation of pricing.', 'Clean work and on-time. Will use Apex for all my furnace needs.'],
              visits: 8,
              clicks: 3,
              claimed: false,
              created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
            }
          ],
          email_sequences: [],
          email_events: [],
          suppression_list: [],
          crm_opportunities: [
            {
              id: 'opp_01',
              business_id: 'biz_01',
              pipeline_stage: 'SCORED' as const,
              ghl_opportunity_id: 'ghl_opp_101',
              lead_engagement_score: 15,
              notes: 'Lead scored and audit ready for outreach copywriting.',
              created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
              updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
            }
          ],
          proposals: [],
          fulfillment_projects: [],
          fulfillment_tasks: [],
          agent_logs: [
            { id: 'log_reset', agent_name: 'CEO' as const, action_taken: 'Database Reset', status: 'success' as const, message: 'Database reset to initial demo state successfully.', timestamp: new Date().toISOString() }
          ]
        };
        await writeDb(resetData);
        return NextResponse.json({ success: true, message: "Database reset complete" });

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Pipeline endpoint failed:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * 03 — LEAD SOURCING PIPELINE
 * Simulates ZoomInfo/Google Places scraper discovery fueled by Gemini AI
 */
async function handleSourcing(niche: string, city: string) {
  const finalNiche = niche || 'HVAC';
  const finalCity = city || 'Dallas';

  const ai = getGeminiClient();
  const prompt = `You are a high-performing lead sourcing assistant. Find 3 highly realistic, net-new B2B businesses in the niche of "${finalNiche}" in "${finalCity}".
Return a JSON array of objects with these exact keys:
- "name": string (real-sounding business name, not generic)
- "phone": string (realistic local phone number with area code)
- "website": string (a realistic hypothetical domain, e.g., "radiantskindallas.com")
- "email": string (a plausible contact email)
- "company_size": string ("2-5", "5-10", "10-25", or "50+")
- "rating": number (between 3.2 and 4.9)
- "review_count": number (between 5 and 180)
- "category": string (Must match exactly one of: HVAC, Roofing, Cabinetry, Landscaping, MedSpa, Professional, Restaurant, Contractor)

Ensure one of the businesses has website as "" (empty string) to represent "no website".
Make sure other domains look authentic. Do not return markdown blocks, return ONLY valid parsable JSON array.`;

  let sourcedLeads: any[] = [];
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    sourcedLeads = JSON.parse(response.text?.trim() || "[]");
  } catch (err) {
    console.warn("Failed to query Gemini for sourcing, using local static generator.", err);
    // Dynamic fallback matching prompt request
    sourcedLeads = [
      {
        name: `Dallas ${finalNiche} Pros`,
        phone: '(214) 555-4011',
        website: `dallas${finalNiche.toLowerCase()}pros.com`,
        email: `office@dallas${finalNiche.toLowerCase()}pros.com`,
        company_size: '5-10',
        rating: 4.1,
        review_count: 24,
        category: finalNiche as any
      },
      {
        name: `Elite ${finalNiche} of ${finalCity}`,
        phone: '(214) 555-8910',
        website: '', // No website demo
        email: `elite${finalNiche.toLowerCase()}info@gmail.com`,
        company_size: '2-5',
        rating: 4.6,
        review_count: 32,
        category: finalNiche as any
      }
    ];
  }

  // Insert leads into database with deduplication (by website or phone)
  const db = await getDb();
  const addedLeads: Business[] = [];
  const logs: AgentLog[] = [];

  for (const lead of sourcedLeads) {
    const isDup = db.businesses.some(b => 
      (lead.website && b.website && b.website.toLowerCase() === lead.website.toLowerCase()) || 
      (b.phone === lead.phone) || 
      (b.name.toLowerCase() === lead.name.toLowerCase())
    );

    if (!isDup) {
      const newId = `biz_${Math.random().toString(36).substring(2, 9)}`;
      const business: Business = {
        id: newId,
        name: lead.name,
        category: lead.category || 'Contractor',
        city: finalCity,
        phone: lead.phone,
        website: lead.website || '',
        email: lead.email || '',
        linkedin: lead.website ? `linkedin.com/company/${lead.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : '',
        has_email: !!lead.email,
        has_phone: !!lead.phone,
        has_website: !!lead.website,
        has_linkedin: !!lead.website,
        is_eligible: !!lead.email && !!lead.phone,
        source: 'Places Scraper',
        company_size: lead.company_size || '5-10',
        rating: lead.rating || 4.3,
        review_count: lead.review_count || 12,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.businesses.push(business);
      addedLeads.push(business);

      // Create initial DISCOVERED Stage opportunity in mirrored GHL
      const opp: CRMOpportunity = {
        id: `opp_${Math.random().toString(36).substring(2, 9)}`,
        business_id: newId,
        pipeline_stage: 'DISCOVERED',
        ghl_opportunity_id: `ghl_opp_${Math.random().toString(36).substring(2, 9)}`,
        lead_engagement_score: 10,
        notes: `Lead discovered via Places search scraper for ${finalNiche} in ${finalCity}.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.crm_opportunities.push(opp);

      logs.push({
        id: `log_${Math.random().toString(36).substring(2, 9)}`,
        agent_name: 'Sales',
        action_taken: 'Lead Sourced',
        status: 'success',
        message: `Discovered and normalized lead: "${business.name}" (${business.category}) in ${business.city}. Syncing to GHL as DISCOVERED.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  db.agent_logs.push(...logs);
  await writeDb(db);

  return NextResponse.json({
    success: true,
    added_count: addedLeads.length,
    leads: addedLeads
  });
}

/**
 * 04 & 05 — DIGITAL MATURITY SCORING & WEBSITE AUDIT AGENT
 * Runs a rigorous scoring calculations (12 metrics) and creates deep AI insights
 */
async function handleAuditAndScoring(businessId: string) {
  const db = await getDb();
  const business = db.businesses.find(b => b.id === businessId);

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const ai = getGeminiClient();

  // Task 04 Metric evaluation. If website is blank, score is automatically low
  let existsScore = business.has_website ? 15 : 0;
  
  // Scoring Prompt to evaluate the realistic status based on reviews and industry
  const prompt = `You are a meticulous Digital Audit Specialist. Analyze this local business and output a comprehensive website audit & maturity scoring report.
Business details:
- Name: "${business.name}"
- Industry: "${business.category}"
- Reviews: ${business.review_count} reviews, ${business.rating}/5 rating
- Website status: ${business.has_website ? `exists at "${business.website}"` : 'NO WEBSITE'}

If website exists, generate realistic audit values.
If NO website exists, score all website components as 0.

Generate a JSON object matching this schema exactly:
{
  "mobile_friendly": number (0 to 10),
  "page_speed": number (0 to 10),
  "clear_cta": number (0 to 10),
  "booking_form": number (0 to 10),
  "reviews_displayed": number (0 to 10),
  "service_pages": number (0 to 10),
  "tracking_pixel": number (0 to 5),
  "crm_indicators": number (0 to 5),
  "capture_elements": number (0 to 5),
  "modern_design": number (0 to 5),
  "analytics_detected": number (0 to 5),
  "reasoning": "Detailed, professional paragraph detailing why they scored what they did.",
  "executive_summary": "1-2 sentences outlining their digital baseline and the bleeding gap.",
  "design_quality": number (1 to 10),
  "conversion_assessment": "1-2 sentences highlighting where clients fall off because of friction.",
  "strongest_asset": "Identify what is the one good thing (e.g. outstanding reviews, solid services listing, local trust).",
  "recommended_offer_tier": "Exact name of recommended offer (e.g., 'Core Website Redesign', 'Booking Engine Setup', 'Starter Site Deployment')",
  "revenue_opportunities": [
    { "description": "Specific growth implementation item", "potential_dollars": number },
    { "description": "Another specific growth implementation item", "potential_dollars": number },
    { "description": "A third growth implementation item", "potential_dollars": number }
  ]
}

Ensure the values are integer numbers within the bounds. Make sure the output is pure JSON.`;

  let result: any = {};
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    result = JSON.parse(response.text?.trim() || "{}");
  } catch (err) {
    console.warn("Gemini audit generation failed, using mock rules.", err);
    // Mock robust audit
    result = {
      mobile_friendly: business.has_website ? 6 : 0,
      page_speed: business.has_website ? 5 : 0,
      clear_cta: business.has_website ? 4 : 0,
      booking_form: business.has_website ? 0 : 0,
      reviews_displayed: business.has_website ? 5 : 0,
      service_pages: business.has_website ? 8 : 0,
      tracking_pixel: 0,
      crm_indicators: 0,
      capture_elements: 0,
      modern_design: business.has_website ? 2 : 0,
      analytics_detected: 0,
      reasoning: business.has_website 
        ? "The existing website is functional but extremely outdated, failing to display reviews dynamically and containing no CRM analytics or pixel triggers."
        : "No website exists. The business is completely invisible online outside of directories, missing major organic search volume.",
      executive_summary: business.has_website
        ? `Website is an outdated digital brochure failing to leverage their ${business.review_count} outstanding Google reviews.`
        : "Completely invisible web presence, losing high-intent local clients to competitors.",
      design_quality: business.has_website ? 4 : 1,
      conversion_assessment: "Friction is incredibly high, requiring manual phone calls with no online scheduling availability.",
      strongest_asset: `${business.review_count} stellar Google reviews with a rating of ${business.rating}.`,
      recommended_offer_tier: business.has_website ? 'Conversion Rebuild Suite' : 'Starter Website Package',
      revenue_opportunities: [
        { description: "Displaying customer testimonials prominently on the landing page", potential_dollars: 12000 },
        { description: "Deploying an instant SMS booking calendar connected to GHL", potential_dollars: 28000 },
        { description: "Enabling automated missed-call text back", potential_dollars: 15000 }
      ]
    };
  }

  // Calculate final maturity score out of 100
  const subTotal = 
    (result.mobile_friendly || 0) + 
    (result.page_speed || 0) + 
    (result.clear_cta || 0) + 
    (result.booking_form || 0) + 
    (result.reviews_displayed || 0) + 
    (result.service_pages || 0) + 
    (result.tracking_pixel || 0) + 
    (result.crm_indicators || 0) + 
    (result.capture_elements || 0) + 
    (result.modern_design || 0) + 
    (result.analytics_detected || 0);

  const finalScore = existsScore + subTotal;

  // Classify scoring group
  let classification: BusinessScore['classification'] = 'Invisible';
  if (finalScore >= 81) classification = 'Advanced';
  else if (finalScore >= 61) classification = 'Strong';
  else if (finalScore >= 41) classification = 'Average';
  else if (finalScore >= 21) classification = 'Weak';

  // 06 — OPPORTUNITY CLASSIFIER ROUTING
  let outreachAngle: WebsiteAudit['outreach_angle'] = 'BAD_WEBSITE';
  if (!business.has_website) {
    outreachAngle = 'NO_WEBSITE';
  } else if (business.review_count >= 50 && finalScore < 60) {
    outreachAngle = 'HIGH_REVIEW_LOW_CONVERSION';
  } else if (finalScore >= 60) {
    outreachAngle = 'GOOD_WEBSITE_NO_CRM';
  }

  // Write new business score record
  const scoreRecord: BusinessScore = {
    id: `score_${Math.random().toString(36).substring(2, 9)}`,
    business_id: business.id,
    score: finalScore,
    website_exists: existsScore,
    mobile_friendly: result.mobile_friendly || 0,
    page_speed: result.page_speed || 0,
    clear_cta: result.clear_cta || 0,
    booking_form: result.booking_form || 0,
    reviews_displayed: result.reviews_displayed || 0,
    service_pages: result.service_pages || 0,
    tracking_pixel: result.tracking_pixel || 0,
    crm_indicators: result.crm_indicators || 0,
    capture_elements: result.capture_elements || 0,
    modern_design: result.modern_design || 0,
    analytics_detected: result.analytics_detected || 0,
    classification,
    reasoning: result.reasoning || "Audit details recorded.",
    created_at: new Date().toISOString()
  };

  // Write website audit record
  const auditRecord: WebsiteAudit = {
    id: `audit_${Math.random().toString(36).substring(2, 9)}`,
    business_id: business.id,
    executive_summary: result.executive_summary,
    design_quality: result.design_quality || 3,
    conversion_assessment: result.conversion_assessment,
    strongest_asset: result.strongest_asset,
    revenue_opportunities: result.revenue_opportunities || [],
    infrastructure_gaps: result.infrastructure_gaps || ['Online Booking', 'Review Syndication', 'GoHighLevel Integration'],
    recommended_offer_tier: result.recommended_offer_tier || 'Conversion Rebuild Engine',
    outreach_angle: outreachAngle,
    created_at: new Date().toISOString()
  };

  // Update GHL Pipeline Stage to SCORED & update engagement metrics
  const opp = db.crm_opportunities.find(o => o.business_id === business.id);
  if (opp) {
    opp.pipeline_stage = 'SCORED';
    opp.lead_engagement_score = 30; // updated engagement
    opp.notes = `Digital Maturity audit completed with score: ${finalScore}/100. Opportunity classified as: ${outreachAngle}.`;
    opp.updated_at = new Date().toISOString();
  }

  // Add records & log to DB
  db.business_scores = db.business_scores.filter(s => s.business_id !== business.id);
  db.business_scores.push(scoreRecord);

  db.website_audits = db.website_audits.filter(a => a.business_id !== business.id);
  db.website_audits.push(auditRecord);

  db.agent_logs.push({
    id: `log_${Math.random().toString(36).substring(2, 9)}`,
    agent_name: 'CEO',
    action_taken: 'Audit & Scoring',
    status: 'success',
    message: `Completed AI website audit on "${business.name}". Score: ${finalScore}/100 (${classification}). Recommended Angle: ${outreachAngle}.`,
    timestamp: new Date().toISOString()
  });

  await writeDb(db);

  return NextResponse.json({
    success: true,
    score: scoreRecord,
    audit: auditRecord
  });
}

/**
 * 07 & 08 — WEBSITE PREVIEW GENERATOR
 * Generates custom structured web templates and uses AI to write personalized copy
 */
async function handlePreviewGeneration(businessId: string) {
  const db = await getDb();
  const business = db.businesses.find(b => b.id === businessId);
  const audit = db.website_audits.find(a => a.business_id === businessId);

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const ai = getGeminiClient();
  const colors = COLOR_SCHEMES[business.category] || { primary: '#4f46e5', secondary: '#f5f3ff' };

  const prompt = `You are an elite UX copywriter. Write highly persuasive, personalized homepage copy for a new website mock preview we are building for "${business.name}".
Industry: ${business.category}
Location: ${business.city}
Reviews volume: ${business.review_count} reviews with ${business.rating} stars
Recommended solution: ${audit?.recommended_offer_tier || "Conversion-ready responsive site"}

Return a JSON object containing the exact copy elements:
{
  "headline": "A punchy, benefit-first display heading for the hero section",
  "subheading": "A descriptive subtitle detailing premium work, local guarantee, or convenience",
  "about_paragraph": "A highly compelling 3-sentence description of who they are and why clients choose them.",
  "services": [
    "Specific high-margin service 1 with benefit description",
    "Specific high-margin service 2 with benefit description",
    "Specific high-margin service 3 with benefit description"
  ],
  "review_highlights": [
    "Slightly paraphrased highly positive review snippet 1",
    "Slightly paraphrased highly positive review snippet 2"
  ]
}

Ensure the output is strictly valid JSON format.`;

  let copyResult: any = {};
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    copyResult = JSON.parse(response.text?.trim() || "{}");
  } catch (err) {
    console.warn("AI preview copywriter failed, fallback copy deployed.", err);
    copyResult = {
      headline: `The Premier ${business.category} Specialists in ${business.city}`,
      subheading: `Voted ${business.rating}/5 stars. Experience rapid schedules, upfront rates, and guaranteed craftsmanship on every job.`,
      about_paragraph: `At ${business.name}, we supply the top ${business.category} solutions in ${business.city}. Backed by ${business.review_count}+ five-star reviews, our skilled technicians deliver high-quality, professional workmanship on time, every time.`,
      services: [
        "Premium Residential Installations & System Refurbishing",
        "Comprehensive Diagnostics, Cleaning, and Performance Tuning",
        "24/7 Emergency Support & Guaranteed Rapid Dispatch"
      ],
      review_highlights: [
        "Highly prompt, clean service, and competitive rates! Highly recommend.",
        "The team was extremely friendly and completed our install ahead of schedule."
      ]
    };
  }

  // Create hosted slug
  const slug = `${business.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-preview`;

  const previewRecord: WebsitePreview = {
    id: `preview_${Math.random().toString(36).substring(2, 9)}`,
    business_id: business.id,
    slug,
    template_id: business.category.toLowerCase(),
    primary_color: colors.primary,
    secondary_color: colors.secondary,
    headline: copyResult.headline,
    services: copyResult.services || [],
    about_text: copyResult.about_paragraph,
    review_highlights: copyResult.review_highlights || [],
    visits: 0,
    clicks: 0,
    claimed: false,
    created_at: new Date().toISOString()
  };

  // Update GHL stage to PREVIEW_GENERATED
  const opp = db.crm_opportunities.find(o => o.business_id === business.id);
  if (opp) {
    opp.pipeline_stage = 'PREVIEW_GENERATED';
    opp.lead_engagement_score = 45;
    opp.notes = `Custom website preview generated at slug /preview/${slug}.`;
    opp.updated_at = new Date().toISOString();
  }

  db.website_previews = db.website_previews.filter(p => p.business_id !== business.id);
  db.website_previews.push(previewRecord);

  db.agent_logs.push({
    id: `log_${Math.random().toString(36).substring(2, 9)}`,
    agent_name: 'Sales',
    action_taken: 'Preview Concept Generated',
    status: 'success',
    message: `Generated personalized HTML preview for "${business.name}" using the ${business.category} layout template. Ready to pitch.`,
    timestamp: new Date().toISOString()
  });

  await writeDb(db);

  return NextResponse.json({
    success: true,
    preview: previewRecord
  });
}

/**
 * 12 — OUTBOUND EMAIL COPYWRITER AGENT
 * Generates highly targeted 4-step outreach sequences with no spam-triggers and high personalization
 */
async function handleCopywriting(businessId: string) {
  const db = await getDb();
  const business = db.businesses.find(b => b.id === businessId);
  const score = db.business_scores.find(s => s.business_id === businessId);
  const audit = db.website_audits.find(a => a.business_id === businessId);
  const preview = db.website_previews.find(p => p.business_id === businessId);

  if (!business || !audit || !preview) {
    return NextResponse.json({ error: "Required lead metrics, score, or preview missing." }, { status: 400 });
  }

  const ai = getGeminiClient();
  const previewUrl = `/preview/${preview.slug}`;

  const prompt = `You are an elite B2B sales copywriter specializing in highly personal, low-pressure, high-conversion email outreach.
Write a 4-email sequence for "${business.name}" in ${business.city} (${business.category}).
Key Details:
- Their digital score: ${score?.score}/100. Classification: ${score?.classification}.
- Digital gaps found: ${audit.infrastructure_gaps.join(', ')}.
- Best asset: ${audit.strongest_asset}.
- Customized preview URL: "${previewUrl}"

Guideline Constraints:
- Short & crisp. Email 1 must be 3-4 sentences max.
- Bulletproof spam safety (no hype words, no 'supercharge', 'guaranteed cash', 'risk free').
- Direct, helpful, consultative tone.
- Must include the trackable token "{{preview_url}}" exactly as a link placeholder.

Return a JSON object containing the exact copy for all 4 emails:
{
  "step1": { "subject": "Subject for email 1", "body": "Short 3-4 sentence message with {{preview_url}}" },
  "step2": { "subject": "Subject for email 2", "body": "Consultative followup, value framing" },
  "step3": { "subject": "Subject for email 3", "body": "Audit detail insight, emphasizing gaps" },
  "step4": { "subject": "Subject for email 4", "body": "Breakup pattern interrupt asking if we should dismantle preview" }
}

Ensure the output is strictly valid JSON format.`;

  let emails: any = {};
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    emails = JSON.parse(response.text?.trim() || "{}");
  } catch (err) {
    console.warn("AI Copywriter failed, loading premium backup sequence", err);
    emails = {
      step1: {
        subject: `${business.city} HVAC - I built a mobile preview concept for ${business.name}`,
        body: `Hi ${business.name} Team,\n\nI was looking at local ${business.category} businesses in ${business.city} and noticed your site loads slowly on mobile devices and lacks interactive booking options.\n\nSince 80% of local seekers browse on their phones, I went ahead and drafted a mobile-responsive concept preview showing how online booking and review highlights above the fold could work for you:\n\n{{preview_url}}\n\nLet me know if you would like me to adjust any of your services or colors!\n\nBest,\nAutonomous Pipeline`
      },
      step2: {
        subject: `Quick followup about the ${business.name} mobile concept`,
        body: `Hi Team,\n\nJust checking if you had a moment to inspect the mobile booking concept I sent over: {{preview_url}}\n\nDid you know that adding online booking and review highlights above the fold typically increases service bookings by 25-40%? Most local competitors in your area are already shifting to online scheduling.\n\nAre you open to a short chat to see how this links to GoHighLevel?\n\nBest,\nAutonomous Pipeline`
      },
      step3: {
        subject: `1 small audit detail on your current domain`,
        body: `Hi Team,\n\nI wanted to share one specific detail from the audit we ran on your current domain: you are missing a tracking pixel and CRM capturing. This means you are missing out on retargeting clients who visit your site but don\'t call.\n\nWe added those automated components directly to your custom concept: {{preview_url}}\n\nShould we schedule 10 minutes to review this together?\n\nBest,\nAutonomous Pipeline`
      },
      step4: {
        subject: `Should we take the ${business.name} concept down?`,
        body: `Hi Team,\n\nI haven\'t heard back, so I assume you are fully booked or not interested in upgrading your web infrastructure at this time.\n\nShould I take the custom ${business.name} website preview down ({{preview_url}}), or would you like to keep it up for a bit longer to show the team?\n\nLet me know if we should hop on a call to hand it over to you.\n\nBest,\nAutonomous Pipeline`
      }
    };
  }

  // Create sequence record
  const seqRecord: EmailSequence = {
    id: `seq_${Math.random().toString(36).substring(2, 9)}`,
    business_id: business.id,
    campaign_id: 'camp_outbound_1',
    current_step: 1,
    status: 'active',
    primary_email: business.email || 'office@localbusiness.com',
    validation_status: business.email ? 'valid' : 'syntax_only',
    fallback_emails: [],
    emails_generated: emails,
    last_sent_at: new Date().toISOString(), // Simulating step 1 send immediately
    next_send_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), // Step 2 due in 3 days
    created_at: new Date().toISOString()
  };

  // Sync stage to EMAIL_SENT in GHL
  const opp = db.crm_opportunities.find(o => o.business_id === business.id);
  if (opp) {
    opp.pipeline_stage = 'EMAIL_SENT';
    opp.lead_engagement_score = 50;
    opp.notes = `Outbound campaign initiated. Email Step 1 (Preview Pitch) dispatched.`;
    opp.updated_at = new Date().toISOString();
  }

  db.email_sequences = db.email_sequences.filter(s => s.business_id !== business.id);
  db.email_sequences.push(seqRecord);

  // Track the event
  db.email_events.push({
    id: `evt_${Math.random().toString(36).substring(2, 9)}`,
    sequence_id: seqRecord.id,
    business_id: business.id,
    event_type: 'open', // Mock instant initial delivery open
    timestamp: new Date().toISOString(),
    user_agent: 'Gmail Client / Chrome'
  });

  db.agent_logs.push({
    id: `log_${Math.random().toString(36).substring(2, 9)}`,
    agent_name: 'Sales',
    action_taken: 'Campaign Outbound Active',
    status: 'success',
    message: `Generated and dispatched 4-email outbound sequence to "${business.name}" (${business.email}). Tracking enabled.`,
    timestamp: new Date().toISOString()
  });

  await writeDb(db);

  return NextResponse.json({
    success: true,
    sequence: seqRecord
  });
}

/**
 * 24 — CEO AGENT MULTI-AGENT ORCHESTRATION ENGINE
 * Monitors lead queues, processes background follow-ups, updates engagement tracking scores,
 * triggers automated bookings, and generates a rich daily executive briefing logs.
 */
async function handleCEORun() {
  const db = await getDb();
  const logs: AgentLog[] = [];
  const timestamp = new Date().toISOString();

  let activeEmails = 0;
  let wonDeals = 0;
  let callsBooked = 0;

  // 1. SCAN AND UPDATE ACTIVE EMAIL SEQUENCES
  for (const seq of db.email_sequences) {
    if (seq.status === 'active') {
      activeEmails++;
      
      // Let's simulate a periodic sequence checker
      const lastSent = seq.last_sent_at ? new Date(seq.last_sent_at).getTime() : 0;
      const hoursSinceLast = (Date.now() - lastSent) / (3600 * 1000);

      // If it has been more than 48 hours, and they haven't replied or unsubscribed, advance the sequence step!
      if (hoursSinceLast >= 48 && seq.current_step < 4) {
        seq.current_step += 1;
        seq.last_sent_at = timestamp;
        seq.next_send_at = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

        // Write sending action log
        logs.push({
          id: `log_seq_${Math.random().toString(36).substring(2, 9)}`,
          agent_name: 'Ops',
          action_taken: 'Sequence Step Advanced',
          status: 'info',
          message: `Advanced outbound sequence for business ID ${seq.business_id} to Step ${seq.current_step}. Email dispatched.`,
          timestamp
        });
      }
    }
  }

  // 2. SCAN CRM OPPORTUNITIES FOR HEALTH SCORING & PIPELINE WIN ALERTS
  for (const opp of db.crm_opportunities) {
    if (opp.pipeline_stage === 'WON') wonDeals++;
    if (opp.pipeline_stage === 'CALL_BOOKED') callsBooked++;

    // Re-verify engagement metrics and flag high scores to trigger immediate success logs
    if (opp.lead_engagement_score >= 70) {
      logs.push({
        id: `log_alert_${Math.random().toString(36).substring(2, 9)}`,
        agent_name: 'Success',
        action_taken: 'High Intent Lead Alert',
        status: 'warning',
        message: `Lead ID ${opp.business_id} has breached engagement score of ${opp.lead_engagement_score}! Highly recommended to execute manual phone follow-up.`,
        timestamp
      });
    }
  }

  // 3. GENERATE CEO DAILY BRIEFING
  const ai = getGeminiClient();
  const briefPrompt = `You are a visionary AI CEO directing an autonomous agency.
Write an executive daily briefing report based on this current pipeline snapshot:
- Active leads in outreach: ${activeEmails}
- Meetings booked: ${callsBooked}
- Total Closed Won: ${wonDeals}
- Current total leads cataloged: ${db.businesses.length}

Format as a highly professional, scannable Markdown report with section headers:
1. Executive Summary (visionary tone, high level)
2. Daily Pipeline Accomplishments (sourcing, auditing, copy dispatches)
3. Operational Bottlenecks & Human Action Items (things that need direct action)

Keep it crisp, objective, and clean. Do not include unparsable markup outside of raw markdown text.`;

  let briefingMarkdown = "";
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: briefPrompt
    });
    briefingMarkdown = response.text || "Daily scan complete.";
  } catch (err) {
    briefingMarkdown = `### EXECUTIVE DAILY BRIEFING
*Autonomous Growth Engine Active*

**1. Executive Summary**
The pipeline is operating optimally. Outreach systems are fully warmed up and targeting highest-value prospects with active website concepts.

**2. Daily Accomplishments**
- Evaluated and scored ${db.business_scores.length} business domains.
- Dispatched mobile preview pitches to active campaign targets.
- Mirror state synchronized with GoHighLevel CRM endpoints.

**3. Action Items**
- Review booked calls for custom briefs.
- Approve proposals for outstanding clients.`;
  }

  // Save the CEO brief as a specific log entry
  const briefId = `log_ceo_brief_${Date.now()}`;
  db.agent_logs.push({
    id: briefId,
    agent_name: 'CEO',
    action_taken: 'Executive Daily Briefing',
    status: 'success',
    message: briefingMarkdown,
    timestamp
  });

  db.agent_logs.push(...logs);
  await writeDb(db);

  return NextResponse.json({
    success: true,
    briefing: briefingMarkdown,
    logs_added: logs.length
  });
}
