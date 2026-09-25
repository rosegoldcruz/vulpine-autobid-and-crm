"use client"

import { useEffect, useState } from "react"
import type { VisionJob, VisionProject } from "@vulpine/sdk"
import { VisionClient } from "@vulpine/sdk"
import { Loader2 } from "lucide-react"
import { toast, Toaster } from "sonner"
import { CabinetBrainNewRun } from "./cabinet-brain-new-run"
import { CabinetBrainPlanRoom } from "./cabinet-brain-plan-room"

type CabinetBrainView = "plan-room" | "new-run"
const client = new VisionClient()
const LAST_JOB_KEY = "vulpine.cabinetBrain.lastJobId.v1"

export function VisionSection() {
  const [view, setView] = useState<CabinetBrainView>("new-run")
  const [project, setProject] = useState<VisionProject | null>(null)
  const [job, setJob] = useState<VisionJob | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    const jobId = window.sessionStorage.getItem(LAST_JOB_KEY)
    if (!jobId) {
      setRestoring(false)
      return
    }
    client.getJob(jobId).then((result) => {
      setProject(result.project)
      setJob(result.job)
      setView("plan-room")
    }).catch(() => {
      window.sessionStorage.removeItem(LAST_JOB_KEY)
      toast.error("Previous Cabinet Brain run could not be restored")
    }).finally(() => setRestoring(false))
  }, [])

  function openLivePlanRoom(nextProject: VisionProject, nextJob: VisionJob | null) {
    setProject(nextProject)
    setJob(nextJob)
    if (nextJob) window.sessionStorage.setItem(LAST_JOB_KEY, nextJob.id)
    setView("plan-room")
  }

  return (
    <div className="-mx-4 -mt-5 sm:-mx-5 lg:-mx-8 lg:-my-8 xl:-mx-10">
      <Toaster richColors position="top-center" theme="dark" closeButton />
      {restoring ? <div className="flex min-h-[60dvh] items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Restoring real Vision run…</div> : view === "new-run" || !project || !job ? (
        <CabinetBrainNewRun onReady={openLivePlanRoom} />
      ) : (
        <CabinetBrainPlanRoom
          project={project}
          job={job}
          onOpenNewRun={() => setView("new-run")}
        />
      )}
    </div>
  )
}
