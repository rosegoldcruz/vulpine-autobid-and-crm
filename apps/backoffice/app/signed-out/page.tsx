import Link from "next/link"

export default function SignedOutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="surface-card w-full max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Signed out</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your Backoffice session has been closed.</p>
        <Link
          href="/api/auth/signin?callbackUrl=/"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign in again
        </Link>
      </section>
    </main>
  )
}
