'use client';

import { FolderKanban, Gauge, Settings, ShieldCheck } from 'lucide-react';

const items = [
  { label: 'Projects', icon: FolderKanban },
  { label: 'Pipeline', icon: Gauge },
  { label: 'Review Queue', icon: ShieldCheck },
  { label: 'Settings', icon: Settings },
];

export function WorkspaceNav({ active = 'Projects', onChange }: { active?: string; onChange?: (label: string) => void }) {
  return (
    <aside className="workspace-nav" aria-label="Cabinet Brain navigation">
      <div className="brand-lockup">
        <div className="brand-mark">V</div>
        <div><strong>Vulpine</strong><span>Cabinet Brain</span></div>
      </div>
      <nav>
        {items.map(({ label, icon: Icon }) => (
          <button aria-label={label} className={active === label ? 'nav-item is-active' : 'nav-item'} key={label} type="button" onClick={() => onChange?.(label)}>
            <Icon size={17} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-foot"><span className="avatar">BO</span><div><strong>Backoffice session</strong><span>Server-authoritative workspace</span></div></div>
    </aside>
  );
}
