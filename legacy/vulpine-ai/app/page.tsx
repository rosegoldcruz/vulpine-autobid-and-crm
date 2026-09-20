import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";
import { api, Project, StatsResponse } from "@/lib/api";
import Link from "next/link";
import { Plus, FolderKanban, Boxes, AlertCircle } from "lucide-react";

async function getData() {
  try {
    const [stats, projects] = await Promise.all([api.getStats(), api.listProjects()]);
    return { stats, projects, error: null };
  } catch (e: any) {
    return { stats: null, projects: null, error: e.message };
  }
}

const statusColors: Record<string, string> = {
  CREATED: "text-gray-400 bg-gray-800/50",
  WAITING_FOR_DOCUMENTS: "text-blue-400 bg-blue-900/30",
  PREFLIGHT: "text-cyan-400 bg-cyan-900/30",
  EXTRACTING: "text-cyan-400 bg-cyan-900/30",
  BOM_GENERATED: "text-indigo-400 bg-indigo-900/30",
  SKU_MAPPING: "text-purple-400 bg-purple-900/30",
  EXCEPTIONS_REVIEW: "text-yellow-400 bg-yellow-900/30",
  PRICING: "text-orange-400 bg-orange-900/30",
  QA: "text-vulpine-orange bg-vulpine-orange/10",
  PROPOSAL_GENERATED: "text-green-400 bg-green-900/30",
  COMPLETE: "text-green-400 bg-green-900/30",
  FAILED: "text-red-400 bg-red-900/30",
};

export default async function DashboardPage() {
  const { stats, projects, error } = await getData();

  return (
    <div>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Vulpine Autonomous Cabinet Revenue Engine</p>
          </div>
          <CreateProjectButton />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            Backend connection error: {error}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Projects"
            value={stats?.total_projects ?? 0}
            icon={<FolderKanban className="w-5 h-5" />}
          />
          <StatCard
            label="Open Exceptions"
            value={stats?.open_exceptions ?? 0}
            icon={<AlertCircle className="w-5 h-5" />}
            alert={!!stats?.open_exceptions}
          />
          <StatCard
            label="SKU Catalog"
            value={stats?.total_skus ?? 0}
            icon={<Boxes className="w-5 h-5" />}
          />
          <StatCard
            label="Active Bids"
            value={stats ? Object.values(stats.by_status).filter((s) => s > 0).length : 0}
            icon={<FolderKanban className="w-5 h-5" />}
          />
        </div>

        {/* Projects list */}
        <div className="rounded-xl border border-vulpine-border bg-vulpine-panel/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-vulpine-border">
            <h2 className="font-semibold text-gray-200">Projects</h2>
          </div>
          {!projects || projects.count === 0 ? (
            <EmptyState
              title="No projects yet"
              message="Create one to start bidding."
              action={<CreateProjectButton />}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-vulpine-ink/50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Name</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="text-left px-6 py-3 font-medium">Stage</th>
                  <th className="text-left px-6 py-3 font-medium">Progress</th>
                  <th className="text-left px-6 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vulpine-border">
                {projects.projects.map((p: Project) => (
                  <tr key={p.id} className="hover:bg-vulpine-panel transition-colors cursor-pointer" onClick={() => window.location.href = `/projects/${p.id}`}>
                    <td className="px-6 py-4">
                      <Link href={`/projects/${p.id}`} className="text-gray-200 hover:text-vulpine-orange">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[p.status] || "text-gray-400 bg-gray-800/50"}`}>
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{p.current_stage}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-vulpine-dim rounded-full overflow-hidden">
                          <div
                            className="h-full bg-vulpine-orange rounded-full"
                            style={{ width: `${p.stage_progress.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{p.stage_progress.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, alert }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <div className={`rounded-xl border bg-vulpine-panel/50 p-4 ${alert ? "border-red-800" : "border-vulpine-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={alert ? "text-red-400" : "text-vulpine-muted"}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${alert ? "text-red-400" : "text-gray-100"}`}>{value}</div>
    </div>
  );
}

function CreateProjectButton() {
  return (
    <form action="/api/projects/create" method="POST" className="inline-block">
      <input
        type="text"
        name="name"
        placeholder="Project name..."
        required
        className="mr-2 rounded-lg bg-vulpine-panel border border-vulpine-border px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-vulpine-orange"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg bg-vulpine-orange px-4 py-2 text-sm font-medium text-white hover:bg-vulpine-orange/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create Project
      </button>
    </form>
  );
}