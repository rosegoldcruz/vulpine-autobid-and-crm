'use client'
/* eslint-disable @next/next/no-img-element -- Authenticated streamed images retain their exact source and load/error events. */
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { DriveItem } from '@vulpine/contracts'
import type { DriveClient } from '@vulpine/sdk'
import { drivePreviewKind, hexPreview, parseContacts, readableText } from '@/lib/drive-preview'

const loadingViewer = () => <p role="status" className="p-4 text-xs text-muted-foreground">Loading viewer…</p>
const PdfPreview = dynamic(() => import('./pdf-preview'), { ssr: false, loading: loadingViewer })
const ModelPreview = dynamic(() => import('./model-preview'), { ssr: false, loading: loadingViewer })
const SpreadsheetPreview = dynamic(() => import('./spreadsheet-preview'), { ssr: false, loading: loadingViewer })
const DocumentPreview = dynamic(() => import('./document-preview'), { ssr: false, loading: loadingViewer })

function BytePreview({ item, drive }: { item: DriveItem; drive: DriveClient }) {
  const kind = drivePreviewKind(item.path)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [archives, setArchives] = useState<Array<{ name: string; size: number }> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setBytes(null)
    const partial = item.size > 0 && ['text', 'binary', 'contacts'].includes(kind)
    void fetch(drive.previewUrl(item.path), { signal: controller.signal, headers: partial ? { Range: 'bytes=0-262143' } : undefined }).then(async response => {
      if (!response.ok) throw new Error(`Unable to load preview (HTTP ${response.status}).`)
      const data = await response.arrayBuffer()
      if (!controller.signal.aborted) setBytes(data)
    }).catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load preview.') })
    return () => controller.abort()
  }, [drive, item.path, item.size, kind, retry])
  useEffect(() => {
    if (!bytes || kind !== 'archive') return
    let cancelled = false
    void import('fflate').then(module => {
      const entries: Array<{ name: string; size: number }> = []
      // Inspect ZIP metadata without inflating file contents.
      module.unzipSync(new Uint8Array(bytes), { filter: file => { entries.push({ name: file.name, size: file.originalSize }); return false } })
      if (!cancelled) setArchives(entries)
    }).catch(() => { if (!cancelled) setError('Unable to read this ZIP archive.') })
    return () => { cancelled = true }
  }, [bytes, kind])
  if (error) return <div role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-lg border px-4 py-2">Retry preview</button></div>
  if (!bytes) return loadingViewer()
  if (kind === 'spreadsheet') return <SpreadsheetPreview bytes={bytes} />
  if (kind === 'document') return <DocumentPreview bytes={bytes} />
  const raw = new Uint8Array(bytes)
  const text = readableText(raw)
  if (kind === 'contacts' && text !== null) {
    const contacts = parseContacts(text)
    if (contacts.length) return <div className="max-h-[60dvh] overflow-auto rounded-xl border border-border/60 p-4"><p className="mb-3 text-xs text-muted-foreground">{contacts.length} contacts{item.size > bytes.byteLength ? ' · first 256 KB' : ''}</p><div className="grid gap-3 sm:grid-cols-2">{contacts.map((contact, index) => <article key={index} className="rounded-lg border border-border/60 p-4"><h3 className="font-semibold">{contact.name}</h3>{[contact.organization, ...contact.phones, ...contact.emails, ...contact.address, ...contact.notes].filter(Boolean).map((value, entry) => <p key={entry} className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{value}</p>)}</article>)}</div></div>
  }
  if (kind === 'archive') return <div className="max-h-[60dvh] overflow-auto rounded-xl border border-border/60 p-4"><p className="mb-3 text-sm font-semibold">ZIP contents · {archives?.length ?? '…'} entries</p>{archives?.map((entry, index) => <div key={index} className="flex justify-between gap-4 border-b border-border/40 py-2 text-xs"><span className="break-all">{entry.name}</span><span className="shrink-0 text-muted-foreground">{entry.size.toLocaleString()} bytes</span></div>)}</div>
  return <div className="rounded-xl border border-border/60"><div className="border-b border-border/50 p-3 text-xs text-muted-foreground">{text !== null ? 'Text preview' : 'Binary preview · hexadecimal and readable bytes'} · {item.size.toLocaleString()} bytes{item.size > bytes.byteLength ? ' · showing first 256 KB' : ''}{text === null && bytes.byteLength > 4096 ? ' · byte display limited to 4 KB' : ''}</div><pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5">{text ?? hexPreview(raw)}{bytes.byteLength === 0 ? '(Empty file)' : ''}</pre></div>
}

export default function FilePreview({ item, drive }: { item: DriveItem; drive: DriveClient }) {
  const kind = drivePreviewKind(item.path)
  const url = drive.previewUrl(item.path)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  if (kind === 'pdf') return <PdfPreview url={url} />
  if (kind === 'model') return <ModelPreview url={url} name={item.name} path={item.path} drive={drive} />
  if (kind === 'image') return <div className="relative overflow-auto rounded-xl border border-border/60 bg-black/20 p-2">{loading && !failed ? loadingViewer() : null}{failed ? <p role="alert" className="p-4 text-sm text-destructive">Unable to decode this image. The file may be damaged or use an image format this browser cannot display.</p> : null}<img src={url} alt={item.name} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false) }} className="mx-auto max-h-[60dvh] max-w-full object-contain" /></div>
  if (kind === 'video' || kind === 'audio') return <div className="rounded-xl border border-border/60 p-3">{failed ? <p role="alert" className="p-3 text-sm text-destructive">This browser cannot play the file or its codec. Use Download to open it in a compatible player.</p> : null}{kind === 'video' ? <video src={url} controls preload="metadata" onError={() => setFailed(true)} className="max-h-[60dvh] w-full rounded-lg bg-black" /> : <audio src={url} controls preload="metadata" onError={() => setFailed(true)} className="w-full" />}</div>
  return <BytePreview item={item} drive={drive} />
}
