import "server-only"
import path from "node:path"
import AdmZip from "adm-zip"
import * as xlsx from "xlsx"
import type { ClassifiedPage, WorkbookRecord } from "./types.js"
import { VisionServiceError } from "./errors.js"

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && `${value}`.trim())
}

export function parseWorkbook(buffer: Buffer, sourceFile: string): WorkbookRecord[] {
  let workbook: xlsx.WorkBook
  try {
    workbook = xlsx.read(buffer, { type: "buffer" })
  } catch {
    throw new VisionServiceError("CORRUPT_WORKBOOK", "Workbook is corrupt or unreadable.", 400, { sourceFile: path.basename(sourceFile) })
  }
  const records: WorkbookRecord[] = []
  for (const sourceSheet of workbook.SheetNames) {
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sourceSheet], { defval: "" })
    rows.forEach((row, index) => {
      const sku = `${pick(row, ["sku", "SKU", "Sku"]) ?? ""}`.trim()
      const cabinetCode = `${pick(row, ["cabinet_code", "Cabinet Code", "cabinetCode", "Code"]) ?? ""}`.trim()
      if (!sku && !cabinetCode) return
      const cost = Number(pick(row, ["unit_cost", "Unit Cost", "unitCost", "Cost"]))
      records.push({
        sourceFile: path.basename(sourceFile), sourceSheet, sourceRow: index + 2, sku, cabinetCode,
        description: `${pick(row, ["description", "Description"]) ?? ""}`.trim(),
        unitCostCents: Number.isFinite(cost) ? Math.round(cost * 100) : undefined,
      })
    })
  }
  if (!records.length) {
    throw new VisionServiceError("WORKBOOK_SCHEMA_UNSUPPORTED", "Workbook contains no traceable cabinet rows.", 400, { sourceFile: path.basename(sourceFile) })
  }
  return records
}

function classify(text: string): Omit<ClassifiedPage, "document" | "pageNumber"> {
  const normalized = text.toLowerCase()
  if (normalized.includes("unit matrix") || normalized.includes("unit mix")) return { classification: "UNIT_MATRIX", confidence: 0.85, reason: "Unverified keyword match: unit matrix." }
  if (normalized.includes("casework") && normalized.includes("schedule")) return { classification: "CASEWORK_SCHEDULE", confidence: 0.8, reason: "Unverified keyword match: casework schedule." }
  if (normalized.includes("finish") && normalized.includes("schedule")) return { classification: "FINISH_SCHEDULE", confidence: 0.75, reason: "Unverified keyword match: finish schedule." }
  if (normalized.includes("unit plan")) return { classification: "UNIT_PLAN", confidence: 0.7, reason: "Unverified keyword match: unit plan." }
  if (normalized.includes("floor plan")) return { classification: "FLOOR_PLAN", confidence: 0.7, reason: "Unverified keyword match: floor plan." }
  return { classification: "UNKNOWN", confidence: 0.3, reason: "No reliable deterministic pattern detected." }
}

export async function parsePdf(buffer: Buffer, document: string): Promise<{ pageCount: number; pages: ClassifiedPage[] }> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs")
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
    const pages: ClassifiedPage[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ")
      pages.push({ document, pageNumber, ...classify(text) })
    }
    return { pageCount: pdf.numPages, pages }
  } catch (error) {
    if (error instanceof VisionServiceError) throw error
    throw new VisionServiceError("CORRUPT_PDF", "PDF is corrupt or unreadable.", 400, { document })
  }
}

export type ExtractedUpload = { name: string; buffer: Buffer; mimeType: string }

const MAX_ZIP_ENTRIES = 100
const MAX_ZIP_ENTRY_BYTES = 250 * 1024 * 1024
const MAX_ZIP_EXPANDED_BYTES = 2 * 1024 * 1024 * 1024

export function extractZipFiles(buffer: Buffer): ExtractedUpload[] {
  let entries: AdmZip.IZipEntry[]
  try {
    entries = new AdmZip(buffer).getEntries()
  } catch {
    throw new VisionServiceError("INVALID_ZIP", "ZIP archive is invalid or unreadable.", 400)
  }
  const files: ExtractedUpload[] = []
  let expandedBytes = 0
  for (const entry of entries) {
    if (entry.isDirectory) continue
    const normalized = entry.entryName.replace(/\\/g, "/")
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new VisionServiceError("ZIP_PATH_TRAVERSAL", "ZIP contains an unsafe path.", 400, { entry: normalized })
    }
    const supported = /\.(pdf|xlsx|csv)$/i.test(normalized)
    if (!supported) continue
    if (files.length >= MAX_ZIP_ENTRIES) throw new VisionServiceError("UPLOAD_TOO_MANY_FILES", "ZIP contains too many supported files.", 413)
    const declaredSize = entry.header.size
    expandedBytes += declaredSize
    if (declaredSize > MAX_ZIP_ENTRY_BYTES || expandedBytes > MAX_ZIP_EXPANDED_BYTES) {
      throw new VisionServiceError("UPLOAD_TOO_LARGE", "ZIP expanded content exceeds upload limits.", 413, { entry: normalized })
    }
    if (normalized.toLowerCase().endsWith(".pdf")) files.push({ name: normalized, buffer: entry.getData(), mimeType: "application/pdf" })
    if (normalized.toLowerCase().endsWith(".xlsx")) files.push({ name: normalized, buffer: entry.getData(), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    if (normalized.toLowerCase().endsWith(".csv")) files.push({ name: normalized, buffer: entry.getData(), mimeType: "text/csv" })
  }
  if (!files.length) throw new VisionServiceError("EMPTY_ZIP", "ZIP contains no supported files.", 400)
  if (!files.some((file) => file.name.toLowerCase().endsWith(".pdf"))) throw new VisionServiceError("ZIP_WITHOUT_PDFS", "ZIP must contain at least one PDF plan.", 400)
  return files
}
