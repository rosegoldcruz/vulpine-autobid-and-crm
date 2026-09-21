"use client";

import { useState, useEffect } from "react";
import { api, ExceptionsResponse } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, AlertTriangle, Check, X } from "lucide-react";

export default function ExceptionsPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<ExceptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const d = await api.getExceptions(params.id);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resolve = async (exceptionId: string, type: string) => {
    setResolving(exceptionId);
    try {
      await api.resolveException(params.id, exceptionId, type === "approve" ? "Approved by reviewer" : "Rejected by reviewer", type === "approve" ? "approved" : "rejected");
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  const exceptions = data?.exceptions || [];
  const open = exceptions.filter((e) => e.status === "OPEN" || e.status === "IN_REVIEW");
  const resolved = exceptions.filter((e) => e.status === "RESOLVED");

  const severityColor: Record<string, string> = {
    BLOCKER: "text-red-400 bg-red-900/30 border-red-800",
    WARNING: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
    INFO: "text-blue-400 bg-blue-900/30 border-blue-800",
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-1">Exception Review Queue</h2>
      <p className="text-sm text-gray-500 mb-6">Review and resolve unmatched items</p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {exceptions.length === 0 ? (
        <EmptyState
          title="No exceptions"
          message="No exceptions have been generated. Run SKU mapping to identify unmatched items."
        />
      ) : (
        <div className="space-y-6">
          {/* Open exceptions */}
          {open.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Open ({open.length})</h3>
              <div className="space-y-3">
                {open.map((exc) => (
                  <div key={exc.id} className={`rounded-lg border p-4 ${severityColor[exc.severity] || severityColor.INFO}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium uppercase">{exc.severity}</span>
                          <span className="text-xs opacity-60">{exc.exception_type}</span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-200">{exc.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{exc.description}</p>
                        {exc.cabinet_type && (
                          <p className="text-xs text-gray-500 mt-2">Cabinet type: {exc.cabinet_type}</p>
                        )}
                        {exc.required_dimensions && (
                          <p className="text-xs text-gray-500">
                            Dimensions: {exc.required_dimensions.width || "?"} × {exc.required_dimensions.height || "?"} × {exc.required_dimensions.depth || "?"}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => resolve(exc.id, "approve")}
                          disabled={resolving === exc.id}
                          className="inline-flex items-center gap-1 rounded border border-green-700 text-green-400 px-3 py-1.5 text-xs hover:bg-green-900/20 disabled:opacity-50"
                        >
                          {resolving === exc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Approve
                        </button>
                        <button
                          onClick={() => resolve(exc.id, "reject")}
                          disabled={resolving === exc.id}
                          className="inline-flex items-center gap-1 rounded border border-red-700 text-red-400 px-3 py-1.5 text-xs hover:bg-red-900/20 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved exceptions */}
          {resolved.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Resolved ({resolved.length})</h3>
              <div className="space-y-2">
                {resolved.map((exc) => (
                  <div key={exc.id} className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-3 opacity-60">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-400">{exc.title}</span>
                      <span className="text-xs text-gray-600 ml-auto">
                        Resolved by {exc.resolved_by} · {exc.resolution_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}