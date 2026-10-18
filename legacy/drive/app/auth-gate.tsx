import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { authConfigured, authOptions } from "@/lib/auth";

export default async function AuthGate({ children }: { children: ReactNode }): Promise<ReactElement> {
  if (!authConfigured()) {
    return (
      <main className="noise flex min-h-screen items-center justify-center px-4 text-stone-100">
        <section className="w-full max-w-lg rounded-lg border border-red-400/30 bg-red-950/30 p-6">
          <p className="text-sm font-semibold text-vulpine-brass">Vulpine Drive</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Zitadel Auth Is Not Configured</h1>
          <p className="mt-3 text-sm leading-6 text-red-100">
            Set ZITADEL_ISSUER, ZITADEL_CLIENT_ID, NEXTAUTH_SECRET, and NEXTAUTH_URL in the server environment.
          </p>
        </section>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/");
  }

  return <>{children}</>;
}
