/* global XLSX, importScripts */
importScripts('/viewers/xlsx.full.min.js')
let workbook
self.onmessage = ({ data }) => {
  try {
    if (data.bytes) workbook = XLSX.read(data.bytes, { type: 'array', cellHTML: false, cellFormula: false, sheetRows: 10001 })
    const sheet = data.sheet || workbook.SheetNames[0]
    const rows = sheet ? XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, raw: false, defval: '', blankrows: false }).map(row => row.slice(0, 100).map(String)) : []
    self.postMessage({ names: workbook.SheetNames, sheet, rows })
  } catch {
    self.postMessage({ error: 'Unable to read this spreadsheet. It may be damaged or password protected.' })
  }
}
