"use client";

import { useState, useEffect } from "react";
import { api, PreflightResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, FileText, AlertCircle, Layers, Scan } from "lucide-react";

export default function PreflightPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PreflightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const d = await api.getPreflight(params.id);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runPreflight = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.runPreflight(params.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const preflight = data?.preflight;
  const pages = data?.pages || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Preflight Results</h2>
          <p className="text-sm text-gray-500">Document analysis before extraction</p>
        </div>
        <button
          onClick={runPreflight}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running..." : "Run Preflight"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!preflight ? (
        <EmptyState
          title="No preflight has been run"
          message="Run preflight to analyze uploaded documents for page count, dimensions, and cabinet pages."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-3">
            <StatBox icon={<FileText className="w-4 h-4" />} label="Total Pages" value={preflight.total_pages} />
            <StatBox icon={<Layers className="w-4 h-4" />} label="Documents" value={preflight.total_documents} />
            <StatBox icon={<Scan className="w-4 h-4" />} label="Schedule Pages" value={preflight.schedule_pages_count} />
            <StatBox icon={<Scan className="w-4 h-4" />} label="Cabinet Pages" value={preflight.cabinet_keyword_pages} />
            <StatBox icon={<AlertCircle className="w-4 h-4" />} label="Needs OCR" value={preflight.needs_ocr_count} alert={preflight.needs_ocr_count > 0} />
          </div>

          {/* Readiness */}
          <div className={`rounded-lg border p-4 ${preflight.is_ready_for_extraction ? "border-green-800 bg-green-900/10" : "border-yellow-800 bg-yellow-900/10"}`}>
            <div className="flex items-center gap-2">
              {preflight.is_ready_for_extraction ? (
                <span className="text-green-400 text-sm">✓ Ready for extraction</span>
              ) : (
                <span className="text-yellow-400 text-sm">⚠ Not ready for extraction</span>
              )}
            </div>
            {preflight.extraction_notes && (
              <p className="text-xs text-gray-500 mt-1">{preflight.extraction_notes}</p>
            )}
          </div>

          {/* Warnings */}
          {preflight.warnings && preflight.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-800 bg-yellow-900/10 p-4">
              <h3 className="text-sm font-medium text-yellow-400 mb-2">Warnings</h3>
              <ul className="space-y-1 text-xs text-yellow-300/80">
                {preflight.warnings.map((w, i) => <li key={i}>• {typeof w === "string" ? w : JSON.stringify(w)}</li>)}
              </ul>
            </div>
          )}

          {/* Bookmarks */}
          {preflight.has_bookmarks && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
              <span className="text-sm text-gray-400">Bookmarks: {preflight.bookmark_count} found</span>
            </div>
          )}

          {/* Pages table */}
          {pages.length > 0 && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-vulpine-border">
                <h3 className="text-sm font-medium text-gray-300">Page Details ({pages.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-vulpine-ink/50 text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">#</th>
                      <th className="text-left px-4 py-2 font-medium">Size</th>
                      <th className="text-left px-4 py-2 font-medium">Sheet</th>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Text</th>
                      <th className="text-left px-4 py-2 font-medium">OCR</th>
                      <th className="text-left px-4 py-2 font-medium">Cabinet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vulpine-border">
                    {pages.map((p) => (
                      <tr key={p.id} className="hover:bg-vulpine-panel/50">
                        <td className="px-4 py-2 text-gray-400">{p.page_number}</td>
                        <td className="px-4 py-2 text-gray-400">{p.page_size_label || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{p.sheet_label || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{p.sheet_type || "—"}</td>
                        <td className="px-4 py-2">
                          {p.has_text ? <span className="text-green-500">Yes ({p.text_char_count})</span> : <span className="text-gray-600">No</span>}
                        </td>
                        <td className="px-4 py-2">
                          {p.needs_ocr ? <span className="text-yellow-500">Yes</span> : <span className="text-gray-600">No</span>}
                        </td>
                        <td className="px-4 py-2">
                          {p.is_cabinet_related ? <span className="text-vulpine-orange">Yes</span> : <span className="text-gray-600">No</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${alert ? "border-yellow-800" : "border-vulpine-border"} bg-vulpine-panel/50`}>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold ${alert ? "text-yellow-400" : "text-gray-200"}`}>{value}</div>
    </div>
  );
}