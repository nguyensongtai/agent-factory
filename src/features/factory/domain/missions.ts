import type { AgentSnapshot, ManualMission, Mission, MissionSource, MissionStatus } from './types'

export const COLUMNS: { status: MissionStatus; label: string; color: string; hint: string }[] = [
  { status: 'backlog', label: 'Backlog', color: '#64748b', hint: 'Việc bạn tạo, chưa giao cho ai' },
  { status: 'assigned', label: 'Đã giao', color: '#60a5fa', hint: 'Đã có agent nhận, chưa bắt đầu' },
  { status: 'running', label: 'Đang chạy', color: '#22d3ee', hint: 'Agent đang làm' },
  { status: 'approval', label: 'Chờ duyệt', color: '#fb7185', hint: 'Agent đang chờ bạn trả lời' },
  { status: 'completed', label: 'Hoàn thành', color: '#4ade80', hint: 'Đã xong' },
  { status: 'failed', label: 'Thất bại', color: '#ef4444', hint: 'Bị dừng, lỗi API hoặc phiên đã tắt' },
]

export const SOURCE_LABEL: Record<MissionSource, string> = {
  prompt: 'Yêu cầu',
  subagent: 'Subagent',
  plan: 'Kế hoạch',
  manual: 'Tự tạo',
}

export function fromManual(mission: ManualMission): Mission {
  return {
    id: mission.id,
    title: mission.title,
    source: 'manual',
    status: mission.status,
    agentId: mission.agentId,
    startedAt: mission.createdAt,
    endedAt: mission.status === 'completed' || mission.status === 'failed' ? mission.updatedAt : null,
    toolCount: 0,
    errorCount: 0,
    note: mission.description,
  }
}

// Bash single quotes keep `$`, backticks and quotes in the prompt literal.
function quote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

// The command that starts the work: resume the assigned session with the prompt, or open a new one.
export function launchCommand(mission: ManualMission, agent: AgentSnapshot | undefined): string {
  const prompt = quote(mission.description ? `${mission.title}\n\n${mission.description}` : mission.title)
  if (agent) return `cd ${quote(agent.cwd)} && claude --resume ${agent.id} ${prompt}`

  return `claude ${prompt}`
}
