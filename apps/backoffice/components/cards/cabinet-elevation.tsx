"use client"

import type { CabinetFinding } from "./cabinet-brain-data"

type CabinetElevationProps = {
  finding: CabinetFinding
  showEvidence: boolean
  showDimensions: boolean
  showSkus: boolean
  showExceptions: boolean
  zoom: number
  onSelectFinding: (id: string) => void
}

const cabinets = [
  { x: 80, y: 116, w: 116, h: 118, id: "wall-left" },
  { x: 205, y: 116, w: 86, h: 118, id: "wall-small" },
  { x: 392, y: 116, w: 98, h: 118, id: "wall-center" },
  { x: 645, y: 116, w: 92, h: 118, id: "wall-right" },
  { x: 82, y: 276, w: 112, h: 102, id: "base-left" },
  { x: 205, y: 276, w: 84, h: 102, id: "drawer-base" },
  { x: 299, y: 276, w: 96, h: 102, id: "sink-base-33" },
  { x: 405, y: 276, w: 96, h: 102, id: "base-center" },
  { x: 610, y: 276, w: 105, h: 102, id: "base-right" },
  { x: 751, y: 116, w: 92, h: 262, id: "millwork-panel" },
]

export function CabinetElevation({ finding, showEvidence, showDimensions, showSkus, showExceptions, zoom, onSelectFinding }: CabinetElevationProps) {
  return (
    <div className="relative h-full min-h-[390px] overflow-auto bg-[#f6f7f6] lg:min-h-0">
      <div className="min-h-full min-w-[860px] origin-top-left transition-transform duration-200" style={{ transform: `scale(${zoom / 100})`, width: `${10000 / zoom}%` }}>
        <svg viewBox="0 0 920 520" role="img" aria-label="Clubhouse kitchen architectural elevation with detected cabinet overlays" className="h-auto w-full select-none bg-[#f7f8f7] text-slate-950">
          <defs>
            <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#d8dddc" strokeWidth="0.5" /></pattern>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#b8c0be" strokeWidth="1" /></pattern>
          </defs>
          <rect width="920" height="520" fill="#fafbf9" />
          <rect x="58" y="94" width="806" height="305" fill="url(#grid)" opacity="0.35" />
          <text x="62" y="42" fontSize="24" fontWeight="800" fill="#111827">CLUBHOUSE KITCHEN</text>
          <text x="62" y="64" fontSize="12" fontWeight="700" fill="#334155">INTERIOR ELEVATION — NORTH</text>
          <text x="62" y="80" fontSize="10" fill="#475569">1/2&quot; = 1&apos;-0&quot;</text>
          <text x="826" y="53" fontSize="28" fontWeight="800" fill="#111827">A501</text>

          <line x1="58" y1="398" x2="864" y2="398" stroke="#0f172a" strokeWidth="2" />
          <line x1="58" y1="94" x2="58" y2="398" stroke="#0f172a" />
          <line x1="864" y1="94" x2="864" y2="398" stroke="#0f172a" />
          <rect x="58" y="92" width="806" height="12" fill="url(#hatch)" stroke="#0f172a" />

          <rect x="68" y="116" width="110" height="262" fill="#eef1ef" stroke="#111827" strokeWidth="1.5" />
          <line x1="80" y1="190" x2="165" y2="190" stroke="#64748b" />
          <line x1="123" y1="116" x2="123" y2="378" stroke="#64748b" />
          <text x="98" y="252" fontSize="13" fontWeight="800" fill="#475569">REF</text>

          {cabinets.map((cabinet) => {
            const selected = cabinet.id === finding.id
            const custom = cabinet.id === "millwork-panel"
            const visible = !custom || showExceptions
            return (
              <g key={cabinet.id} onClick={() => onSelectFinding(cabinet.id)} className={cabinet.id === "sink-base-33" || custom ? "cursor-pointer" : ""} opacity={visible ? 1 : 0.35}>
                <rect x={cabinet.x} y={cabinet.y} width={cabinet.w} height={cabinet.h} fill="none" stroke="#334155" strokeWidth="1.4" />
                <line x1={cabinet.x} y1={cabinet.y} x2={cabinet.x + cabinet.w} y2={cabinet.y + cabinet.h} stroke="#94a3b8" strokeDasharray="4 5" />
                <line x1={cabinet.x + cabinet.w} y1={cabinet.y} x2={cabinet.x} y2={cabinet.y + cabinet.h} stroke="#94a3b8" strokeDasharray="4 5" />
                {showEvidence ? <rect x={cabinet.x + 2} y={cabinet.y + 2} width={cabinet.w - 4} height={cabinet.h - 4} fill="none" stroke={custom ? "#f59e0b" : selected ? "#2563eb" : "#0fbaa8"} strokeWidth={selected ? 4 : 2.5} /> : null}
              </g>
            )
          })}

          <rect x="299" y="276" width="96" height="102" fill="#dbeafe" opacity="0.5" />
          <path d="M320 276 V318 C320 340 374 340 374 318 V276" fill="none" stroke="#475569" strokeWidth="2" />
          <path d="M346 275 V250 C346 236 366 236 366 250 V260" fill="none" stroke="#475569" strokeWidth="3" />

          <rect x="505" y="278" width="95" height="100" fill="#e7e9e8" stroke="#111827" />
          <rect x="515" y="294" width="75" height="52" fill="none" stroke="#64748b" />
          <circle cx="524" cy="286" r="4" fill="none" stroke="#111827" /><circle cx="542" cy="286" r="4" fill="none" stroke="#111827" /><circle cx="560" cy="286" r="4" fill="none" stroke="#111827" /><circle cx="578" cy="286" r="4" fill="none" stroke="#111827" />
          <path d="M515 224 L548 174 L581 224 Z" fill="url(#hatch)" stroke="#111827" />

          {showDimensions ? (
            <g>
              <line x1="299" y1="261" x2="395" y2="261" stroke="#2563eb" strokeWidth="2" />
              <path d="M299 255 V267 M395 255 V267" stroke="#2563eb" strokeWidth="2" />
              <text x="328" y="251" fontSize="13" fontWeight="800" fill="#1d4ed8">32.96&quot;</text>
              {[120, 248, 347, 453, 553, 665, 797].map((x, index) => <text key={x} x={x} y="420" textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">{[36, 30, 33, 36, 30, 30, 30][index]}&quot;</text>)}
            </g>
          ) : null}

          {showSkus ? (
            <g>
              <rect x="329" y="382" width="38" height="20" rx="3" fill="#2563eb" />
              <text x="348" y="396" textAnchor="middle" fontSize="11" fontWeight="900" fill="white">SB33</text>
              <text x="348" y="412" textAnchor="middle" fontSize="9" fontWeight="800" fill="#334155">SINK BASE</text>
            </g>
          ) : null}

          {showExceptions ? (
            <g>
              <rect x="778" y="382" width="55" height="20" rx="3" fill="#f59e0b" />
              <text x="805" y="396" textAnchor="middle" fontSize="10" fontWeight="900" fill="#1f2937">CUSTOM</text>
              <text x="751" y="420" fontSize="9" fontWeight="800" fill="#475569">VERIFY IN FIELD</text>
            </g>
          ) : null}

          <circle cx="79" cy="466" r="20" fill="none" stroke="#111827" strokeWidth="2" /><text x="79" y="472" textAnchor="middle" fontSize="18" fontWeight="800">1</text>
          <text x="112" y="462" fontSize="15" fontWeight="800" fill="#111827">CLUBHOUSE KITCHEN — NORTH ELEVATION</text>
          <line x1="112" y1="468" x2="540" y2="468" stroke="#111827" />
          <text x="112" y="484" fontSize="11" fontWeight="700" fill="#334155">1/2&quot; = 1&apos;-0&quot;</text>
        </svg>
      </div>
    </div>
  )
}
