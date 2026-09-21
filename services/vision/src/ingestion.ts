import "server-only"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import type { VisionProjectFile } from "@vulpine/contracts"
import type { VisionJob, VisionProjectManifest } from "./types.js"
import { VisionServiceError } from "./errors.js"
import { JobRepository, ProjectRepository } from "./repositories.js"
import { extractZipFiles, type ExtractedUpload } from "./parsers.js"
import { writeBinary } from "./storage.js"

export const VISION_UPLOAD_LIMITS = { maxFiles: 100, maxPdfBytes: 250 * 1024 * 1024, maxWorkbookBytes: 50 * 1024 * 1024, maxBatchBytes: 2 * 1024 * 1024 * 1024 } as const

function kind(name: string): "pdf" | "workbook" | "zip" | null {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "workbook"
  if (lower.endsWith(".zip")) return "zip"
  return null
}

function validateFile(name: string, size: number): void {
  const fileKind = kind(name)
  if (!fileKind) throw new VisionServiceError("UNSUPPORTED_FILE_TYPE", "Allowed files: PDF, ZIP, XLSX, and CSV.", 400, { name })
  const limit = fileKind === "workbook" ? VISION_UPLOAD_LIMITS.maxWorkbookBytes : VISION_UPLOAD_LIMITS.maxPdfBytes
  if (size > limit) throw new VisionServiceError("UPLOAD_TOO_LARGE", `${name} exceeds its upload limit.`, 413, { name, limit })
}

async function persist(projectId: string, upload: ExtractedUpload): Promise<VisionProjectFile> {
  validateFile(upload.name, upload.buffer.length)
  const id = randomUUID()
  const relativePath = `uploads/${projectId}/${id}_${path.basename(upload.name)}`
  await writeBinary(relativePath, upload.buffer)
  return { id, name: upload.name, path: relativePath, size: upload.buffer.length, mimeType: upload.mimeType, sha256: createHash("sha256").update(upload.buffer).digest("hex"), uploadedAt: new Date().toISOString() }
}

export async function ingestUploads(projectId: string, formData: FormData): Promise<{ project: VisionProjectManifest; job: VisionJob }> {
  const projectRepo = new ProjectRepository()
  const project = await projectRepo.get(projectId)
  if (!project) throw new VisionServiceError("PROJECT_NOT_FOUND", "Project not found.", 404, { projectId })
  const values = formData.getAll("files").filter((value): value is File => value instanceof File)
  if (!values.length) throw new VisionServiceError("UPLOAD_FILES_REQUIRED", "At least one file is required.", 400)
  if (values.length > VISION_UPLOAD_LIMITS.maxFiles) throw new VisionServiceError("UPLOAD_TOO_MANY_FILES", "Upload contains too many files.", 413)
  if (values.reduce((sum, file) => sum + file.size, 0) > VISION_UPLOAD_LIMITS.maxBatchBytes) throw new VisionServiceError("UPLOAD_TOO_LARGE", "Upload batch exceeds 2 GB.", 413)

  const incoming: VisionProjectFile[] = []
  for (const file of values) {
    validateFile(file.name, file.size)
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploads = kind(file.name) === "zip" ? extractZipFiles(buffer) : [{ name: file.name, buffer, mimeType: file.type || "application/octet-stream" }]
    if (incoming.length + uploads.length > VISION_UPLOAD_LIMITS.maxFiles) throw new VisionServiceError("UPLOAD_TOO_MANY_FILES", "Expanded upload contains too many files.", 413)
    const expandedBytes = incoming.reduce((sum, value) => sum + value.size, 0) + uploads.reduce((sum, value) => sum + value.buffer.length, 0)
    if (expandedBytes > VISION_UPLOAD_LIMITS.maxBatchBytes) throw new VisionServiceError("UPLOAD_TOO_LARGE", "Expanded upload batch exceeds 2 GB.", 413)
    for (const upload of uploads) incoming.push(await persist(projectId, upload))
  }
  project.files = [...project.files, ...incoming]
  project.pdfFiles = project.files.filter((file) => file.name.toLowerCase().endsWith(".pdf"))
  project.workbookFiles = project.files.filter((file) => /\.(xlsx|csv)$/i.test(file.name))
  project.processingStatus = "uploaded"
  await projectRepo.save(project)
  const job = await new JobRepository().create(project)
  job.state = "files_ingested"
  job.logs.push({ stage: "upload_ingestion", event: "complete", uploadedFiles: incoming.length, time: new Date().toISOString() })
  await new JobRepository().save(job)
  return { project, job }
}
