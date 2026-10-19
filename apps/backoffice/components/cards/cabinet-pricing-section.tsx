"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export function CabinetPricingSection() {
  const [attempt, setAttempt] = useState(0)
  const [connection, setConnection] = useState<"loading" | "ready" | "error">("loading")
  const [message, setMessage] = useState("")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setConnection("loading")
    setLoaded(false)
    async function connect() {
      try {
        const response = await fetch("/api/cabinet-pricing/health", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
        if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Sign in again to continue." : "Pricing is temporarily unavailable. Your saved quotes are retained.")
        const health = await response.json()
        if (health.status !== "ok") throw new Error("Pricing is temporarily unavailable. Your saved quotes are retained.")
        if (!controller.signal.aborted) setConnection("ready")
      } catch (error) {
        if (controller.signal.aborted) return
        setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Pricing took too long to respond. Please retry.")
        setConnection("error")
      }
    }
    void connect()
    return () => controller.abort()
  }, [attempt])

  return <section className="flex min-h-[80dvh] flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">Cabinet pricing &amp; quotes</h1>
      <a className="text-sm underline" href="/api/cabinet-pricing/index.html" target="_blank" rel="noopener noreferrer">Open full screen</a>
    </div>
    {connection === "error" ? <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p>{message}</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 min-h-11 rounded-lg border border-border px-4 font-semibold">Retry pricing</button>
      <Link href="/api/auth/signin?callbackUrl=/bids/pricing" prefetch={false} className="ml-4 inline-flex min-h-11 items-center underline">Sign in again</Link>
    </div> : <>
      {connection === "loading" || !loaded ? <p role="status" className="text-sm text-muted-foreground">Opening your saved quotes and pricing workspace…</p> : null}
      {connection === "ready" ? <iframe key={attempt} src="/api/cabinet-pricing/index.html" title="Cabinet pricing workspace" onLoad={() => setLoaded(true)} onError={() => { setMessage("The pricing workspace could not open. Please retry."); setConnection("error") }} className="h-[calc(100dvh-12rem)] min-h-[650px] w-full rounded-xl border border-border bg-background" /> : null}
    </>}
  </section>
}
