"use client"

import "../cabinet-brain/cabinet-brain.css"
import { ChatWidget } from "../cabinet-brain/chat-widget"
import { WorkspaceClient } from "../cabinet-brain/workspace-client"

export function VisionSection() {
  return (
    <div className="cabinet-brain-root -mx-4 -mt-5 sm:-mx-5 lg:-mx-8 lg:-my-8 xl:-mx-10">
      <WorkspaceClient />
      <ChatWidget />
    </div>
  )
}
