'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
export default function SpreadsheetPreview({ bytes }: { bytes: ArrayBuffer }) {
  const worker = useRef<Worker | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<string[][]>([])
  const [sheet, setSheet] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const instance = new Worker('/drive-spreadsheet-worker.js')
    worker.current = instance
    instance.onmessage = ({ data }: MessageEvent<{ error?: string; names: string[]; sheet: string; rows: string[][] }>) => {
      if (data.error) setError(data.error)
      else { setNames(data.names); setSheet(data.sheet); setRows(data.rows); setPage(0) }
      setLoading(false)
    }
    instance.onerror = () => { setError('Unable to start the spreadsheet viewer.'); setLoading(false) }
    const copy = bytes.slice(0)
    instance.postMessage({ bytes: copy }, [copy])
    return () => { instance.terminate(); worker.current = null }
  }, [bytes])
  const visible = useMemo(() => rows.slice(page * 100, (page + 1) * 100), [rows, page])
  if (error) return <p role="alert" className="p-4 text-sm text-destructive">{error}</p>
  if (loading) return <p role="status" className="p-4 text-sm">Reading spreadsheet…</p>
  return <div className="rounded-xl border border-border/60">
    <div className="flex flex-wrap items-center gap-3 border-b border-border/50 p-3 text-xs"><label>Sheet <select aria-label="Spreadsheet sheet" value={sheet} onChange={event => { setSheet(event.target.value); worker.current?.postMessage({ sheet: event.target.value }) }} className="ml-2 rounded-lg border bg-background p-2">{names.map(name => <option key={name}>{name}</option>)}</select></label><span>{rows.length} rows · showing up to 10,000 rows and 100 columns per sheet</span></div>
    <div className="max-h-[55dvh] overflow-auto"><table className="w-full border-collapse text-left text-xs"><tbody>{visible.map((row, index) => <tr key={index}><th className="sticky left-0 border border-border/40 bg-card p-2 font-mono text-muted-foreground">{page * 100 + index + 1}</th>{row.map((cell, column) => <td key={column} className="max-w-96 whitespace-pre-wrap break-words border border-border/40 p-2">{cell}</td>)}</tr>)}</tbody></table></div>
    <div className="flex items-center justify-between border-t p-2 text-xs"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)} className="h-10 px-3 disabled:opacity-40">Previous rows</button><span>{page + 1} / {Math.max(1, Math.ceil(rows.length / 100))}</span><button type="button" disabled={(page + 1) * 100 >= rows.length} onClick={() => setPage(value => value + 1)} className="h-10 px-3 disabled:opacity-40">Next rows</button></div>
  </div>
}
