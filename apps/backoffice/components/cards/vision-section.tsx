"use client"

import { useState } from "react"
import type { VisionJob, VisionProject } from "@vulpine/sdk"
import { Toaster } from "sonner"
import { CabinetBrainNewRun } from "./cabinet-brain-new-run"
import { CabinetBrainPlanRoom } from "./cabinet-brain-plan-room"

type CabinetBrainView = "plan-room" | "new-run"

export function VisionSection() {
  const [view, setView] = useState<CabinetBrainView>("plan-room")
  const [demo, setDemo] = useState(true)
  const [project, setProject] = useState<VisionProject | null>(null)
  const [job, setJob] = useState<VisionJob | null>(null)

  function openLivePlanRoom(nextProject: VisionProject, nextJob: VisionJob | null) {
    setProject(nextProject)
    setJob(nextJob)
    setDemo(false)
    setView("plan-room")
  }

  return (
    <div className="-mx-4 -mt-5 sm:-mx-5 lg:-mx-8 lg:-my-8 xl:-mx-10">
      <Toaster richColors position="bottom-center" theme="dark" closeButton />
      {view === "new-run" ? (
        <CabinetBrainNewRun
          onReady={openLivePlanRoom}
          onPreview={() => {
            setDemo(true)
            setView("plan-room")
          }}
        />
      ) : (
        <CabinetBrainPlanRoom
          key={`${demo ? "sample" : "live"}-${project?.projectId ?? "empty"}`}
          project={project}
          job={job}
          demo={demo}
          onOpenNewRun={() => setView("new-run")}
          onUseDemo={() => setDemo(true)}
        />
      )}
    </div>
  )
}
