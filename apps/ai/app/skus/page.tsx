"use client";

import { useState, useEffect } from "react";
import { api, SKUCatalogResponse } from "@/lib/api";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Search, Plus, Boxes } from "lucide-react";

export default function SKUCatalogPage() {
  const [data, setData] = useState<SKUCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSKU, setNewSKU] = useState({
    sku_code: "",
    manufacturer: "",
    cabinet_type: "",
    width: "",
    height: "",
    depth: "",
    finish: "",
    unit_cost: "",
  });

  const loadData = async () => {
    try {
      const d = await api.listSKUs(search);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [search]);

  const addSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSKU({
        sku_code: newSKU.sku_code,
        manufacturer: newSKU.manufacturer || undefined,
        cabinet_type: newSKU.cabinet_type || undefined,
        width: newSKU.width ? parseFloat(newSKU.width) : undefined,
        height: newSKU.height ? parseFloat(newSKU.height) : undefined,
        depth: newSKU.depth ? parseFloat(newSKU.depth) : undefined,
        finish: newSKU.finish || undefined,
        unit_cost: newSKU.unit_cost ? parseFloat(newSKU.unit_cost) : undefined,
      });
      setNewSKU({ sku_code: "", manufacturer: "", cabinet_type: "", width: "", height: "", depth: "", finish: "", unit_cost: "" });
      setShowAdd(false);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">SKU Catalog</h1>
            <p className="text-sm text-gray-500 mt-1">Manage the SKU catalog for BOM mapping</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90"
          >
            <Plus className="w-4 h-4" />
            Add SKU
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <form onSubmit={addSKU} className="mb-6 rounded-xl border border-vulpine-border bg-vulpine-panel/50 p-6">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Add New SKU</h3>
            <div className="grid grid-cols-4 gap-3">
              <Input label="SKU Code *" value={newSKU.sku_code} onChange={(v) => setNewSKU({ ...newSKU, sku_code: v })} required />
              <Input label="Manufacturer" value={newSKU.manufacturer} onChange={(v) => setNewSKU({ ...newSKU, manufacturer: v })} />
              <Input label="Cabinet Type" value={newSKU.cabinet_type} onChange={(v) => setNewSKU({ ...newSKU, cabinet_type: v })} />
              <Input label="Finish" value={newSKU.finish} onChange={(v) => setNewSKU({ ...newSKU, finish: v })} />
              <Input label="Width (in)" value={newSKU.width} onChange={(v) => setNewSKU({ ...newSKU, width: v })} type="number" />
              <Input label="Height (in)" value={newSKU.height} onChange={(v) => setNewSKU({ ...newSKU, height: v })} type="number" />
              <Input label="Depth (in)" value={newSKU.depth} onChange={(v) => setNewSKU({ ...newSKU, depth: v })} type="number" />
              <Input label="Unit Cost ($)" value={newSKU.unit_cost} onChange={(v) => setNewSKU({ ...newSKU, unit_cost: v })} type="number" />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90">
                Save SKU
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-vulpine-border px-4 py-2 text-sm text-gray-400 hover:bg-vulpine-panel">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            placeholder="Search by SKU code, manufacturer, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-vulpine-panel border border-vulpine-border pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-vulpine-orange"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
        ) : !data || data.count === 0 ? (
          <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50">
            <EmptyState
              title="No SKU catalog imported"
              message="Add SKUs to the catalog to enable mapping."
              action={
                <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90">
                  <Plus className="w-4 h-4" /> Add First SKU
                </button>
              }
            />
          </div>
        ) : (
          <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">SKU Code</th>
                  <th className="text-left px-4 py-3 font-medium">Manufacturer</th>
                  <th className="text-left px-4 py-3 font-medium">Cabinet Type</th>
                  <th className="text-left px-4 py-3 font-medium">Dimensions</th>
                  <th className="text-left px-4 py-3 font-medium">Finish</th>
                  <th className="text-left px-4 py-3 font-medium">Unit Cost</th>
                  <th className="text-left px-4 py-3 font-medium">Lead Time</th>
                  <th className="text-left px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vulpine-border">
                {data.skus.map((s) => (
                  <tr key={s.id} className="hover:bg-vulpine-panel">
                    <td className="px-4 py-3 text-gray-200 font-mono text-xs">{s.sku_code}</td>
                    <td className="px-4 py-3 text-gray-400">{s.manufacturer || "—"}</td>
                    <td className="px-4 py-3 text-gray-400">{s.cabinet_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {s.width || "?"}×{s.height || "?"}×{s.depth || "?"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.finish || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{s.unit_cost ? `$${s.unit_cost.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.lead_time_days ? `${s.lead_time_days}d` : "—"}</td>
                    <td className="px-4 py-3">
                      {s.is_active ? <span className="text-green-500 text-xs">Active</span> : <span className="text-gray-600 text-xs">Inactive</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-lg bg-vulpine-ink border border-vulpine-border px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-vulpine-orange"
      />
    </div>
  );
}