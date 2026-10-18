"use client";

import { signOut, useSession } from "next-auth/react";

export default function SessionActions() {
  const { data: session } = useSession();
  const label = session?.user?.email || session?.user?.name || "Signed in";

  return (
    <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-stone-300 sm:flex">
      <span className="max-w-44 truncate">{label}</span>
      <button
        type="button"
        onClick={() => void signOut({ callbackUrl: "/" })}
        className="rounded-full bg-white/10 px-3 py-1 font-semibold text-stone-100 transition hover:bg-vulpine-orange hover:text-black"
      >
        Sign out
      </button>
    </div>
  );
}
