"use client";

import { useState, useEffect } from "react";
import { api, ProposalResponse, PricingResponse, QAResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, FileText, Download, CheckCircle } from "lucide-react";

export default function ProposalPage({ params }: { params: { id: string } }) {
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [qa, setQA] = useState<QAResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [p, pr, qa] = await Promise.all([
        api.getProposal(params.id),
        api.getPricing(params.id),
        api.getQA(params.id),
      ]);
      setProposal(p);
      setPricing(pr);
      setQA(qa);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const generateProposal = async () => {
    if (!pricing?.pricing) return;
    setRunning(true);
    setError(null);
    try {
      // Get BOM version from pricing
      const bomRes = await api.getBOM(params.id);
      if (!bomRes.bom) throw new Error("No BOM found");
      await api.generateProposal(params.id, pricing.pricing.id, bomRes.bom.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const prop = proposal?.proposal;
  const qaBlocked = qa?.qa_run?.is_proposal_blocked ?? true;
  const hasPricing = !!pricing?.pricing;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Proposal Generation</h2>
          <p className="text-sm text-gray-500">Generate client-facing proposal from approved pricing</p>
        </div>
        <button
          onClick={generateProposal}
          disabled={running || !hasPricing || qaBlocked}
          className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Generating..." : "Generate Proposal"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Blockers */}
      {qaBlocked && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/10 p-4">
          <p className="text-sm text-red-400 font-medium">Cannot generate proposal</p>
          <p className="text-xs text-gray-500 mt-1">Resolve all QA blockers before generating a proposal.</p>
        </div>
      )}
      {!hasPricing && (
        <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/10 p-4">
          <p className="text-sm text-yellow-400 font-medium">No pricing available</p>
          <p className="text-xs text-gray-500 mt-1">Generate pricing before creating a proposal.</p>
        </div>
      )}

      {!prop ? (
        <EmptyState
          title="No proposals generated yet"
          message={proposal?.message || "Generate a proposal from approved pricing and BOM."}
        />
      ) : (
        <div className="space-y-6">
          {/* Proposal header */}
          <div className="rounded-xl border border-vulpine-orange/30 bg-vulpine-orange/5 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-100">{prop.title || `Proposal ${prop.proposal_number}`}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {prop.proposal_number} · Version {prop.version_number}
                </p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                prop.status === "APPROVED" ? "bg-green-900/30 text-green-400" :
                prop.status === "DRAFT" ? "bg-vulpine-panel text-gray-400" :
                "text-gray-400 bg-vulpine-panel"
              }`}>
                {prop.status}
              </span>
            </div>
          </div>

          {/* Key details */}
          <div className="grid grid-cols-4 gap-3">
            <Detail label="Total Price" value={prop.total_price ? `$${prop.total_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} highlight />
            <Detail label="Total Cabinets" value={String(prop.total_cabinets)} />
            <Detail label="Proposal Date" value={prop.proposal_date ? new Date(prop.proposal_date).toLocaleDateString() : "—"} />
            <Detail label="Valid Until" value={prop.valid_until ? new Date(prop.valid_until).toLocaleDateString() : "—"} />
          </div>

          {/* Executive summary */}
          {prop.executive_summary && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Executive Summary</h3>
              <p className="text-sm text-gray-400">{prop.executive_summary}</p>
            </div>
          )}

          {/* Scope */}
          {prop.scope_summary && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Scope Summary</h3>
              <p className="text-sm text-gray-400">{prop.scope_summary}</p>
            </div>
          )}

          {/* Terms */}
          {(prop.estimated_lead_time || prop.warranty_terms || prop.payment_terms) && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Terms</h3>
              <div className="grid grid-cols-3 gap-4">
                {prop.estimated_lead_time && <Detail label="Lead Time" value={prop.estimated_lead_time} />}
                {prop.warranty_terms && <Detail label="Warranty" value={prop.warranty_terms} />}
                {prop.payment_terms && <Detail label="Payment" value={prop.payment_terms} />}
              </div>
            </div>
          )}

          {/* Download links */}
          {(prop.pdf_file_path || prop.html_file_path) && (
            <div className="flex gap-3">
              {prop.pdf_file_path && (
                <a
                  href={`/api/v1/auto-bid/projects/${params.id}/proposal/download`}
                  className="inline-flex items-center gap-2 rounded-lg border border-vulpine-border bg-vulpine-panel px-4 py-2 text-sm text-gray-300 hover:border-vulpine-orange/50"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-vulpine-orange/50 bg-vulpine-orange/5" : "border-vulpine-border bg-vulpine-panel/50"}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-vulpine-orange" : "text-gray-200"}`}>{value}</div>
    </div>
  );
}