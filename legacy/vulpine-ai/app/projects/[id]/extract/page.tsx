"use client";

import { useState, useEffect } from "react";
import { api, EvidenceResponse, CabinetRequirementsResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, ScanText, FileSearch } from "lucide-react";

export default function ExtractPage({ params }: { params: { id: string } }) {
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [reqs, setReqs] = useState<CabinetRequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"evidence" | "requirements">("requirements");

  const loadData = async () => {
    try {
      const [e, r] = await Promise.all([api.getEvidence(params.id), api.getCabinetRequirements(params.id)]);
      setEvidence(e);
      setReqs(r);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runExtraction = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.runExtraction(params.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const hasData = (evidence?.count ?? 0) > 0 || (reqs?.count ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Extraction Results</h2>
          <p className="text-sm text-gray-500">Cabinet requirements extracted from documents</p>
        </div>
        <button
          onClick={runExtraction}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Extracting..." : "Run Extraction"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!hasData ? (
        <EmptyState
          title="No extraction results"
          message="Run extraction to identify cabinet requirements from uploaded documents."
        />
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-vulpine-border">
            <TabButton active={tab === "requirements"} onClick={() => setTab("requirements")}>
              Cabinet Requirements ({reqs?.count ?? 0})
            </TabButton>
            <TabButton active={tab === "evidence"} onClick={() => setTab("evidence")}>
              Evidence ({evidence?.count ?? 0})
            </TabButton>
          </div>

          {tab === "requirements" && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Room</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Qty</th>
                    <th className="text-left px-4 py-2 font-medium">W×H×D</th>
                    <th className="text-left px-4 py-2 font-medium">Finish</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vulpine-border">
                  {reqs?.requirements.map((r) => (
                    <tr key={r.id} className="hover:bg-vulpine-panel/50">
                      <td className="px-4 py-2 text-gray-300">{r.room_label || "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{r.cabinet_type || "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{r.quantity ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {r.width || "?"} × {r.height || "?"} × {r.depth || "?"}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{r.finish || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${r.status === "MAPPED" ? "text-green-500" : "text-gray-500"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "evidence" && (
            <div className="space-y-3">
              {evidence?.evidence.map((e) => (
                <div key={e.id} className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-vulpine-orange font-medium">{e.evidence_type}</span>
                    <span className="text-xs text-gray-600">Page {e.page_number} · {e.source_method}</span>
                  </div>
                  <p className="text-sm text-gray-300">{e.raw_text}</p>
                  {e.confidence && (
                    <div className="mt-2 text-xs text-gray-600">Confidence: {(e.confidence * 100).toFixed(0)}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        active ? "border-vulpine-orange text-vulpine-orange" : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}