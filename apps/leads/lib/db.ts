import fs from 'fs/promises';
import path from 'path';

// Define the absolute path for our local JSON database file
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Helper to ensure directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Already exists or can't write (ignore if exists)
  }
}

export interface Business {
  id: string;
  name: string;
  category: 'Contractor' | 'HVAC' | 'Roofing' | 'Cabinetry' | 'Landscaping' | 'MedSpa' | 'Professional' | 'Restaurant';
  city: string;
  phone: string;
  website: string;
  email: string;
  linkedin: string;
  has_email: boolean;
  has_phone: boolean;
  has_website: boolean;
  has_linkedin: boolean;
  is_eligible: boolean;
  source: 'ZoomInfo' | 'Places Scraper';
  company_size: string;
  rating: number;
  review_count: number;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessScore {
  id: string;
  business_id: string;
  score: number;
  website_exists: number; // Max 15
  mobile_friendly: number; // Max 10
  page_speed: number; // Max 10
  clear_cta: number; // Max 10
  booking_form: number; // Max 10
  reviews_displayed: number; // Max 10
  service_pages: number; // Max 10
  tracking_pixel: number; // Max 5
  crm_indicators: number; // Max 5
  capture_elements: number; // Max 5
  modern_design: number; // Max 5
  analytics_detected: number; // Max 5
  classification: 'Invisible' | 'Weak' | 'Average' | 'Strong' | 'Advanced';
  reasoning: string;
  created_at: string;
}

export interface WebsiteAudit {
  id: string;
  business_id: string;
  executive_summary: string;
  design_quality: number; // 1-10
  conversion_assessment: string;
  strongest_asset: string;
  revenue_opportunities: Array<{ description: string; potential_dollars: number }>;
  infrastructure_gaps: string[];
  recommended_offer_tier: string;
  outreach_angle: 'NO_WEBSITE' | 'BAD_WEBSITE' | 'GOOD_WEBSITE_NO_CRM' | 'HIGH_REVIEW_LOW_CONVERSION' | 'HIGH_VALUE_TARGET';
  created_at: string;
}

export interface WebsitePreview {
  id: string;
  business_id: string;
  slug: string;
  template_id: string;
  primary_color: string;
  secondary_color: string;
  headline: string;
  services: string[];
  about_text: string;
  review_highlights: string[];
  visits: number;
  clicks: number;
  claimed: boolean;
  claimed_at?: string;
  created_at: string;
}

export interface EmailSequence {
  id: string;
  business_id: string;
  campaign_id: string;
  current_step: number; // 1 to 4, 5 for Completed
  status: 'pending' | 'active' | 'opened' | 'clicked' | 'replied' | 'unsubscribed' | 'completed' | 'paused';
  primary_email: string;
  validation_status: 'valid' | 'syntax_only' | 'role_account' | 'invalid';
  fallback_emails: string[];
  last_sent_at?: string;
  next_send_at?: string;
  emails_generated?: {
    step1: { subject: string; body: string };
    step2: { subject: string; body: string };
    step3: { subject: string; body: string };
    step4: { subject: string; body: string };
  };
  created_at: string;
}

export interface EmailEvent {
  id: string;
  sequence_id: string;
  business_id: string;
  event_type: 'open' | 'click' | 'reply' | 'visit_preview' | 'cta_click' | 'unsubscribe';
  timestamp: string;
  link_clicked?: string;
  user_agent?: string;
}

export interface Suppression {
  id: string;
  email: string;
  reason: 'bounce' | 'unsubscribe' | 'complaint';
  timestamp: string;
}

export interface CRMOpportunity {
  id: string;
  business_id: string;
  pipeline_stage: 'DISCOVERED' | 'SCORED' | 'PREVIEW_GENERATED' | 'EMAIL_SENT' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'CALL_BOOKED' | 'PROPOSAL_SENT' | 'WON' | 'LOST' | 'CLIENT' | 'RETAINER';
  ghl_opportunity_id: string;
  lead_engagement_score: number; // 0-100
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  business_id: string;
  opportunity_id: string;
  cover_title: string;
  executive_summary: string;
  gap_analysis: string;
  proposed_solution: string;
  pricing_tiers: {
    good: { title: string; price: string; description: string; roi_framing: string };
    better: { title: string; price: string; description: string; roi_framing: string };
    best: { title: string; price: string; description: string; roi_framing: string };
  };
  timeline: string[];
  terms: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  signature_name?: string;
  signed_at?: string;
  created_at: string;
}

export interface FulfillmentProject {
  id: string;
  business_id: string;
  package_type: string;
  status: 'active' | 'completed' | 'delayed';
  progress: number; // percentage
  created_at: string;
  updated_at: string;
}

export interface FulfillmentTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at?: string;
  due_date: string;
}

export interface AgentLog {
  id: string;
  agent_name: 'CEO' | 'Sales' | 'Ops' | 'Fulfillment' | 'Success';
  action_taken: string;
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface AppDatabase {
  businesses: Business[];
  business_scores: BusinessScore[];
  website_audits: WebsiteAudit[];
  website_previews: WebsitePreview[];
  email_sequences: EmailSequence[];
  email_events: EmailEvent[];
  suppression_list: Suppression[];
  crm_opportunities: CRMOpportunity[];
  proposals: Proposal[];
  fulfillment_projects: FulfillmentProject[];
  fulfillment_tasks: FulfillmentTask[];
  agent_logs: AgentLog[];
}

// Initial DB template with high-fidelity seed data
const SEED_DATA: AppDatabase = {
  businesses: [
    {
      id: 'biz_01',
      name: 'Apex Heating & Air',
      category: 'HVAC',
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
      source: 'ZoomInfo',
      company_size: '10-25',
      rating: 4.2,
      review_count: 38,
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'biz_02',
      name: 'Greenfield Landscaping Solutions',
      category: 'Landscaping',
      city: 'Boston',
      phone: '(617) 555-0199',
      website: '', // No website
      email: 'greenfieldboston@gmail.com',
      linkedin: '',
      has_email: true,
      has_phone: true,
      has_website: false,
      has_linkedin: false,
      is_eligible: true,
      source: 'Places Scraper',
      company_size: '2-5',
      rating: 4.8,
      review_count: 54,
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'biz_03',
      name: 'Radiant Skin & Body MedSpa',
      category: 'MedSpa',
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
      source: 'ZoomInfo',
      company_size: '5-10',
      rating: 3.8,
      review_count: 142, // High reviews, potentially low conversion if site is bad
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'biz_04',
      name: 'Mile High Roofing Experts',
      category: 'Roofing',
      city: 'Denver',
      phone: '(303) 555-0177',
      website: 'milehighroofingexperts.com',
      email: 'roofingexperts303@gmail.com',
      linkedin: '',
      has_email: true,
      has_phone: true,
      has_website: true,
      has_linkedin: false,
      is_eligible: true,
      source: 'Places Scraper',
      company_size: '10-25',
      rating: 4.7,
      review_count: 12,
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'biz_05',
      name: 'Plumbing & Drain Master',
      category: 'HVAC',
      city: 'Chicago',
      phone: '(312) 555-0123',
      website: 'chicagodrainmaster.com',
      email: 'drainmasterchicago@gmail.com',
      linkedin: '',
      has_email: true,
      has_phone: true,
      has_website: true,
      has_linkedin: false,
      is_eligible: true,
      source: 'Places Scraper',
      company_size: '5-10',
      rating: 4.9,
      review_count: 85,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  business_scores: [
    {
      id: 'score_01',
      business_id: 'biz_01',
      score: 35, // Weak
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
      classification: 'Weak',
      reasoning: 'Website exists, but it loads very slowly on mobile devices and lacks a clear call-to-action above the fold. There is no automated contact or booking form, forcing customers to call. No CRM tracking pixel or analytics platforms are detected, missing massive retargeting opportunities.',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'score_02',
      business_id: 'biz_03',
      score: 55, // Average
      website_exists: 15,
      mobile_friendly: 10,
      page_speed: 10,
      clear_cta: 5,
      booking_form: 5,
      reviews_displayed: 0,
      service_pages: 10,
      tracking_pixel: 0,
      crm_indicators: 0,
      capture_elements: 0,
      modern_design: 0,
      analytics_detected: 0,
      classification: 'Average',
      reasoning: 'The website is responsive and fast, with service pages mapped. However, there are no review badges displayed, missing out on leveraging their outstanding 142 Google reviews. It lacks booking automation, and there is no tracking code for ads or CRM capturing, leading to major lead leaks.',
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
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
        { description: 'Add Google review sync to automatically showcase their positive customer feedback above the fold.', potential_dollars: 12000 },
        { description: 'Deploy a missed-call text-back automated campaign via GoHighLevel to salvage unanswered phone leads.', potential_dollars: 24000 }
      ],
      infrastructure_gaps: ['Online Booking System', 'GoHighLevel Lead Capture Form', 'Google Analytics', 'Facebook Tracking Pixel', 'Missed-Call Text-Back Automation'],
      recommended_offer_tier: 'Rebuild Package + Lead Infrastructure',
      outreach_angle: 'BAD_WEBSITE',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'audit_02',
      business_id: 'biz_03',
      executive_summary: 'Radiant Skin & Body possesses 142 glowing reviews on Google, but their website is a generic static brochure that completely fails to convert high-intent traffic into appointments.',
      design_quality: 6,
      conversion_assessment: 'Visitors are forced to navigate to a manual contact page, copy the email address or phone number, and wait for a response. The lack of interactive booking is driving away 40%+ of mobile seekers.',
      strongest_asset: 'Extremely high volume of five-star customer feedback which represents huge untapped social proof.',
      revenue_opportunities: [
        { description: 'Integrate dynamic booking calendars on each individual aesthetic service page.', potential_dollars: 35000 },
        { description: 'Display a floating interactive testimonial widget connected directly to Google Business Profile.', potential_dollars: 15000 },
        { description: 'Launch a nurture sequence for lapsed spa clients using integrated SMS reminders.', potential_dollars: 22000 }
      ],
      infrastructure_gaps: ['Dynamic Booking Calendar', 'GoHighLevel CRM Sync', 'Review Syndication Widget', 'Lead Capturing Pop-up'],
      recommended_offer_tier: 'Conversion Rebuild + Automation Retainer',
      outreach_angle: 'HIGH_REVIEW_LOW_CONVERSION',
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    }
  ],
  website_previews: [
    {
      id: 'preview_01',
      business_id: 'biz_01',
      slug: 'apex-heating-air-preview',
      template_id: 'hvac_plumbing',
      primary_color: '#0284c7', // Sky Blue
      secondary_color: '#f97316', // Orange
      headline: 'Denver’s Fast, Reliable Heating & Cooling Specialists',
      services: ['Residential AC Install & Repair', 'Furnace Maintenance & Service', 'Emergency HVAC Support 24/7', 'Indoor Air Quality Audits'],
      about_text: 'For years, Apex Heating & Air has kept Denver families comfortable in every season. We combine elite-level HVAC expertise with transparent, upfront pricing and prompt service.',
      review_highlights: ['Fast AC repair on a 95-degree day! Absolutely saved us.', 'Super professional technicians and great explanation of pricing.', 'Clean work and on-time. Will use Apex for all my furnace needs.'],
      visits: 8,
      clicks: 3,
      claimed: false,
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'preview_02',
      business_id: 'biz_03',
      slug: 'radiant-skin-body-preview',
      template_id: 'med_spa',
      primary_color: '#db2777', // Deep Pink
      secondary_color: '#fdf2f8', // Pale pinkbg
      headline: 'Reveal Your Natural Glow with Elite Aesthetic Care in Dallas',
      services: ['Advanced Botox & Dermal Fillers', 'Laser Skin Resurfacing', 'Medical-Grade Hydrafacials', 'Body Sculpting Treatments'],
      about_text: 'At Radiant Skin & Body, we deliver customized, medical-grade aesthetic treatments in a serene, luxurious spa setting. Our certified experts leverage state-of-the-art tech to bring you unmatched confidence.',
      review_highlights: ['The best Botox experience I’ve had in Dallas! So natural.', 'Wonderful staff and beautiful clean spa. Hydrafacial made my skin glow.', 'Highly recommend for any skin rejuvenation. Experienced clinicians.'],
      visits: 14,
      clicks: 6,
      claimed: true,
      claimed_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    }
  ],
  email_sequences: [
    {
      id: 'seq_01',
      business_id: 'biz_01',
      campaign_id: 'camp_01',
      current_step: 2,
      status: 'active',
      primary_email: 'contact@apexdenverhvac.com',
      validation_status: 'valid',
      fallback_emails: [],
      last_sent_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      next_send_at: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString(),
      emails_generated: {
        step1: {
          subject: 'Denver HVAC - I made a custom website concept for Apex Heating',
          body: 'Hi Apex Team,\n\nI was looking up HVAC services in Denver and noticed Apex Heating has great reviews, but your website takes quite long to load and doesn\'t have online booking. Since most local searches happen on mobile, this could be driving customers away.\n\nI actually went ahead and created a modern, mobile-responsive preview concept for Apex: {{preview_url}}\n\nIt features an automated instant-booking calendar and SMS followups. Let me know if you would like me to adjust any of the services or colors!\n\nBest,\nAutonomous Outreach'
        },
        step2: {
          subject: 'Quick question about the Apex Heating website preview',
          body: 'Hi Apex Team,\n\nFollowing up on my last email. If you haven\'t had a chance to look at the custom concept yet, you can see it here: {{preview_url}}\n\nDid you know that adding online booking and review highlights above the fold typically increases service bookings by 25-40%? Most of your local competitors in Denver are already shifting to online scheduling.\n\nWould you be open to a 5-minute call to talk about how this can link to a automated missed-call text-back system?\n\nBest,\nAutonomous Outreach'
        },
        step3: {
          subject: 'Denver HVAC: 1 small audit detail',
          body: 'Hi Apex Team,\n\nI wanted to share one specific detail from the audit we ran on your current domain: you are missing a tracking pixel and CRM capturing. This means you are missing out on retargeting clients who visit your site but don\'t call.\n\nWe added those automated components directly to your custom concept: {{preview_url}}\n\nShould we schedule 10 minutes to review this together?\n\nBest,\nAutonomous Outreach'
        },
        step4: {
          subject: 'Should we take the Apex Heating preview down?',
          body: 'Hi Apex Team,\n\nI haven\'t heard back, so I assume you are fully booked or not interested in upgrading your web infrastructure at this time.\n\nShould I take the custom Apex website preview down ({{preview_url}}), or would you like to keep it up for a bit longer to show the team?\n\nLet me know if we should hop on a call to hand it over to you.\n\nBest,\nAutonomous Outreach'
        }
      },
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    }
  ],
  email_events: [
    {
      id: 'event_01',
      sequence_id: 'seq_01',
      business_id: 'biz_01',
      event_type: 'open',
      timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'event_02',
      sequence_id: 'seq_01',
      business_id: 'biz_01',
      event_type: 'visit_preview',
      timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'event_03',
      sequence_id: 'seq_01',
      business_id: 'biz_01',
      event_type: 'click',
      timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      link_clicked: '{{preview_url}}'
    }
  ],
  suppression_list: [],
  crm_opportunities: [
    {
      id: 'opp_01',
      business_id: 'biz_01',
      pipeline_stage: 'EMAIL_SENT',
      ghl_opportunity_id: 'ghl_opp_101',
      lead_engagement_score: 55,
      notes: 'Lead opened first email and clicked the preview link to view the HVAC concept. High intent signal detected.',
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'opp_02',
      business_id: 'biz_03',
      pipeline_stage: 'CALL_BOOKED',
      ghl_opportunity_id: 'ghl_opp_103',
      lead_engagement_score: 95,
      notes: 'Customer claimed their website preview and booked an integration session through the preview booking CTA.',
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    }
  ],
  proposals: [
    {
      id: 'prop_01',
      business_id: 'biz_03',
      opportunity_id: 'opp_02',
      cover_title: 'Digital Conversion Infrastructure & Booking Platform Proposal',
      executive_summary: 'This proposal outlines the strategy to convert Radiant Skin & Body’s massive organic traffic and outstanding Google reputation into automated client bookings, capturing an estimated $50,000+ in leaked annual revenue.',
      gap_analysis: 'Radiant MedSpa currently possesses 142 stellar Google reviews, yet their static website completely fails to display these reviews dynamically. Furthermore, they lack direct booking calendars, forcing mobile clients to copy phone numbers and wait for manual responses.',
      proposed_solution: 'We will implement our full Premium Conversion MedSpa Website Template integrated with GoHighLevel Booking Calendars, Review Syndication, and custom SMS/email reminder flows.',
      pricing_tiers: {
        good: { title: 'Starter Booking Website', price: '$1,500 setup + $197/mo', description: 'Complete responsive spa site, review badge, and custom GoHighLevel calendar integration.', roi_framing: 'Pays for itself with just 2 additional spa clients per month.' },
        better: { title: 'Premium Conversion Engine', price: '$2,500 setup + $397/mo', description: 'Everything in Starter plus Missed-Call Text-Back, lead capture pop-ups, and automated review syndication.', roi_framing: 'Estimated ROI of 4-6x based on local MedSpa historical conversion metrics.' },
        best: { title: 'Complete Growth & CRM Suite', price: '$5,000 setup + $750/mo', description: 'Complete infrastructure overhaul including SMS text blasts, past client re-activation, and 1-on-1 ongoing optimization support.', roi_framing: 'Aims to capture 20%+ dormant leads; average revenue growth of $4,500/mo.' }
      },
      timeline: ['Day 1-3: Brand asset & styling review', 'Day 4-7: Component assembly and copy refinement', 'Day 8-10: GoHighLevel CRM integration & automated triggers', 'Day 11-12: Complete mobile QA & Launch'],
      terms: '50% upfront payment, 50% upon completion. Hosting and automation licenses billed monthly. Includes unlimited minor text revisions for the first 30 days.',
      status: 'sent',
      created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    }
  ],
  fulfillment_projects: [
    {
      id: 'proj_01',
      business_id: 'biz_03',
      package_type: 'Premium Conversion Engine',
      status: 'active',
      progress: 35,
      created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
    }
  ],
  fulfillment_tasks: [
    { id: 'task_01', project_id: 'proj_01', title: 'Confirm spa logo, photos, and brand guidelines', description: 'Collect assets from Radiant Spa team to refine preview styles.', is_completed: true, completed_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), due_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString() },
    { id: 'task_02', project_id: 'proj_01', title: 'Syndicate 142 reviews to the homepage widget', description: 'Wire Google Business Profile Place ID to dynamic review highlight.', is_completed: false, due_date: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString() },
    { id: 'task_03', project_id: 'proj_01', title: 'Configure GHL CRM custom pipeline and custom fields', description: 'Set up appointment reminder triggers and tags.', is_completed: false, due_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString() }
  ],
  agent_logs: [
    { id: 'log_01', agent_name: 'CEO', action_taken: 'Morning Pipeline Scan', status: 'success', message: 'Successfully scanned 5 leads. Apex Heating & Air is at step 2 of outbound sequence.', timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    { id: 'log_02', agent_name: 'Sales', action_taken: 'Lead Sourcing & Classification', status: 'info', message: 'Sourced Greenfield Landscaping Solutions from Google Places. Eligible for outreach.', timestamp: new Date(Date.now() - 11 * 3600 * 1000).toISOString() },
    { id: 'log_03', agent_name: 'Ops', action_taken: 'CRM Sync Alert', status: 'success', message: 'Mirrored Radiant Spa appointment booking into GoHighLevel stage CALL_BOOKED.', timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
  ]
};

// Singleton database instance
let cachedDb: AppDatabase | null = null;

// Read database
export async function getDb(): Promise<AppDatabase> {
  if (cachedDb) {
    return cachedDb;
  }

  await ensureDataDirectory();

  try {
    const fileContent = await fs.readFile(DB_FILE, 'utf-8');
    cachedDb = JSON.parse(fileContent);
    return cachedDb!;
  } catch (err) {
    // File doesn't exist, create it with seed data
    await writeDb(SEED_DATA);
    cachedDb = SEED_DATA;
    return cachedDb!;
  }
}

// Write database
export async function writeDb(db: AppDatabase): Promise<void> {
  await ensureDataDirectory();
  cachedDb = db;
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Update helper
export async function updateDb(updater: (db: AppDatabase) => void): Promise<AppDatabase> {
  const db = await getDb();
  updater(db);
  await writeDb(db);
  return db;
}

// Reset database (for demo resets)
export async function resetDb(): Promise<AppDatabase> {
  await writeDb(SEED_DATA);
  return SEED_DATA;
}
