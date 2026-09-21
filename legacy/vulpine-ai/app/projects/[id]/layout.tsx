import { Header } from "@/components/Header";
import { WorkflowSidebar } from "@/components/WorkflowSidebar";
import { api } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  let project = null;
  let error = null;
  try {
    project = await api.getProject(params.id);
  } catch (e: any) {
    error = e.message;
  }

  if (error || !project) {
    return (
      <div>
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-vulpine-orange mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error || "Project not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="flex">
        <WorkflowSidebar
          projectId={params.id}
          currentStage={project.current_stage}
          stageProgress={project.stage_progress}
        />
        <div className="flex-1 min-w-0">
          <div className="border-b border-vulpine-border bg-vulpine-ink/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-500 hover:text-vulpine-orange">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-lg font-semibold text-gray-100 truncate">{project.name}</h1>
              <span className="text-xs text-gray-600 px-2 py-0.5 rounded bg-vulpine-panel border border-vulpine-border">
                {project.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}