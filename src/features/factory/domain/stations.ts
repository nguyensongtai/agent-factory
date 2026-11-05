import type { AgentStatus, StationId } from './types'

export type Station = {
  id: StationId
  label: string
  // English zone name, shown as a subtitle.
  code: string
  icon: string
  // What an agent that spends most of its calls here is doing.
  role: string
  // Tools routed here, for the room drawer.
  tools: string
  accent: string
}

export const STATIONS: Station[] = [
  {
    id: 'warehouse',
    label: 'Kho dữ liệu',
    code: 'Data Warehouse',
    icon: '🗄️',
    role: 'Phân tích dữ liệu',
    tools: 'Read, Grep, Glob',
    accent: '#60a5fa',
  },
  {
    id: 'devlab',
    label: 'Phòng phát triển',
    code: 'Development Lab',
    icon: '🛠️',
    role: 'Lập trình',
    tools: 'Edit, Write, Bash',
    accent: '#fb923c',
  },
  {
    id: 'testlab',
    label: 'Phòng kiểm thử',
    code: 'Testing Lab',
    icon: '🧪',
    role: 'Kiểm thử',
    tools: 'Bash chạy test, lint, typecheck, build',
    accent: '#4ade80',
  },
  {
    id: 'browser',
    label: 'Trạm trình duyệt',
    code: 'Browser Station',
    icon: '🌐',
    role: 'Tự động hoá web',
    tools: 'WebFetch, WebSearch, Chrome, Browser',
    accent: '#2dd4bf',
  },
  {
    id: 'mcp',
    label: 'Trung tâm MCP',
    code: 'MCP Hub',
    icon: '🔌',
    role: 'Tích hợp MCP',
    tools: 'Các MCP server khác',
    accent: '#a78bfa',
  },
  {
    id: 'orchestration',
    label: 'Trung tâm điều phối',
    code: 'Orchestration Center',
    icon: '🧠',
    role: 'Điều phối',
    tools: 'Đang suy nghĩ, Agent, SendMessage, Workflow, TodoWrite',
    accent: '#22d3ee',
  },
  {
    id: 'resources',
    label: 'Trung tâm tài nguyên',
    code: 'Resource Center',
    icon: '🔋',
    role: 'Dùng skill',
    tools: 'Skill, ToolSearch · agent rảnh nạp năng lượng ở đây',
    accent: '#facc15',
  },
  {
    id: 'approval',
    label: 'Phòng phê duyệt',
    code: 'Approval Room',
    icon: '🛡️',
    role: 'Chờ duyệt',
    tools: 'AskUserQuestion, ExitPlanMode',
    accent: '#fb7185',
  },
]

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<StationId, Station>

const ASK_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode'])
const ORCHESTRATION_TOOLS = new Set([
  'Agent',
  'Task',
  'SendMessage',
  'Workflow',
  'TodoWrite',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
])
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'])
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'BashOutput', 'KillShell', 'Monitor', 'TaskStop'])
const TEST_COMMAND = /\b(test|tests|jest|vitest|pytest|playwright|cypress|mocha|tsc|typecheck|lint|eslint|build|check)\b/i

export function isAskTool(name: string): boolean {
  return ASK_TOOLS.has(name)
}

// `command` is the Bash command, so test/lint/build runs land in the testing lab.
export function stationForTool(name: string, command = ''): StationId {
  if (ASK_TOOLS.has(name)) return 'approval'
  if (ORCHESTRATION_TOOLS.has(name) || name.startsWith('mcp__ccd_')) return 'orchestration'
  if (name === 'Skill' || name === 'ToolSearch') return 'resources'
  if (READ_TOOLS.has(name)) return 'warehouse'
  if (name === 'Bash') return TEST_COMMAND.test(command) ? 'testlab' : 'devlab'
  if (WRITE_TOOLS.has(name)) return 'devlab'
  if (name === 'WebFetch' || name === 'WebSearch' || /browser|chrome/i.test(name)) return 'browser'
  if (name.startsWith('mcp__')) return 'mcp'

  return 'orchestration'
}

export function stationForStatus(status: AgentStatus, current: { station: StationId } | null): StationId {
  if (status === 'idle') return 'resources'
  if (status === 'asking') return 'approval'
  if (status === 'thinking' || !current) return 'orchestration'

  return current.station
}

// The zone holding most of an agent's calls names its role.
export function roleOf(zones: Partial<Record<StationId, number>>): string {
  const top = Object.entries(zones).sort((a, b) => b[1] - a[1])[0]

  return top ? STATION_BY_ID[top[0] as StationId].role : 'Mới vào xưởng'
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Đang làm',
  thinking: 'Đang nghĩ',
  asking: 'Chờ duyệt',
  idle: 'Rảnh',
}

export const STATUS_COLOR: Record<AgentStatus, string> = {
  working: '#4ade80',
  thinking: '#22d3ee',
  asking: '#fb7185',
  idle: '#64748b',
}
