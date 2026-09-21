"use client";

import { useState, useEffect } from "react";
import { api, BOMResponse, SKUCatalogResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, Boxes, Search } from "lucide-react";

export default function SKUMapPage({ params }: { params: { id: string } }) {
  const [bom, setBOM] = useState<BOMResponse | null>(null);
  const [skus, setSkus] = useState<SKUCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const [b, s] = await Promise.all([api.getBOM(params.id), api.listSKUs()]);
      setBOM(b);
      setSkus(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runMapping = async () => {
    if (!bom?.bom) return;
    setRunning(true);
    setError(null);
    try {
      await api.runSKUMapping(params.id, bom.bom.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const hasBOM = !!bom?.bom;
  const hasSKUs = (skus?.count ?? 0) > 0;
  const mappedCount = bom?.lines.filter((l) => l.mapped_sku_id).length ?? 0;
  const exceptionCount = bom?.lines.filter((l) => l.is_exception).length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">SKU Mapping</h2>
          <p className="text-sm text-gray-500">Match BOM lines to catalog SKUs</p>
        </div>
        {hasBOM && (
          <button
            onClick={runMapping}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Mapping..." : "Run Auto-Mapping"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!hasBOM ? (
        <EmptyState
          title="No BOM available"
          message="Generate a BOM first before mapping SKUs."
        />
      ) : !hasSKUs ? (
        <EmptyState
          title="No SKU catalog imported"
          message="Add SKUs to the catalog to enable mapping. Visit the SKU Catalog page to add items."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <Box label="Total Lines" value={bom?.bom?.total_lines ?? 0} />
            <Box label="Mapped" value={mappedCount} color="text-green-400" />
            <Box label="Exceptions" value={exceptionCount} color={exceptionCount > 0 ? "text-yellow-400" : "text-gray-200"} />
            <Box label="Catalog Size" value={skus?.count ?? 0} />
          </div>

          {/* BOM lines with mapping status */}
          <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Cabinet Type</th>
                    <th className="text-left px-4 py-2 font-medium">Qty</th>
                    <th className="text-left px-4 py-2 font-medium">SKU</th>
                    <th className="text-left px-4 py-2 font-medium">Confidence</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-vulpine-border">
                  {bom?.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-vulpine-panel/50">
                      <td className="px-4 py-2 text-gray-400">{l.line_number}</td>
                      <td className="px-4 py-2 text-gray-300">{l.cabinet_type || l.design_intent || "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{l.quantity}</td>
                      <td className="px-4 py-2 text-xs">
                        {l.mapped_sku_id ? (
                          <span className="text-green-500">{l.mapped_sku_id.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-gray-600">Unmapped</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {l.sku_confidence ? `${(l.sku_confidence * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {l.is_exception ? (
                          <span className="text-yellow-500 text-xs">⚠ Exception</span>
                        ) : l.mapped_sku_id ? (
                          <span className="text-green-500 text-xs">✓ Mapped</span>
                        ) : (
                          <span className="text-gray-600 text-xs">Pending</span>
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

function Box({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/50 p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || "text-gray-200"}`}>{value}</div>
    </div>
  );
}