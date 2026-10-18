"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/skus", label: "SKU Catalog", icon: "box" },
  { href: "/audit", label: "Audit Log", icon: "scroll" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-vulpine-border bg-vulpine-ink/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-vulpine-orange font-bold text-lg">Vulpine</span>
          <span className="text-gray-500 text-sm">Auto Bidder</span>
        </Link>
        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  active ? "text-vulpine-orange" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}