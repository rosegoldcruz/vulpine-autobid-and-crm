import { api } from "@/lib/api";
import Link from "next/link";
import { FileUp, ScanSearch, ScanText, ListTree, Boxes, AlertTriangle, DollarSign, ShieldCheck, FileText, ArrowRight } from "lucide-react";

const stages = [
  { key: "UPLOAD", label: "Upload", desc: "Upload plan documents", icon: FileUp, path: "upload" },
  { key: "PREFLIGHT", label: "Preflight", desc: "Analyze documents", icon: ScanSearch, path: "preflight" },
  { key: "EXTRACT", label: "Extraction", desc: "Extract cabinet requirements", icon: ScanText, path: "extract" },
  { key: "BOM", label: "BOM", desc: "Generate bill of materials", icon: ListTree, path: "bom" },
  { key: "SKU_MAP", label: "SKU Mapping", desc: "Match to SKU catalog", icon: Boxes, path: "sku-map" },
  { key: "EXCEPTIONS", label: "Exceptions", desc: "Review and resolve", icon: AlertTriangle, path: "exceptions" },
  { key: "PRICE", label: "Pricing", desc: "Cost and margin analysis", icon: DollarSign, path: "pricing" },
  { key: "QA", label: "QA", desc: "Quality assurance checks", icon: ShieldCheck, path: "qa" },
  { key: "PROPOSAL", label: "Proposal", desc: "Generate proposal", icon: FileText, path: "proposal" },
];

export default async function ProjectHome({ params }: { params: { id: string } }) {
  let project = null;
  try {
    project = await api.getProject(params.id);
  } catch (e) {}

  const counts = project?.counts || {};

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-1">Workflow Overview</h2>
      <p className="text-sm text-gray-500 mb-6">
        Current stage: <span className="text-vulpine-orange">{project?.current_stage}</span> —
        {" "}{project?.stage_progress.progress_percent}% complete
      </p>

      <div className="grid grid-cols-3 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isCurrent = project?.current_stage === stage.key;
          const idx = project?.stage_progress.all_stages.indexOf(stage.key) ?? -1;
          const currentIdx = project?.stage_progress.current_index ?? 0;
          const isComplete = idx >= 0 && idx < currentIdx;
          return (
            <Link
              key={stage.key}
              href={`/projects/${params.id}/${stage.path}`}
              className={`rounded-xl border p-4 transition-all hover:border-vulpine-orange/50 ${
                isCurrent
                  ? "border-vulpine-orange/50 bg-vulpine-orange/5"
                  : "border-vulpine-border bg-vulpine-panel/50 hover:bg-vulpine-panel"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isCurrent ? "bg-vulpine-orange/20 text-vulpine-orange" :
                  isComplete ? "bg-green-900/20 text-green-500" :
                  "bg-vulpine-ink text-vulpine-muted"
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                {isComplete && <span className="text-green-600 text-xs">✓ Done</span>}
                {isCurrent && <span className="text-vulpine-orange text-xs">Active</span>}
              </div>
              <h3 className="font-medium text-gray-200 text-sm">{stage.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{stage.desc}</p>
            </Link>
          );
        })}
      </div>

      {/* Counts summary */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Data Summary</h3>
        <div className="grid grid-cols-5 gap-3">
          <CountBox label="Documents" value={counts.document_pages ?? 0} />
          <CountBox label="Evidence" value={counts.evidence ?? 0} />
          <CountBox label="Requirements" value={counts.cabinet_requirements ?? 0} />
          <CountBox label="BOM Versions" value={counts.bom_versions ?? 0} />
          <CountBox label="Exceptions" value={counts.exceptions ?? 0} />
          <CountBox label="Pricing" value={counts.pricing_versions ?? 0} />
          <CountBox label="QA Runs" value={counts.qa_runs ?? 0} />
          <CountBox label="Proposals" value={counts.proposal_versions ?? 0} />
          <CountBox label="VE Decisions" value={counts.ve_decisions ?? 0} />
          <CountBox label="Audit Events" value={counts.audit_events ?? 0} />
        </div>
      </div>
    </div>
  );
}

function CountBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-vulpine-border bg-vulpine-panel/30 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-200 mt-1">{value}</div>
    </div>
  );
}