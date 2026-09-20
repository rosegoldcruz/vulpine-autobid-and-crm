"use client";

import { useState, useEffect } from "react";
import { api, PricingResponse, BOMResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Play, DollarSign, CheckCircle, AlertCircle } from "lucide-react";

export default function PricingPage({ params }: { params: { id: string } }) {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [bom, setBOM] = useState<BOMResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [p, b] = await Promise.all([api.getPricing(params.id), api.getBOM(params.id)]);
      setPricing(p);
      setBOM(b);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const generatePricing = async () => {
    if (!bom?.bom) return;
    setRunning(true);
    setError(null);
    try {
      await api.generatePricing(params.id, bom.bom.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const approvePricing = async () => {
    if (!pricing?.pricing) return;
    setRunning(true);
    try {
      await api.approvePricing(params.id, pricing.pricing.id);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const pv = pricing?.pricing;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Pricing Summary</h2>
          <p className="text-sm text-gray-500">Cost breakdown, margin, and sell price</p>
        </div>
        <div className="flex gap-2">
          {pv && pv.status === "DRAFT" && !pv.is_blocked && (
            <button
              onClick={approvePricing}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg border border-green-700 text-green-400 px-4 py-2 text-sm font-medium hover:bg-green-900/20 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve Pricing
            </button>
          )}
          <button
            onClick={generatePricing}
            disabled={running || !bom?.bom}
            className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Pricing
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!bom?.bom ? (
        <EmptyState
          title="No BOM available"
          message="Generate and approve a BOM before pricing."
        />
      ) : !pv ? (
        <EmptyState
          title="No pricing generated yet"
          message={pricing?.message || "Generate pricing from the approved BOM."}
        />
      ) : (
        <div className="space-y-6">
          {/* Blocked alert */}
          {pv.is_blocked && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                Pricing is BLOCKED
              </div>
              <ul className="text-xs text-red-300/80 ml-6 list-disc">
                {pv.block_reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Key numbers */}
          <div className="grid grid-cols-4 gap-3">
            <Big label="Landed Cost" value={`$${pv.landed_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Big label="Sell Price" value={`$${pv.suggested_sell_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} highlight />
            <Big label="Gross Profit" value={`$${pv.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Big label="Margin" value={`${pv.gross_margin_percent}%`} color={pv.meets_margin_floor ? "text-green-400" : "text-red-400"} />
          </div>

          {/* Cost breakdown */}
          <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Cost Breakdown</h3>
            <div className="space-y-2">
              <CostRow label="Product Cost" value={pv.total_product_cost} />
              <CostRow label="Freight" value={pv.total_freight} />
              <CostRow label="Duties & Tariffs" value={pv.total_duties_tariffs} />
              <CostRow label="Tax" value={pv.total_tax} />
              <CostRow label="Storage" value={pv.total_storage} />
              <CostRow label="Delivery" value={pv.total_delivery} />
              <CostRow label="Installation" value={pv.total_installation} />
              <CostRow label="Contingency" value={pv.total_contingency} />
              <CostRow label="Other Costs" value={pv.total_other_costs} />
              <div className="border-t border-vulpine-border pt-2 mt-2">
                <CostRow label="Total Landed Cost" value={pv.landed_cost} bold />
              </div>
            </div>
          </div>

          {/* Margin details */}
          <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Margin Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <Detail label="Desired Margin" value={`${pv.desired_margin_percent}%`} />
              <Detail label="Actual Margin" value={`${pv.gross_margin_percent}%`} good={pv.meets_margin_floor} bad={!pv.meets_margin_floor} />
              <Detail label="Margin Floor Met" value={pv.meets_margin_floor ? "Yes" : "No"} good={pv.meets_margin_floor} bad={!pv.meets_margin_floor} />
              {pv.rep_commission_percent != null && (
                <>
                  <Detail label="Rep Commission" value={`${pv.rep_commission_percent}%`} />
                  <Detail label="Commission Amount" value={`$${pv.rep_commission_amount?.toFixed(2) ?? "0"}`} />
                  <Detail label="Vulpine Retained" value={`$${pv.vulpine_retained_profit?.toFixed(2) ?? "0"}`} />
                </>
              )}
            </div>
          </div>

          {/* Risk flags */}
          {pv.risk_flags.length > 0 && (
            <div className="rounded-lg border border-yellow-800 bg-yellow-900/10 p-4">
              <h3 className="text-sm font-medium text-yellow-400 mb-2">Risk Flags</h3>
              <ul className="text-xs text-yellow-300/80 list-disc ml-4">
                {pv.risk_flags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Line items */}
          {pricing?.lines && pricing.lines.length > 0 && (
            <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-vulpine-border">
                <h3 className="text-sm font-medium text-gray-300">Pricing Lines ({pricing.lines.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">#</th>
                      <th className="text-left px-4 py-2 font-medium">SKU</th>
                      <th className="text-left px-4 py-2 font-medium">Type</th>
                      <th className="text-left px-4 py-2 font-medium">Qty</th>
                      <th className="text-left px-4 py-2 font-medium">Unit Cost</th>
                      <th className="text-left px-4 py-2 font-medium">Ext. Cost</th>
                      <th className="text-left px-4 py-2 font-medium">Landed</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vulpine-border">
                    {pricing.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-vulpine-panel/50">
                        <td className="px-4 py-2 text-gray-400">{l.line_number}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{l.sku_code || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{l.cabinet_type || "—"}</td>
                        <td className="px-4 py-2 text-gray-400">{l.quantity}</td>
                        <td className="px-4 py-2 text-gray-400">{l.unit_cost ? `$${l.unit_cost.toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-2 text-gray-400">${l.extended_product_cost.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-300">${l.line_landed_cost.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          {l.is_blocked ? (
                            <span className="text-red-400 text-xs">⚠ Blocked</span>
                          ) : l.has_cost ? (
                            <span className="text-green-500 text-xs">✓ Cost</span>
                          ) : (
                            <span className="text-red-400 text-xs">No cost</span>
                          )}
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

function Big({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-vulpine-orange/50 bg-vulpine-orange/5" : "border-vulpine-border bg-vulpine-panel/50"}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || (highlight ? "text-vulpine-orange" : "text-gray-100")}`}>{value}</div>
    </div>
  );
}

function CostRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? "text-gray-200 font-medium" : "text-gray-500"}>{label}</span>
      <span className={bold ? "text-vulpine-orange font-semibold" : "text-gray-400"}>
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function Detail({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${good ? "text-green-400" : bad ? "text-red-400" : "text-gray-200"}`}>{value}</div>
    </div>
  );
}