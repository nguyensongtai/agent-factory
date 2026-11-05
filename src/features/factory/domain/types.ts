// The eight factory zones. Each tool call is routed to one of them; idle agents recharge in `resources`.
export type StationId =
  | 'warehouse'
  | 'devlab'
  | 'testlab'
  | 'browser'
  | 'mcp'
  | 'orchestration'
  | 'resources'
  | 'approval'

export type AgentStatus = 'working' | 'thinking' | 'asking' | 'idle'

export type ToolCall = {
  id: string
  name: string
  detail: string
  station: StationId
  at: number
  // 0 while the call is still running.
  endedAt: number
  done: boolean
  isError: boolean
  error: string
}

export type Powers = {
  skills: Record<string, number>
  subagents: Record<string, number>
  mcp: Record<string, number>
}

export type TokenUsage = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Usage = {
  tokens: TokenUsage
  // USD at public API prices; models without a known price add tokens but no cost.
  cost: number
  byModel: Record<string, { tokens: number; cost: number }>
}

export type LatencyStats = { p50: number; p95: number; samples: number }

export type PlanItem = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export type MissionStatus = 'backlog' | 'assigned' | 'running' | 'approval' | 'completed' | 'failed'

// prompt: a user turn of a session, subagent: one delegated run, plan: an item of the agent's own task list,
// manual: created in Mission Control.
export type MissionSource = 'prompt' | 'subagent' | 'plan' | 'manual'

export type Mission = {
  id: string
  title: string
  source: MissionSource
  status: MissionStatus
  agentId: string | null
  startedAt: number
  endedAt: number | null
  toolCount: number
  errorCount: number
  note: string
}

export type ErrorEvent = {
  id: string
  agentId: string
  agentName: string
  at: number
  tool: string
  message: string
}

export type TimelinePoint = { at: number; calls: number; tokens: number; errors: number; cost: number }

export type Permissions = { allow: string[]; mcpServers: string[] }

export type SubagentSnapshot = {
  id: string
  agentType: string
  description: string
  status: AgentStatus
  station: StationId
  current: ToolCall | null
  lastActivityAt: number
  toolCount: number
  recent: ToolCall[]
}

export type AgentSnapshot = {
  id: string
  name: string
  title: string
  // Started by an SDK script rather than a person (entrypoint sdk-*).
  automated: boolean
  project: string
  cwd: string
  gitBranch: string
  model: string
  lastPrompt: string
  status: AgentStatus
  station: StationId
  current: ToolCall | null
  lastActivityAt: number
  toolCount: number
  errorCount: number
  avgToolMs: number
  recent: ToolCall[]
  powers: Powers
  // Tool calls per zone, used to describe what the agent mostly does.
  zones: Partial<Record<StationId, number>>
  usage: Usage
  latency: LatencyStats
  plan: PlanItem[]
  missions: Mission[]
  permissions: Permissions
  subagents: SubagentSnapshot[]
}

export type SystemHealth = {
  scanMs: number
  sessions: number
  subagentFiles: number
  bytesRead: number
  rssMb: number
  heapMb: number
  uptimeSec: number
  windowHours: number
  projectsDir: string
  projectsDirFound: boolean
}

export type FactorySnapshot = {
  generatedAt: number
  agents: AgentSnapshot[]
  // One point per minute, oldest first, covering the last hour.
  timeline: TimelinePoint[]
  errors: ErrorEvent[]
  latency: LatencyStats
  health: SystemHealth
}

// Missions created by hand in Mission Control, persisted by the local server.
export type ManualMission = {
  id: string
  title: string
  description: string
  agentId: string | null
  status: 'backlog' | 'assigned' | 'completed' | 'failed'
  createdAt: number
  updatedAt: number
}
