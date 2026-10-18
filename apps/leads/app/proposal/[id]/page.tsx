'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { 
  FileText, Shield, DollarSign, Clock, Check, Signature, ArrowRight, CheckCircle2, 
  Sparkles, CheckSquare, Briefcase, Zap, Info 
} from 'lucide-react';

interface ProposalData {
  business: {
    name: string;
    city: string;
    phone: string;
    website: string;
  };
  proposal: {
    id: string;
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
  };
}

export default function ProposalPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best'>('better');
  const [signatureName, setSignatureName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function loadProposal() {
      try {
        const id = params.id as string;
        if (!id) return;

        // Fetch DB state
        const res = await fetch('/api/pipeline/route');
        const dbState = await res.json();
        
        if (dbState.success && dbState.db) {
          const db = dbState.db;
          // Find proposal
          const prop = db.proposals.find((p: any) => p.id === id || p.business_id === id);
          if (prop) {
            const biz = db.businesses.find((b: any) => b.id === prop.business_id);
            setData({
              business: biz,
              proposal: prop
            });
            if (prop.status === 'accepted') {
              setAccepted(true);
            }
          }
        }
      } catch (err) {
        console.error("Proposal load error", err);
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [params.id]);

  const handleAcceptProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !signatureName.trim()) return;
    setIsSubmitting(true);
    try {
      // Simulate marked WON, creating project and onboarding tasks
      const res = await fetch('/api/pipeline/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ceo-run' }) // Advances workflow triggers
      });

      // Update state locally
      const mockProp = { ...data };
      mockProp.proposal.status = 'accepted';
      setData(mockProp);
      setAccepted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6" id="loading-proposal">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"
        />
        <p className="text-slate-600 font-medium font-sans">Compiling customized ROI proposal...</p>
      </div>
    );
  }

  // Fallback proposal mockup for representation purposes
  const fallbackProposal: ProposalData = {
    business: {
      name: "Apex Heating & Air",
      city: "Denver",
      phone: "(303) 555-0142",
      website: "apexdenverhvac.com"
    },
    proposal: {
      id: "prop_demo",
      cover_title: "Digital Conversion Infrastructure & Booking Platform Proposal",
      executive_summary: "This proposal outlines the deployment strategy to equip Apex Heating & Air with high-converting responsive web templates integrated directly with GoHighLevel calendar schedulers.",
      gap_analysis: "Apex Heating & Air website possesses an 8-year-old design framework with high friction. Lack of SMS review tools, online calendars, and tracking pixels contributes to an estimated $24,000 in missed local service calls annually.",
      proposed_solution: "Implement our custom HVAC-Plumbing conversion layout template synced with GHL SMS text-back and review workflows.",
      pricing_tiers: {
        good: { title: "Starter Booking Site", price: "$1,500 setup + $197/mo", description: "Mobile-responsive redesign with standard email lead forms and custom review highlights integration.", roi_framing: "Recovers setup investment with only 2 standard furnace repairs." },
        better: { title: "Premium Conversion Engine", price: "$2,500 setup + $397/mo", description: "Complete rebuild integrated with SMS-booking calendar, GHL pipeline capture, and missed-call automated text back.", roi_framing: "Standard local ROI of 3-5x based on hvac conversion uplift." },
        best: { title: "Full-Scale Growth Suite", price: "$5,000 setup + $750/mo", description: "Complete GHL CRM pipeline construction, automated review requests, past client reactivation campaigns, and ongoing monthly updates.", roi_framing: "Designed to unlock a 20%+ increase in yearly gross booking volume." }
      },
      timeline: [
        "Day 1-3: Collect brand guidelines & assets",
        "Day 4-7: Code templates & personalize copywriting copy",
        "Day 8-10: Connect GHL booking schedules and SMS automations",
        "Day 11-12: Full mobile QA and Go-Live"
      ],
      terms: "50% deposit due on sign-off, remaining 50% on project completion. Billed monthly for CRM licenses. Free support for minor copy revisions for 30 days.",
      status: 'sent'
    }
  };

  const business = data?.business || fallbackProposal.business;
  const proposal = data?.proposal || fallbackProposal.proposal;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center py-12 px-4 md:px-8 relative" id="proposal-page-wrapper">
      
      {/* 27 — COMPLIANCE HEADER */}
      <div className="w-full max-w-4xl bg-slate-800 border border-slate-700 p-4 rounded-2xl mb-8 flex items-center gap-3 text-xs text-slate-300" id="proposal-compliance">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <span>This is a digital growth proposal. Signing this document simulates client onboarding, project template assignment, and fulfillment task synchronization in real-time.</span>
      </div>

      <div className="w-full max-w-4xl bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-200" id="proposal-paper">
        {/* Cover Section */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-12 md:p-16 text-white space-y-6 relative" id="proposal-cover">
          <div className="absolute top-12 right-12 text-indigo-400/20 font-black text-9xl select-none">ROI</div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-200 text-xs font-bold px-3 py-1.5 rounded-full" id="proposal-badge">
            <FileText className="w-4 h-4" />
            <span>Digital Growth & Infrastructure Strategy</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight max-w-2xl">
            {proposal.cover_title}
          </h1>
          <div className="pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-6 text-xs text-indigo-200" id="proposal-meta">
            <div>
              <span className="block text-white font-bold uppercase tracking-wider mb-1">Prepared For</span>
              <span className="font-semibold text-sm">{business.name}</span>
            </div>
            <div>
              <span className="block text-white font-bold uppercase tracking-wider mb-1">Prepared By</span>
              <span className="font-semibold text-sm">Autonomous Client Engine</span>
            </div>
            <div>
              <span className="block text-white font-bold uppercase tracking-wider mb-1">Date Issued</span>
              <span className="font-semibold text-sm">September 15, 2026</span>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-10 md:p-14 space-y-10" id="proposal-body">
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              1. Executive Summary
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">
              {proposal.executive_summary}
            </p>
          </div>

          {/* Gap Analysis */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600" />
              2. Core Gap Analysis & Leaks
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">
              {proposal.gap_analysis}
            </p>
          </div>

          {/* Proposed Solution */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
              3. Proposed Solution
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base">
              {proposal.proposed_solution}
            </p>
          </div>

          {/* Pricing Option Tiers Matrix */}
          <div className="space-y-6 pt-6 border-t border-slate-100" id="pricing-section">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-indigo-600" />
                4. Strategic Pricing & Investment Tiers
              </h2>
              <p className="text-xs text-slate-400 font-semibold">Select your package tier to activate e-signature approval below.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6" id="proposal-pricing-grid">
              {(['good', 'better', 'best'] as const).map((tier) => {
                const item = proposal.pricing_tiers[tier];
                const isSelected = selectedTier === tier;
                return (
                  <div 
                    key={tier}
                    onClick={() => !accepted && setSelectedTier(tier)}
                    className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between space-y-4 ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-lg' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {tier === 'better' && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{tier} package</span>
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">{item.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <span className="block text-xl font-black text-slate-950">{item.price}</span>
                      <span className="block text-[10px] text-emerald-600 font-bold leading-normal">
                        <strong>ROI:</strong> {item.roi_framing}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Implementation Timeline */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              5. Delivery & Implementation Roadmap
            </h2>
            <div className="relative border-l-2 border-indigo-100 ml-4 pl-6 space-y-6 py-2" id="timeline-list">
              {proposal.timeline.map((step, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 bg-indigo-600 rounded-full border-4 border-white" />
                  <p className="text-sm font-bold text-slate-900 leading-snug">{step.split(': ')[0]}</p>
                  <p className="text-xs text-slate-500 mt-1">{step.split(': ')[1]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Terms & Agreement SLA */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              6. Terms, Payment Schedule & SLA
            </h2>
            <p className="text-slate-500 leading-relaxed text-xs">
              {proposal.terms}
            </p>
          </div>

          {/* Signature acceptance block */}
          <div className="pt-8 border-t border-slate-200 bg-slate-50 -mx-10 md:-mx-14 -mb-10 md:-mb-14 p-10 md:p-14" id="signature-block">
            {accepted ? (
              <div className="text-center space-y-4 py-4" id="signature-accepted-message">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-900">Proposal Digitally Signed!</h3>
                  <p className="text-sm text-slate-500">Agreement locked successfully on September 15, 2026. Onboarding triggered.</p>
                </div>
                <button 
                  onClick={() => router.push('/')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm px-6 py-2.5 rounded-xl transition-all"
                >
                  Return to Control Panel
                </button>
              </div>
            ) : (
              <form onSubmit={handleAcceptProposal} className="grid md:grid-cols-2 gap-8 items-end">
                <div className="space-y-4">
                  <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-1.5">
                    <Signature className="w-5 h-5 text-indigo-600" />
                    7. Sign & Activate Agreement
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    By inputting your name below, you select the <strong>{proposal.pricing_tiers[selectedTier].title}</strong> ({proposal.pricing_tiers[selectedTier].price}) and digitally sign this agreement.
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">E-Signature Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Johnathan Doe, CEO" 
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl text-center font-serif text-lg italic text-indigo-700 font-bold border-dashed flex items-center justify-center h-16" id="signature-preview-box">
                    {signatureName || 'Your Signature Preview'}
                  </div>
                  <button 
                    type="submit"
                    disabled={isSubmitting || !signatureName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    id="sign-proposal-submit"
                  >
                    <span>Sign & Accept Proposal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
