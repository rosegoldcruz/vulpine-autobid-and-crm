"use client";

import { useState, useEffect } from "react";
import { api, ProjectListResponse, AuditResponse } from "@/lib/api";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, ScrollText, ChevronDown } from "lucide-react";

export default function AuditLogPage() {
  const [projects, setProjects] = useState<ProjectListResponse | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    api.listProjects().then((d) => {
      setProjects(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setAuditLoading(true);
      api.getAuditTrail(selectedProject).then((d) => {
        setAudit(d);
        setAuditLoading(false);
      }).catch(() => setAuditLoading(false));
    }
  }, [selectedProject]);

  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Audit Log</h1>
        <p className="text-sm text-gray-500 mb-6">Complete audit trail of all actions</p>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
        ) : !projects || projects.count === 0 ? (
          <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50">
            <EmptyState
              title="No audit events"
              message="Create a project to start generating audit events."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Project selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Project:</label>
              <select
                value={selectedProject || ""}
                onChange={(e) => setSelectedProject(e.target.value || null)}
                className="rounded-lg bg-vulpine-panel border border-vulpine-border px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-vulpine-orange"
              >
                <option value="">Select a project...</option>
                {projects.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Audit events */}
            {!selectedProject ? (
              <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50">
                <EmptyState
                  title="Select a project"
                  message="Choose a project above to view its audit trail."
                />
              </div>
            ) : auditLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading audit trail...</div>
            ) : !audit || audit.count === 0 ? (
              <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50">
                <EmptyState
                  title="No audit events"
                  message="No actions have been recorded for this project yet."
                />
              </div>
            ) : (
              <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-vulpine-border">
                  <span className="text-sm font-medium text-gray-300">{audit.count} Events</span>
                </div>
                <div className="divide-y divide-vulpine-border">
                  {audit.events.map((e) => (
                    <div key={e.id} className="px-4 py-3 flex items-start gap-4">
                      <div className="text-xs text-gray-600 w-32 flex-shrink-0">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-vulpine-orange uppercase">{e.action}</span>
                          <span className="text-xs text-gray-600">{e.entity_type}</span>
                          <span className="text-xs text-gray-600">by {e.actor}</span>
                        </div>
                        {e.reason && <p className="text-xs text-gray-500 mt-0.5">{e.reason}</p>}
                        {e.new_values && Object.keys(e.new_values).length > 0 && (
                          <div className="text-xs text-gray-600 mt-1 font-mono">
                            {JSON.stringify(e.new_values)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}