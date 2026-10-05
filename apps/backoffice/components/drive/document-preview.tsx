'use client'
import { useEffect, useState } from 'react'
export default function DocumentPreview({ bytes }: { bytes: ArrayBuffer }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    void import('mammoth').then(module => module.extractRawText({ arrayBuffer: bytes })).then(result => { if (!cancelled) setText(result.value || 'This document has no text content.') }).catch(() => { if (!cancelled) setError('Unable to read this Word document.') })
    return () => { cancelled = true }
  }, [bytes])
  if (error) return <p role="alert" className="p-4 text-destructive">{error}</p>
  return <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/60 p-5 font-sans text-sm leading-6">{text || 'Reading document…'}</pre>
}
