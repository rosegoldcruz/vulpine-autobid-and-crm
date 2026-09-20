"use client";

import { useState, useEffect } from "react";
import { api, QAResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, ShieldCheck, ShieldAlert, ShieldX, Info } from "lucide-react";

export default function QAPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<QAResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const d = await api.getQA(params.id);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runQA = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.runQA(params.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const qaRun = data?.qa_run;
  const findings = data?.findings || [];

  const severityConfig: Record<string, { color: string; bg: string; icon: any }> = {
    BLOCKER: { color: "text-red-400", bg: "border-red-800 bg-red-900/20", icon: ShieldX },
    WARNING: { color: "text-yellow-400", bg: "border-yellow-800 bg-yellow-900/20", icon: ShieldAlert },
    INFO: { color: "text-blue-400", bg: "border-blue-800 bg-blue-900/20", icon: Info },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">QA Findings</h2>
          <p className="text-sm text-gray-500">Quality assurance checks — blockers, warnings, info</p>
        </div>
        <button
          onClick={runQA}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running QA..." : "Run QA"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!qaRun ? (
        <EmptyState
          title="No QA runs yet"
          message={data?.message || "Run QA checks to identify blockers and warnings before proposal generation."}
        />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-3">
            <SummaryBox label="Run #" value={qaRun.run_number} />
            <SummaryBox label="Total Checks" value={qaRun.total_checks} />
            <SummaryBox label="Blockers" value={qaRun.blockers_count} color={qaRun.blockers_count > 0 ? "text-red-400" : "text-gray-200"} />
            <SummaryBox label="Warnings" value={qaRun.warnings_count} color={qaRun.warnings_count > 0 ? "text-yellow-400" : "text-gray-200"} />
            <SummaryBox label="Info" value={qaRun.info_count} color="text-blue-400" />
          </div>

          {/* Proposal status */}
          <div className={`rounded-lg border p-4 ${qaRun.is_proposal_blocked ? "border-red-800 bg-red-900/10" : "border-green-800 bg-green-900/10"}`}>
            <div className="flex items-center gap-2">
              {qaRun.is_proposal_blocked ? (
                <>
                  <ShieldX className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-medium text-sm">Proposal is BLOCKED — resolve all blockers first</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium text-sm">Proposal generation allowed — QA {qaRun.status}</span>
                </>
              )}
            </div>
          </div>

          {/* Findings */}
          {findings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Findings ({findings.length})</h3>
              {findings.map((f) => {
                const cfg = severityConfig[f.severity] || severityConfig.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={f.id} className={`rounded-lg border p-3 ${cfg.bg}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 ${cfg.color} flex-shrink-0`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium uppercase ${cfg.color}`}>{f.severity}</span>
                          <span className="text-xs text-gray-600">{f.check_name}</span>
                          {f.entity_type && (
                            <span className="text-xs text-gray-600">· {f.entity_type}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mt-1">{f.message}</p>
                        {f.is_resolved && (
                          <span className="text-xs text-green-500 mt-1">✓ Resolved</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/50 p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || "text-gray-200"}`}>{value}</div>
    </div>
  );
}