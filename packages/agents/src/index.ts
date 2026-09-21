export type AgentChannel = "text" | "voice" | "mail" | "dial"

export type AgentInvocation = {
  agent: "valerie-aeon"
  channel: AgentChannel
  correlationId: string
  task: string
}
