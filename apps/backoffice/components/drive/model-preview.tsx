'use client'
import type { DriveClient } from '@vulpine/sdk'
import { useEffect, useRef, useState, type ElementType } from 'react'
const ModelElement = 'model-viewer' as ElementType

export default function ModelPreview({ url, name, path, drive }: { url: string; name: string; path: string; drive: DriveClient }) {
  const element = useRef<HTMLElement>(null)
  const [source, setSource] = useState(path.toLowerCase().endsWith('.gltf') ? '' : url)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!path.toLowerCase().endsWith('.gltf')) return
    const controller = new AbortController()
    let objectUrl = ''
    void fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Unable to load GLTF')
      const model = await response.json()
      for (const entry of [...(model.buffers || []), ...(model.images || [])]) {
        if (!entry.uri || entry.uri.startsWith('data:')) continue
        if (/^(?:[a-z]+:|\/\/|\/)/i.test(entry.uri)) throw new Error('External model assets are not loaded. Store the model assets beside the GLTF file.')
        const parts = path.split('/').slice(0, -1)
        for (const segment of decodeURIComponent(entry.uri).split('/')) {
          if (segment === '..') parts.pop()
          else if (segment && segment !== '.') parts.push(segment)
        }
        entry.uri = new URL(drive.previewUrl(parts.join('/') || '/'), window.location.origin).toString()
      }
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(new Blob([JSON.stringify(model)], { type: 'model/gltf+json' }))
      setSource(objectUrl)
    }).catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to read GLTF') })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url, path, drive])
  useEffect(() => {
    let cancelled = false
    void import('@google/model-viewer').then(module => {
      module.ModelViewerElement.dracoDecoderLocation = '/viewers/model/draco/gltf/'
      module.ModelViewerElement.ktx2TranscoderLocation = '/viewers/model/basis/'
      module.ModelViewerElement.meshoptDecoderLocation = '/viewers/model/meshopt_decoder.js'
      if (!cancelled) setReady(true)
    }).catch(() => { if (!cancelled) setError('Unable to load the 3D viewer.') })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const target = element.current
    if (!ready || !target) return
    const loaded = () => setLoading(false)
    const failed = () => { setLoading(false); setError('Unable to render this model. Check that the GLB is valid and that any GLTF assets are present.') }
    target.addEventListener('load', loaded)
    target.addEventListener('error', failed)
    return () => { target.removeEventListener('load', loaded); target.removeEventListener('error', failed) }
  }, [ready, source])
  return <div className="relative rounded-xl border border-border/60 bg-muted/20">
    {loading && !error ? <p role="status" className="absolute left-3 top-3 z-10 text-xs text-muted-foreground">Loading 3D model…</p> : null}
    {error ? <p role="alert" className="p-4 text-sm text-destructive">{error}</p> : null}
    {ready && source ? <ModelElement ref={element} src={source} alt={name} camera-controls touch-action="pan-y" shadow-intensity="1" exposure="1" style={{ width: '100%', height: 'min(60dvh, 34rem)' }} /> : null}
    <p className="border-t border-border/50 p-3 text-xs text-muted-foreground">Drag to rotate · Scroll or pinch to zoom</p>
  </div>
}
