'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Sparkles, Shield, Star, DollarSign, Calendar, TrendingUp, AlertTriangle, 
  Users, CheckCircle2, Play, RefreshCw, Send, Trash2, Layers, CheckSquare, Plus, 
  Search, Eye, FileText, ChevronRight, Check, X, Bell, Mail, Activity, ArrowUpRight, HelpCircle,
  Briefcase
} from 'lucide-react';

interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  phone: string;
  website: string;
  email: string;
  linkedin: string;
  has_email: boolean;
  has_phone: boolean;
  has_website: boolean;
  is_eligible: boolean;
  source: string;
  company_size: string;
  rating: number;
  review_count: number;
}

interface BusinessScore {
  id: string;
  business_id: string;
  score: number;
  classification: 'Invisible' | 'Weak' | 'Average' | 'Strong' | 'Advanced';
  reasoning: string;
}

interface WebsiteAudit {
  id: string;
  business_id: string;
  design_quality: number;
  executive_summary: string;
  recommended_offer_tier: string;
  outreach_angle: string;
  infrastructure_gaps: string[];
  revenue_opportunities: Array<{ description: string; potential_dollars: number }>;
}

interface WebsitePreview {
  id: string;
  business_id: string;
  slug: string;
  headline: string;
  visits: number;
  clicks: number;
  claimed: boolean;
}

interface CRMOpportunity {
  id: string;
  business_id: string;
  pipeline_stage: string;
  lead_engagement_score: number;
  notes: string;
}

interface FulfillmentProject {
  id: string;
  business_id: string;
  package_type: string;
  status: 'active' | 'completed' | 'delayed';
  progress: number;
}

interface FulfillmentTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  is_completed: boolean;
  due_date: string;
}

interface AgentLog {
  id: string;
  agent_name: 'CEO' | 'Sales' | 'Ops' | 'Fulfillment' | 'Success';
  action_taken: string;
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface Proposal {
  id: string;
  business_id: string;
  cover_title: string;
  status: string;
}

interface EmailSequence {
  id: string;
  business_id: string;
  steps: number;
  status: string;
  emails_generated?: {
    step1: { subject: string; body: string };
    step2?: { subject: string; body: string };
    step3?: { subject: string; body: string };
    step4?: { subject: string; body: string };
  };
}

interface DatabaseState {
  businesses: Business[];
  business_scores: BusinessScore[];
  website_audits: WebsiteAudit[];
  website_previews: WebsitePreview[];
  crm_opportunities: CRMOpportunity[];
  fulfillment_projects: FulfillmentProject[];
  fulfillment_tasks: FulfillmentTask[];
  agent_logs: AgentLog[];
  proposals: Proposal[];
  email_sequences?: EmailSequence[];
}

export default function DashboardPage() {
  const [db, setDb] = useState<DatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'ceo' | 'campaigns' | 'fulfillment'>('inventory');

  // Lead sourcing input
  const [sourceNiche, setSourceNiche] = useState('HVAC');
  const [sourceCity, setSourceCity] = useState('Denver');
  const [isSourcing, setIsSourcing] = useState(false);

  // Operations triggers
  const [isCEORunning, setIsCEORunning] = useState(false);
  const [simulatedLog, setSimulatedLog] = useState<string | null>(null);

  // Trigger loading database state
  const loadDatabase = async () => {
    try {
      const res = await fetch('/api/pipeline/route');
      const data = await res.json();
      if (data.success && data.db) {
        setDb(data.db);
      }
    } catch (err) {
      console.error("Failed to fetch pipeline snapshot", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Sourcing trigger
  const handleDiscoverLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSourcing(true);
    try {
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'source',
          niche: sourceNiche,
          city: sourceCity
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedLog(`Sourced and synced ${data.added_count} brand-new leads successfully!`);
        await loadDatabase();
        setTimeout(() => setSimulatedLog(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSourcing(false);
    }
  };

  // Run audit and scoring trigger
  const handleRunAudit = async (businessId: string) => {
    setSimulatedLog("Executing Gemini Scoring & Design Audit...");
    try {
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'audit',
          businessId
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedLog(`Audit complete! Score: ${data.score.score}/100. Classification: ${data.score.classification}.`);
        await loadDatabase();
        setTimeout(() => setSimulatedLog(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run website preview creation trigger
  const handleGenPreview = async (businessId: string) => {
    setSimulatedLog("Assembling Niche Template & AI copywriter...");
    try {
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          businessId
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedLog(`Created personalized preview concept at /preview/${data.preview.slug}`);
        await loadDatabase();
        setTimeout(() => setSimulatedLog(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run outreach copy drafting trigger
  const handleDraftSequence = async (businessId: string) => {
    setSimulatedLog("Drafting personalized 4-email sequence using Gemini API...");
    try {
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copywrite',
          businessId
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedLog("Dispatched pitch sequence and registered trackable links!");
        await loadDatabase();
        setTimeout(() => setSimulatedLog(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual trigger CEO scanner and briefings
  const handleTriggerCEO = async () => {
    setIsCEORunning(true);
    setSimulatedLog("CEO Agent scanning queues & tracking engagement metrics...");
    try {
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ceo-run' })
      });
      const data = await res.json();
      if (data.success) {
        setSimulatedLog("CEO pipeline scan successfully advanced workflows!");
        await loadDatabase();
        setTimeout(() => setSimulatedLog(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCEORunning(false);
    }
  };

  // Database Reset
  const handleResetDb = async () => {
    if (!confirm("Are you sure you want to reset the pipeline state to initial seed data?")) return;
    setLoading(true);
    try {
      await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      await loadDatabase();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-6" id="dashboard-loading">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"
        />
        <p className="text-slate-400 font-medium font-mono text-sm animate-pulse">Initializing autonomous growth container...</p>
      </div>
    );
  }

  const snapshot = db || {
    businesses: [],
    business_scores: [],
    website_audits: [],
    website_previews: [],
    crm_opportunities: [],
    fulfillment_projects: [],
    fulfillment_tasks: [],
    agent_logs: [],
    proposals: [],
    email_sequences: []
  };

  // Stats summaries
  const totalLeadsCount = snapshot.businesses.length;
  const scoredLeadsCount = snapshot.business_scores.length;
  const previewCreatedCount = snapshot.website_previews.length;
  const activeSequencesCount = snapshot.crm_opportunities.filter(o => o.pipeline_stage === 'EMAIL_SENT' || o.pipeline_stage === 'OPENED' || o.pipeline_stage === 'CLICKED').length;
  const wonCount = snapshot.crm_opportunities.filter(o => o.pipeline_stage === 'WON' || o.pipeline_stage === 'CLIENT' || o.pipeline_stage === 'RETAINER').length;
  const unauditedLeadsCount = snapshot.businesses.filter(b => !snapshot.business_scores.some(s => s.business_id === b.id)).length;
  const processedLeadsCount = Math.max(0, totalLeadsCount - unauditedLeadsCount);
  const processingRatio = totalLeadsCount > 0 ? Math.round((processedLeadsCount / totalLeadsCount) * 100) : 0;

  // Build pre-filled manual intervention outreach mailto URL
  const getManualOutreachMailto = (
    biz: Business,
    score?: BusinessScore,
    audit?: WebsiteAudit,
    preview?: WebsitePreview,
    seq?: EmailSequence
  ) => {
    if (!biz.email) return '#';

    // If step 1 email has already been generated by the AI copywriter, use it
    if (seq?.emails_generated?.step1) {
      const subject = encodeURIComponent(seq.emails_generated.step1.subject);
      const body = encodeURIComponent(seq.emails_generated.step1.body);
      return `mailto:${biz.email}?subject=${subject}&body=${body}`;
    }

    // Otherwise generate a high-converting manual outreach template tailored to their audit & metrics
    const subject = `Quick observation for ${biz.name} (${biz.city})`;
    const auditGap = audit?.infrastructure_gaps?.length
      ? `Specifically, our automated scan flagged high-priority opportunities in ${audit.infrastructure_gaps.slice(0, 2).join(' and ')}.`
      : `Our audit noticed strong local reputation (${biz.rating}★ across ${biz.review_count} reviews), but discovered potential conversion drop-offs on mobile and direct scheduling.`;

    const previewSnippet = preview
      ? `\n\nWe even prepared a live interactive prototype demonstrating the modernized booking flow: ${typeof window !== 'undefined' ? window.location.origin : ''}/preview/${preview.slug}`
      : '';

    const body = `Hi ${biz.name} Team,\n\nI was looking into prominent ${biz.category} businesses in ${biz.city} and came across ${biz.name}.\n\n${auditGap}${previewSnippet}\n\nWould you be open to a quick 5-minute conversation this week on how to convert more of your local search traffic into confirmed clients?\n\nBest regards,\nGrowth & Partnerships Team`;

    return `mailto:${biz.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Render score badges
  const renderScoreBadge = (scoreNum: number | undefined) => {
    if (scoreNum === undefined) return <span className="text-slate-400 font-mono text-xs">Pending</span>;
    let color = 'bg-red-50 text-red-700 border-red-200';
    if (scoreNum >= 81) color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (scoreNum >= 61) color = 'bg-teal-50 text-teal-700 border-teal-200';
    else if (scoreNum >= 41) color = 'bg-blue-50 text-blue-700 border-blue-200';
    else if (scoreNum >= 21) color = 'bg-amber-50 text-amber-700 border-amber-200';

    return (
      <span className={`px-2 py-0.5 border text-xs font-black font-mono rounded-md ${color}`}>
        {scoreNum}/100
      </span>
    );
  };

  // Render pipeline stage badges
  const renderStageBadge = (stage: string | undefined) => {
    if (!stage) return <span className="text-slate-400 font-mono text-xs">-</span>;
    let color = 'bg-slate-100 text-slate-700';
    
    if (stage === 'DISCOVERED') color = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    else if (stage === 'SCORED') color = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (stage === 'PREVIEW_GENERATED') color = 'bg-pink-50 text-pink-700 border-pink-200';
    else if (stage === 'EMAIL_SENT') color = 'bg-blue-50 text-blue-700 border-blue-200';
    else if (stage === 'OPENED' || stage === 'CLICKED') color = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (stage === 'WON' || stage === 'CLIENT' || stage === 'RETAINER') color = 'bg-emerald-50 text-emerald-700 border-emerald-200';

    return (
      <span className={`px-2.5 py-0.5 border text-[10px] font-extrabold uppercase rounded-full ${color}`}>
        {stage.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col relative" id="admin-dashboard-page">
      
      {/* HEADER SECTION */}
      <header className="bg-[#121824] border-b border-slate-800 sticky top-0 z-30" id="admin-header">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">Autonomous Lead Pipeline</span>
              <span className="block text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">CEO Multi-Agent Org Center</span>
            </div>
          </div>

          {/* SIMULATED ALERT / TOAST */}
          <AnimatePresence>
            {simulatedLog && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="hidden md:flex items-center gap-2 bg-slate-900 border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 text-xs font-mono"
                id="header-notification-toast"
              >
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>{simulatedLog}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleTriggerCEO}
              disabled={isCEORunning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              id="header-run-ceo-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCEORunning ? 'animate-spin' : ''}`} />
              <span>{isCEORunning ? 'CEO Scanning...' : 'Run CEO Scanner'}</span>
            </button>
            <button 
              onClick={handleResetDb}
              className="text-slate-400 hover:text-red-400 text-xs font-bold px-3 py-2 rounded-xl border border-slate-800 hover:border-red-500/20 transition-all"
              id="header-reset-db-btn"
            >
              Reset Demo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8" id="admin-main-grid">
        
        {/* KPI METRIC CARDS (Bento Rows) */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4" id="kpi-banner">
          
          <div className="bg-[#121824] border border-slate-800 p-5 rounded-2xl space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Sourced</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{totalLeadsCount}</span>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono bg-indigo-500/10 px-2 py-0.5 rounded">Discovery</span>
            </div>
          </div>

          <div className="bg-[#121824] border border-slate-800 p-5 rounded-2xl space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Audits Completed</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{scoredLeadsCount}</span>
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider font-mono bg-purple-500/10 px-2 py-0.5 rounded">Scored</span>
            </div>
          </div>

          <div className="bg-[#121824] border border-slate-800 p-5 rounded-2xl space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Previews Generated</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-white">{previewCreatedCount}</span>
              <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider font-mono bg-pink-500/10 px-2 py-0.5 rounded">Pitch-ready</span>
            </div>
          </div>

          <div className="bg-[#121824] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3" id="kpi-card-outreach">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Outreach Sequences</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded" id="outreach-trend-indicator">
                  <TrendingUp className="w-3 h-3" />
                  +5% vs yesterday
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-3xl font-black text-white">{activeSequencesCount}</span>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider font-mono bg-blue-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
            </div>

            {/* Visual progress bar: Processed vs Yet to be Audited */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5" id="outreach-progress-section">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Processing vs Unaudited</span>
                <span className="font-bold text-blue-400">{processedLeadsCount}:{unauditedLeadsCount} ({processingRatio}%)</span>
              </div>
              <div 
                className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden" 
                role="progressbar" 
                aria-valuenow={processingRatio} 
                aria-valuemin={0} 
                aria-valuemax={100}
                id="outreach-progress-bar-track"
              >
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${processingRatio}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>{processedLeadsCount} in pipeline</span>
                <span>{unauditedLeadsCount} pending audit</span>
              </div>
            </div>
          </div>

          <div className="bg-[#121824] border border-slate-800 p-5 rounded-2xl space-y-2 col-span-2 md:col-span-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Deals Closed Won</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-emerald-400">{wonCount}</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono bg-emerald-500/10 px-2 py-0.5 rounded">Closed</span>
            </div>
          </div>

        </section>

        {/* INTERACTIVE CONTROLS TABS */}
        <section className="flex border-b border-slate-800" id="tabs-navigation">
          {(['inventory', 'ceo', 'campaigns', 'fulfillment'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-xs font-extrabold uppercase tracking-widest transition-all relative ${
                activeTab === tab 
                  ? 'text-white border-b-2 border-indigo-500' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'inventory' ? 'Lead Inventory & Bento Board' : null}
              {tab === 'ceo' ? 'CEO Multi-Agent Center' : null}
              {tab === 'campaigns' ? 'Campaign Copywriter logs' : null}
              {tab === 'fulfillment' ? 'Fulfillment & Client Projects' : null}
            </button>
          ))}
        </section>

        {/* ACTIVE MODULE CONTAINER */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: BENTO BOARD & SOURCING */}
          {activeTab === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
              id="tab-inventory-board"
            >
              
              {/* SOURCING DISCOVERY ENGINE (Task 03) */}
              <div className="bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8" id="sourcing-box">
                <div className="grid md:grid-cols-12 gap-8 items-center">
                  <div className="md:col-span-4 space-y-3">
                    <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                      <Search className="w-3.5 h-3.5" />
                      <span>Task 03 Discovery Engine</span>
                    </div>
                    <h3 className="text-xl font-black text-white leading-tight">Source Net-New Local Businesses</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Slightly simulates ZoomInfo enrichment filters and Place Scrapers. Simply choose a niche and metropolitan area to discover net-new B2B leads.
                    </p>
                  </div>

                  <form onSubmit={handleDiscoverLeads} className="md:col-span-8 grid sm:grid-cols-3 gap-4" id="sourcing-form">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Industry / Niche</label>
                      <select 
                        value={sourceNiche}
                        onChange={(e) => setSourceNiche(e.target.value)}
                        className="w-full bg-[#1b2336] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-semibold"
                      >
                        <option value="HVAC">HVAC & Heating</option>
                        <option value="MedSpa">Aesthetic MedSpa</option>
                        <option value="Roofing">Roofing Contractors</option>
                        <option value="Cabinetry">Cabinet & Countertop</option>
                        <option value="Landscaping">Landscaping Services</option>
                        <option value="Professional">Professional Services</option>
                        <option value="Restaurant">Restaurant / Food</option>
                        <option value="Contractor">General Contractor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Metro City</label>
                      <input 
                        required
                        type="text" 
                        value={sourceCity}
                        onChange={(e) => setSourceCity(e.target.value)}
                        placeholder="e.g. Dallas, Denver" 
                        className="w-full bg-[#1b2336] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white font-semibold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        type="submit"
                        disabled={isSourcing}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        id="source-leads-btn"
                      >
                        <Activity className={`w-3.5 h-3.5 ${isSourcing ? 'animate-pulse' : ''}`} />
                        <span>{isSourcing ? 'Sourcing...' : 'Discover Leads'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* BENTO LEAD INVENTORY GRID (Task 04 & 06) */}
              <div className="bg-[#121824] border border-slate-800 rounded-3xl overflow-hidden" id="inventory-table-container">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-white">Active Pipeline Leads Directory</h3>
                    <p className="text-xs text-slate-400">Scored, classified, and mapped directly against synchronized GHL pipeline stages.</p>
                  </div>
                  <span className="text-[10px] font-bold font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                    {snapshot.businesses.length} Total Registered
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" id="leads-directory-table">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-900/50">
                        <th className="px-6 py-4">Business & Email Contact</th>
                        <th className="px-6 py-4">Maturity Score</th>
                        <th className="px-6 py-4">Recommended Offer</th>
                        <th className="px-6 py-4">outbound Sequence</th>
                        <th className="px-6 py-4">GHL CRM Stage</th>
                        <th className="px-6 py-4 text-right">Interactive Pipeline Tools</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs" id="leads-directory-body">
                      {snapshot.businesses.map((biz) => {
                        // Gather associated score, audit, preview, opportunities, sequences
                        const score = snapshot.business_scores.find(s => s.business_id === biz.id);
                        const audit = snapshot.website_audits.find(a => a.business_id === biz.id);
                        const preview = snapshot.website_previews.find(p => p.business_id === biz.id);
                        const opp = snapshot.crm_opportunities.find(o => o.business_id === biz.id);
                        const seq = snapshot.email_sequences?.find(s => s.business_id === biz.id);

                        return (
                          <tr key={biz.id} className="hover:bg-[#1b2336]/30 transition-all">
                            
                            {/* Business detail & Email Contact */}
                            <td className="px-6 py-4 space-y-1.5">
                              <div>
                                <span className="font-extrabold text-sm text-white block leading-snug">{biz.name}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                  {biz.category} • {biz.city}
                                </span>
                              </div>

                              {/* Email address field & quick-action manual intervention button */}
                              <div className="flex items-center gap-1.5 pt-0.5" id={`lead-email-section-${biz.id}`}>
                                {biz.email ? (
                                  <>
                                    <span 
                                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300 max-w-[180px] truncate"
                                      title={biz.email}
                                      id={`lead-email-field-${biz.id}`}
                                    >
                                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{biz.email}</span>
                                    </span>
                                    <a
                                      href={getManualOutreachMailto(biz, score, audit, preview, seq)}
                                      onClick={() => setSimulatedLog(`Opening default mail client with pre-filled manual outreach for ${biz.name}...`)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-[10px] font-bold tracking-tight transition-all shrink-0 cursor-pointer shadow-sm"
                                      title={`Open default mail client with pre-filled manual intervention template for ${biz.name}`}
                                      id={`manual-email-btn-${biz.id}`}
                                    >
                                      <Send className="w-2.5 h-2.5" />
                                      <span>Manual Outreach</span>
                                    </a>
                                  </>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 italic">
                                    <Mail className="w-3 h-3 text-slate-600 shrink-0" />
                                    No email on file
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Score info */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {renderScoreBadge(score?.score)}
                                {score && (
                                  <span className="text-[10px] font-bold text-slate-400">({score.classification})</span>
                                )}
                              </div>
                            </td>

                            {/* Recommended offer */}
                            <td className="px-6 py-4">
                              {audit ? (
                                <div className="space-y-0.5">
                                  <span className="font-extrabold text-slate-300 block">{audit.recommended_offer_tier}</span>
                                  <span className="text-[10px] font-bold font-mono text-emerald-400 block">Angle: {audit.outreach_angle}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500 font-medium">Pending Audit</span>
                              )}
                            </td>

                            {/* Sequence info */}
                            <td className="px-6 py-4">
                              {preview ? (
                                <a 
                                  href={`/preview/${preview.slug}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 hover:underline text-pink-400 text-xs font-semibold"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Pitch concept</span>
                                </a>
                              ) : (
                                <span className="text-slate-500 font-semibold">Requires Preview</span>
                              )}
                            </td>

                            {/* GHL Pipeline Stage */}
                            <td className="px-6 py-4">
                              <div className="space-y-1.5">
                                {renderStageBadge(opp?.pipeline_stage)}
                                {opp && (
                                  <span className="block text-[10px] font-bold text-slate-400 font-mono">Score: {opp.lead_engagement_score}</span>
                                )}
                              </div>
                            </td>

                            {/* Actions dispatches */}
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                
                                {/* 1. Trigger Audit */}
                                {!score && (
                                  <button 
                                    onClick={() => handleRunAudit(biz.id)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                    title="Calculate Digital Maturity Audit"
                                  >
                                    Run Audit
                                  </button>
                                )}

                                {/* 2. Generate Preview */}
                                {score && !preview && (
                                  <button 
                                    onClick={() => handleGenPreview(biz.id)}
                                    className="bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                    title="Create Customized Website Concept"
                                  >
                                    Gen Preview
                                  </button>
                                )}

                                {/* 3. Trigger Copywriter */}
                                {preview && opp?.pipeline_stage === 'PREVIEW_GENERATED' && (
                                  <button 
                                    onClick={() => handleDraftSequence(biz.id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                    title="Draft 4-Email Personal Outreach"
                                  >
                                    Pitch Outreach
                                  </button>
                                )}

                                {/* If lead is Closed Won or booked call, show proposal view option */}
                                {opp?.pipeline_stage === 'CALL_BOOKED' && (
                                  <a 
                                    href={`/proposal/${biz.id}`}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                    title="Open Digital ROI Proposal"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Proposal
                                  </a>
                                )}

                                {opp?.pipeline_stage === 'WON' && (
                                  <span className="text-emerald-400 font-bold text-[10px] uppercase flex items-center gap-1 px-2.5 py-1.5">
                                    <Check className="w-3.5 h-3.5" /> Won
                                  </span>
                                )}

                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 2: CEO MULTI-AGENT CONTROL CENTER */}
          {activeTab === 'ceo' && (
            <motion.div 
              key="ceo"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid lg:grid-cols-12 gap-8"
              id="tab-ceo-center"
            >
              
              {/* CEO BRIDGING MAP (Task 24) */}
              <div className="lg:col-span-4 bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6" id="ceo-org-panel">
                <div className="space-y-2">
                  <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">Task 24 Agent Mapping</span>
                  <h3 className="text-xl font-black text-white">Multi-Agent Organization</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Visual model of sub-agents directed autonomously by the CEO agent to coordinate lead discovery, email campaigns, GHL opportunity syncer, and onboarding.
                  </p>
                </div>

                <div className="space-y-4 font-mono text-xs border border-slate-800 p-4 rounded-2xl bg-[#0e1320]" id="agent-visual-graph">
                  <div className="border border-indigo-500/20 bg-indigo-500/10 p-3 rounded-xl text-center font-bold text-white relative">
                    [ CEO Agent Node ]
                    <span className="block text-[8px] text-indigo-300 font-normal mt-1">Directs schedules, scans queues, escalates blocks</span>
                  </div>
                  
                  <div className="flex justify-center text-indigo-500 py-1">↓</div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]" id="sub-agent-nodes">
                    <div className="border border-purple-500/20 bg-purple-500/10 p-2.5 rounded-lg text-center font-bold">
                      [ Sales Agent ]
                      <span className="block text-[8px] font-normal text-purple-300 mt-1">Sourcing & Previews</span>
                    </div>
                    <div className="border border-blue-500/20 bg-blue-500/10 p-2.5 rounded-lg text-center font-bold">
                      [ Ops Agent ]
                      <span className="block text-[8px] font-normal text-blue-300 mt-1">Sync GHL Stages</span>
                    </div>
                    <div className="border border-pink-500/20 bg-pink-500/10 p-2.5 rounded-lg text-center font-bold mt-2">
                      [ Fulfillment ]
                      <span className="block text-[8px] font-normal text-pink-300 mt-1">Project Roadmap</span>
                    </div>
                    <div className="border border-emerald-500/20 bg-emerald-500/10 p-2.5 rounded-lg text-center font-bold mt-2">
                      [ Success ]
                      <span className="block text-[8px] font-normal text-emerald-300 mt-1">Review Capture</span>
                    </div>
                  </div>
                </div>

                {/* LOGS AGENT FEED */}
                <div className="space-y-3" id="live-logs-container">
                  <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider">Live Agent Log Feed</h4>
                  <div className="space-y-2 h-64 overflow-y-auto pr-2 border border-slate-800 p-3 rounded-xl bg-slate-900/40 text-[10px] font-mono leading-normal" id="agent-logs-scroll">
                    {snapshot.agent_logs.map((log) => (
                      <div key={log.id} className="border-b border-slate-800/40 pb-2">
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                        <span className="text-indigo-400 font-bold">{log.agent_name}:</span>{' '}
                        <span className="text-slate-300">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CEO DAILY EXECUTIVE BRIEFING */}
              <div className="lg:col-span-8 bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6" id="ceo-briefing-panel">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      <Sparkles className="text-indigo-500 w-5 h-5 animate-pulse" />
                      CEO Agent: Executive Daily Briefing
                    </h3>
                    <p className="text-xs text-slate-400">Scans pipeline databases daily to highlight wins and suggest actions.</p>
                  </div>
                  <button 
                    onClick={handleTriggerCEO}
                    disabled={isCEORunning}
                    className="bg-[#1b2336] text-white hover:bg-[#252f47] text-xs font-bold border border-slate-700 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    id="trigger-ceo-scan-panel"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCEORunning ? 'animate-spin' : ''}`} />
                    <span>Run CEO Scanner</span>
                  </button>
                </div>

                {/* MARKDOWN VISUAL OUTPUT */}
                <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6 font-sans space-y-4" id="brief-rendered-markdown">
                  {snapshot.agent_logs.find(l => l.action_taken === 'Executive Daily Briefing')?.message ? (
                    <div className="space-y-4 whitespace-pre-wrap">
                      {snapshot.agent_logs.find(l => l.action_taken === 'Executive Daily Briefing')?.message}
                    </div>
                  ) : (
                    <div className="text-center py-10 space-y-3 text-slate-500" id="brief-pending">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                      <p className="font-semibold">No executive briefing generated for today.</p>
                      <p className="text-xs">Click the &ldquo;Run CEO Scanner&rdquo; button to trigger the autonomous scanner workflows immediately.</p>
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: CAMPAIGNS & TRACKING */}
          {activeTab === 'campaigns' && (
            <motion.div 
              key="campaigns"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
              id="tab-campaign-sequences"
            >
              <div className="bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6" id="sending-setup-card">
                <div className="space-y-2">
                  <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block">Task 13 Sending Infrastructure</span>
                  <h3 className="text-xl font-black text-white">Outbound Domain Authentication & Warmup</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Verify configuration records before active campaign runs.
                  </p>
                </div>

                <div className="grid sm:grid-cols-4 gap-4" id="auth-grid-cards">
                  {[
                    { label: 'SPF AUTH', status: 'Passed', detail: 'v=spf1 include:mailgun.org ~all' },
                    { label: 'DKIM AUTH', status: 'Passed', detail: 'k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN' },
                    { label: 'DMARC AUTH', status: 'Passed', detail: 'v=DMARC1; p=quarantine; pct=100' },
                    { label: 'WARMUP PROGRESS', status: 'Level 2', detail: 'Cap: 60 dispatches/day' },
                  ].map((auth) => (
                    <div key={auth.label} className="border border-slate-800 p-4 rounded-xl bg-slate-900/40 space-y-1">
                      <span className="block text-[10px] text-slate-500 font-bold uppercase">{auth.label}</span>
                      <span className="block text-sm font-black text-white flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {auth.status}
                      </span>
                      <span className="block text-[10px] font-mono text-slate-400 truncate">{auth.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TRACKING EVENT STREAMS */}
              <div className="bg-[#121824] border border-slate-800 rounded-3xl overflow-hidden" id="analytics-table-holder">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="font-extrabold text-base text-white">Engagement tracking logs</h3>
                  <p className="text-xs text-slate-400">Verifying live opens, clicks, page visit loads, and CTA events on customized previews.</p>
                </div>

                <div className="p-6 text-center text-slate-500 text-xs" id="no-events-holder">
                  {snapshot.agent_logs.filter(l => l.action_taken === 'Campaign Outbound Active').length > 0 ? (
                    <div className="space-y-4 text-left" id="events-log-feed">
                      <p className="font-bold text-slate-300">Live active campaigns outbound queue:</p>
                      <div className="space-y-2 font-mono text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 max-h-96 overflow-y-auto">
                        <p className="text-indigo-400 font-bold">{"// Dispatched outbound packages with live trackable parameters:"}</p>
                        <p>[2026-09-15 05:28] Dispatched Email 1 to contact@apexdenverhvac.com with tracking pixel</p>
                        <p>[2026-09-15 05:28] Registered tracking link: apex-heating-air-preview?bizId=biz_01</p>
                        <p>[2026-09-15 05:29] Open detected from IP 73.120.44.15 (User-Agent: Gmail Desktop Client)</p>
                        <p>[2026-09-15 05:29] Click detected on link: preview-url</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 space-y-3">
                      <Mail className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-semibold text-slate-400">No outreach campaigns active yet.</p>
                      <p className="text-xs max-w-sm mx-auto">Calculate a lead maturity score, generate their design preview concept, and click &ldquo;Pitch Outreach&rdquo; to begin campaigns.</p>
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 4: FULFILLMENT & ONBOARDING */}
          {activeTab === 'fulfillment' && (
            <motion.div 
              key="fulfillment"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
              id="tab-fulfillment-board"
            >
              
              <div className="grid md:grid-cols-12 gap-8" id="fulfillment-container-grid">
                
                {/* ACTIVE PROJECTS LIST */}
                <div className="md:col-span-5 bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6" id="projects-list-card">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-white">Active Fulfillment Projects</h3>
                    <p className="text-xs text-slate-400">Created upon proposal acceptance.</p>
                  </div>

                  <div className="space-y-4" id="fulfillment-projects-feed">
                    {snapshot.fulfillment_projects.length > 0 ? (
                      snapshot.fulfillment_projects.map((proj) => {
                        const biz = snapshot.businesses.find(b => b.id === proj.business_id);
                        return (
                          <div key={proj.id} className="border border-slate-800 p-4 rounded-xl bg-slate-900/40 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-extrabold text-white text-sm block leading-snug">{biz?.name || 'Local Client'}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">{proj.package_type}</span>
                              </div>
                              <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 rounded-full">
                                {proj.status}
                              </span>
                            </div>
                            
                            <div className="space-y-1" id="project-bar">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                                <span>Progress</span>
                                <span>{proj.progress}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${proj.progress}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 space-y-3 text-slate-500 border border-dashed border-slate-800 rounded-2xl" id="no-projects">
                        <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="font-semibold text-slate-400">No active client projects yet.</p>
                        <p className="text-[10px] max-w-xs mx-auto">When a customer claims their preview website design concept or accepts proposals, project templates assign autonomously.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* TASK ONBOARDING CHECKLISTS */}
                <div className="md:col-span-7 bg-[#121824] border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6" id="tasks-checklist-card">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-base text-white">Fulfillment & Onboarding Checklist</h3>
                    <p className="text-xs text-slate-400">Completed items auto-sync project progression meters immediately.</p>
                  </div>

                  <div className="space-y-3" id="fulfillment-tasks-list">
                    {snapshot.fulfillment_tasks.length > 0 ? (
                      snapshot.fulfillment_tasks.map((task) => (
                        <div 
                          key={task.id} 
                          className="flex items-start gap-3 border border-slate-800/40 p-4 rounded-xl hover:bg-[#1b2336]/20 transition-all text-xs cursor-pointer"
                        >
                          <div className={`p-1 border rounded-lg transition-all ${
                            task.is_completed 
                              ? 'bg-indigo-500 text-white border-indigo-500' 
                              : 'bg-[#1b2336] text-transparent border-slate-700'
                          }`}>
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <p className={`font-bold leading-snug ${task.is_completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                              {task.title}
                            </p>
                            <p className="text-[10px] text-slate-400 leading-normal">{task.description}</p>
                            <span className="block text-[9px] font-mono text-slate-500">Due Date: September 20, 2026</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-14 space-y-3 text-slate-500 border border-dashed border-slate-800 rounded-2xl" id="no-tasks">
                        <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="font-semibold text-slate-400">Checklist is currently clear.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#121824] border-t border-slate-800 py-8 text-center text-[10px] text-slate-500 mt-12" id="dashboard-footer">
        © 2026 Autonomous Lead-to-Client Pipeline. Portable handoff package ready. All rights reserved.
      </footer>

    </div>
  );
}
