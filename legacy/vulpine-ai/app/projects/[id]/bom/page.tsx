"use client";

import { useState, useEffect } from "react";
import { api, BOMResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, CheckCircle, ListTree } from "lucide-react";

export default function BOMPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<BOMResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const d = await api.getBOM(params.id);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const generateBOM = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.generateBOM(params.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const approveBOM = async () => {
    if (!data?.bom) return;
    setRunning(true);
    try {
      await api.approveBOM(params.id, data.bom.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const bom = data?.bom;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Raw BOM</h2>
          <p className="text-sm text-gray-500">Versioned bill of materials from cabinet requirements</p>
        </div>
        <div className="flex gap-2">
          {bom && bom.status === "DRAFT" && (
            <button
              onClick={approveBOM}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg border border-green-700 text-green-400 px-4 py-2 text-sm font-medium hover:bg-green-900/20 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve BOM
            </button>
          )}
          <button
            onClick={generateBOM}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate BOM
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!bom ? (
        <EmptyState
          title="No BOM generated yet"
          message={data?.message || "Generate a BOM from extracted cabinet requirements."}
        />
      ) : (
        <div className="space-y-6">
          {/* BOM summary */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryBox label="Version" value={`v${bom.version_number}`} />
            <SummaryBox label="Status" value={bom.status} statusColor={bom.status === "APPROVED" ? "text-green-400" : "text-yellow-400"} />
            <SummaryBox label="Total Lines" value={bom.total_lines} />
            <SummaryBox label="Total Cabinets" value={bom.total_cabinets} />
          </div>

          {/* Lines */}
          <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Room</th>
                    <th className="text-left px-4 py-2 font-medium">Cabinet Type</th>
                    <th className="text-left px-4 py-2 font-medium">Qty</th>
                    <th className="text-left px-4 py-2 font-medium">Dimensions</th>
                    <th className="text-left px-4 py-2 font-medium">Finish</th>
                    <th className="text-left px-4 py-2 font-medium">SKU Mapped</th>
                    <th className="text-left px-4 py-2 font-medium">Confidence</th>
                    <th className="text-left px-4 py-2 font-medium">Exception</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vulpine-border">
                  {data?.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-vulpine-panel/50">
                      <td className="px-4 py-2 text-gray-400">{l.line_number}</td>
                      <td className="px-4 py-2 text-gray-300">{l.room_label || "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{l.cabinet_type || "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{l.quantity}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {l.width || "?"}×{l.height || "?"}×{l.depth || "?"}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{l.finish || "—"}</td>
                      <td className="px-4 py-2">
                        {l.mapped_sku_id ? (
                          <span className="text-green-500 text-xs">Yes</span>
                        ) : (
                          <span className="text-gray-600 text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {l.sku_confidence ? `${(l.sku_confidence * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {l.is_exception ? (
                          <span className="text-yellow-500 text-xs">⚠ Yes</span>
                        ) : (
                          <span className="text-gray-600 text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value, statusColor }: { label: string; value: string | number; statusColor?: string }) {
  return (
    <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/50 p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${statusColor || "text-gray-200"}`}>{value}</div>
    </div>
  );
}