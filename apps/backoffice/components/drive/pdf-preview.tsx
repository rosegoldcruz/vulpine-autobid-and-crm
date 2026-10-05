'use client'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

export default function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined
    void import('pdfjs-dist').then(pdf => {
      if (cancelled) return
      pdf.GlobalWorkerOptions.workerSrc = '/viewers/pdf/pdf.worker.min.mjs'
      task = pdf.getDocument({ url, cMapUrl: '/viewers/pdf/cmaps/', cMapPacked: true, standardFontDataUrl: '/viewers/pdf/standard_fonts/', wasmUrl: '/viewers/pdf/wasm/', disableAutoFetch: true, rangeChunkSize: 262144 })
      return task.promise
    }).then(doc => { if (doc && !cancelled) { setDocument(doc); setPage(1) } })
      .catch(caught => { if (!cancelled) { setError(caught instanceof Error ? caught.message : 'Unable to read PDF'); setLoading(false) } })
    return () => { cancelled = true; void task?.destroy() }
  }, [url])
  useEffect(() => {
    if (!document || !canvas.current) return
    let cancelled = false
    let render: RenderTask | undefined
    setLoading(true)
    void document.getPage(page).then(async pdfPage => {
      if (cancelled || !canvas.current) return
      const natural = pdfPage.getViewport({ scale: 1 })
      const width = Math.max(240, (container.current?.clientWidth || 640) - 24)
      const viewport = pdfPage.getViewport({ scale: width / natural.width * zoom })
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const target = canvas.current
      target.width = Math.floor(viewport.width * ratio)
      target.height = Math.floor(viewport.height * ratio)
      target.style.width = `${viewport.width}px`
      target.style.height = `${viewport.height}px`
      const context = target.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      render = pdfPage.render({ canvas: target, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
      await render.promise
      if (!cancelled) setLoading(false)
    }).catch(caught => { if (!cancelled) { setError(caught instanceof Error ? caught.message : 'Unable to render page'); setLoading(false) } })
    return () => { cancelled = true; render?.cancel() }
  }, [document, page, zoom])
  return <div className="rounded-xl border border-border/60 bg-muted/20">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 p-2 text-xs">
      <div className="flex items-center gap-2"><button type="button" aria-label="Previous PDF page" disabled={!document || page === 1} onClick={() => setPage(value => value - 1)} className="h-10 rounded-lg border px-3 disabled:opacity-40">Previous</button><span aria-live="polite">Page {page} of {document?.numPages ?? '…'}</span><button type="button" aria-label="Next PDF page" disabled={!document || page === document.numPages} onClick={() => setPage(value => value + 1)} className="h-10 rounded-lg border px-3 disabled:opacity-40">Next</button></div>
      <div className="flex items-center gap-2"><button type="button" aria-label="Zoom out PDF" onClick={() => setZoom(value => Math.max(0.5, value - 0.25))} className="size-10 rounded-lg border">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in PDF" onClick={() => setZoom(value => Math.min(3, value + 0.25))} className="size-10 rounded-lg border">+</button></div>
    </div>
    {error ? <p role="alert" className="p-4 text-sm text-destructive">{error}</p> : null}
    {loading && !error ? <p role="status" className="p-3 text-xs text-muted-foreground">Loading PDF page…</p> : null}
    <div ref={container} className="max-h-[60dvh] overflow-auto p-3"><canvas ref={canvas} aria-label={`PDF page ${page}`} className="mx-auto bg-white shadow-lg" /></div>
  </div>
}
