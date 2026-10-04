import Link from "next/link"

export default function AccessDeniedPage() {
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6"><p className="font-mono text-sm text-primary">VULPINE / ACCESS CONTROL</p><h1 className="font-display text-3xl font-bold">Access required</h1><p className="text-sm leading-relaxed text-muted-foreground">Your session does not have the capability required for this workspace. Ask your administrator to review your existing ZITADEL project role.</p><Link href="/" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-bold text-primary-foreground">Return to Command Center</Link></main>
}
