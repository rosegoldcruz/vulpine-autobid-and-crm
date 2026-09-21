import Link from "next/link";
import { StageProgress } from "@/lib/api";

const stageLabels: Record<string, string> = {
  UPLOAD: "Upload",
  PREFLIGHT: "Preflight",
  EXTRACT: "Extract",
  BOM: "BOM",
  SKU_MAP: "SKU Map",
  EXCEPTIONS: "Exceptions",
  PRICE: "Pricing",
  QA: "QA",
  PROPOSAL: "Proposal",
};

const stageIcons: Record<string, string> = {
  UPLOAD: "file-up",
  PREFLIGHT: "scan-search",
  EXTRACT: "scan-text",
  BOM: "list-tree",
  SKU_MAP: "boxes",
  EXCEPTIONS: "alert-triangle",
  PRICE: "dollar-sign",
  QA: "shield-check",
  PROPOSAL: "file-text",
};

interface WorkflowSidebarProps {
  projectId: string;
  currentStage: string;
  stageProgress: StageProgress;
}

export function WorkflowSidebar({ projectId, currentStage, stageProgress }: WorkflowSidebarProps) {
  const stages = stageProgress.all_stages;
  const currentIndex = stageProgress.current_index;

  return (
    <aside className="w-64 border-r border-vulpine-border bg-vulpine-ink min-h-[calc(100vh-3.5rem)] flex-shrink-0">
      <div className="p-4 border-b border-vulpine-border">
        <div className="text-xs text-gray-500 mb-1">Workflow Progress</div>
        <div className="text-2xl font-bold text-vulpine-orange">
          {stageProgress.progress_percent}%
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {stageProgress.completed_stages} of {stageProgress.total_stages} stages
        </div>
      </div>
      <nav className="py-2">
        {stages.map((stage, idx) => {
          const isCurrent = stage === currentStage;
          const isComplete = idx < currentIndex;
          const href = stageRoutes[stage]
            ? `/projects/${projectId}${stageRoutes[stage]}`
            : `/projects/${projectId}`;
          return (
            <Link
              key={stage}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2 ${
                isCurrent
                  ? "border-vulpine-orange bg-vulpine-orange/10 text-vulpine-orange"
                  : isComplete
                    ? "border-transparent text-gray-400 hover:bg-vulpine-panel/50"
                    : "border-transparent text-gray-600 hover:bg-vulpine-panel/30"
              }`}
            >
              <span className={`w-5 text-center ${isComplete ? "text-green-600" : ""}`}>
                {isComplete ? "✓" : idx + 1}
              </span>
              {stageLabels[stage] || stage}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

const stageRoutes: Record<string, string> = {
  UPLOAD: "/upload",
  PREFLIGHT: "/preflight",
  EXTRACT: "/extract",
  BOM: "/bom",
  SKU_MAP: "/sku-map",
  EXCEPTIONS: "/exceptions",
  PRICE: "/pricing",
  QA: "/qa",
  PROPOSAL: "/proposal",
};