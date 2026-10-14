"use client"

export function CabinetPricingSection() {
  return <section className="flex min-h-[80dvh] flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">Cabinet pricing &amp; quotes</h1>
      <a className="text-sm underline" href="/api/cabinet-pricing/index.html" target="_blank" rel="noopener noreferrer">Open full screen</a>
    </div>
    <p className="text-sm text-muted-foreground">Build your units, choose finishes, and export your quote in the full-screen workspace.</p>
  </section>
}
