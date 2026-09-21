import "server-only"
import { randomUUID } from "node:crypto"
import type { VisionProjectManifest } from "@vulpine/contracts"
import type { VisionJob } from "./types.js"
import { ensureDataDirs, listFiles, readJson, writeJson } from "./storage.js"

export class ProjectRepository {
  async create(projectName: string): Promise<VisionProjectManifest> {
    await ensureDataDirs()
    const project: VisionProjectManifest = {
      projectId: randomUUID(),
      projectName,
      files: [],
      pdfFiles: [],
      workbookFiles: [],
      pageCount: 0,
      createdAt: new Date().toISOString(),
      processingStatus: "created",
    }
    await this.save(project)
    return project
  }

  async get(projectId: string): Promise<VisionProjectManifest | null> {
    return readJson(`projects/${projectId}.json`)
  }

  async save(project: VisionProjectManifest): Promise<void> {
    await writeJson(`projects/${project.projectId}.json`, project)
  }

  async list(): Promise<VisionProjectManifest[]> {
    const values = await Promise.all((await listFiles("projects")).map((file) => readJson<VisionProjectManifest>(file)))
    return values.filter((value): value is VisionProjectManifest => Boolean(value)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export class JobRepository {
  async create(project: VisionProjectManifest): Promise<VisionJob> {
    await ensureDataDirs()
    const now = new Date().toISOString()
    const job: VisionJob = {
      id: randomUUID(), projectId: project.projectId, state: "created", createdAt: now, updatedAt: now,
      manifest: project, workbookRecords: [], classifiedPages: [], unitMix: [], takeoffRows: [], skuMappings: [], pricingLines: [],
      qaResult: { safeToSend: false, criticalIssues: [{ code: "NOT_PROCESSED", message: "Job has not completed mandatory processing stages." }], warnings: [], assumptions: [] },
      timings: [], logs: [],
    }
    await this.save(job)
    return job
  }

  async get(jobId: string): Promise<VisionJob | null> {
    return readJson(`jobs/${jobId}.json`)
  }

  async save(job: VisionJob): Promise<void> {
    job.updatedAt = new Date().toISOString()
    await writeJson(`jobs/${job.id}.json`, job)
  }
}
