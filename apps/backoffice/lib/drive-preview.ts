export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'model' | 'spreadsheet' | 'document' | 'contacts' | 'archive' | 'text' | 'binary'
export function previewExtension(path: string) {
  return path.split('/').at(-1)?.split('.').at(-1)?.toLowerCase() || ''
}
export function drivePreviewKind(path: string): PreviewKind {
  const ext = previewExtension(path)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['glb', 'gltf'].includes(ext)) return 'model'
  if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv'].includes(ext)) return 'spreadsheet'
  if (ext === 'docx') return 'document'
  if (ext === 'vcf') return 'contacts'
  if (ext === 'zip') return 'archive'
  if (['txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx', 'rs', 'py', 'sh', 'bash', 'yml', 'yaml', 'toml', 'ini', 'conf', 'log', 'sql', 'env', 'c', 'cpp', 'h', 'java', 'go', 'rb', 'php', 'svelte', 'vue', 'ics', 'rtf'].includes(ext)) return 'text'
  return 'binary'
}
export function readableText(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  if (bytes.some(byte => byte === 0)) return null
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const bad = [...text].filter(char => char === '\uFFFD' || (char.charCodeAt(0) < 32 && !'\r\n\t\f'.includes(char))).length
  return bad > Math.max(2, text.length * 0.01) ? null : text
}
export function hexPreview(bytes: Uint8Array) {
  const lines = []
  for (let offset = 0; offset < Math.min(bytes.length, 4096); offset += 16) {
    const row = bytes.slice(offset, offset + 16)
    const hex = Array.from(row, byte => byte.toString(16).padStart(2, '0')).join(' ').padEnd(47)
    const ascii = Array.from(row, byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.').join('')
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  ${ascii}`)
  }
  return lines.join('\n')
}
export function parseContacts(text: string) {
  const unescape = (value: string) => value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
  return text.replace(/\r?\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1).map(block => {
    const fields = block.split(/\r?\n/).flatMap(line => {
      const colon = line.indexOf(':')
      if (colon < 0) return []
      const key = line.slice(0, colon).split(';')[0].split('.').at(-1)?.toUpperCase() || ''
      return [{ key, value: unescape(line.slice(colon + 1)) }]
    })
    const values = (key: string) => fields.filter(field => field.key === key).map(field => field.value)
    return { name: values('FN')[0] || values('N')[0]?.split(';').filter(Boolean).reverse().join(' ') || 'Unnamed contact', phones: values('TEL'), emails: values('EMAIL'), organization: values('ORG').join(', ').replaceAll(';', ' '), address: values('ADR').map(value => value.split(';').filter(Boolean).join(', ')), notes: values('NOTE') }
  })
}
