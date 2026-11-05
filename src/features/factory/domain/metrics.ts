import type { AgentSnapshot, FactorySnapshot, Mission, MissionStatus, StationId } from './types'

export type Summary = {
  sessions: number
  subagents: number
  active: number
  running: number
  approval: number
  completed: number
  failed: number
  calls: number
  errors: number
  tokens: number
  cost: number
}

export function allMissions(agents: AgentSnapshot[]): Mission[] {
  return agents.flatMap((a) => a.missions)
}

export function countByStatus(missions: Mission[]): Record<MissionStatus, number> {
  const counts: Record<MissionStatus, number> = { backlog: 0, assigned: 0, running: 0, approval: 0, completed: 0, failed: 0 }
  for (const mission of missions) counts[mission.status] += 1

  return counts
}

// Dashboard numbers. Calls, tokens, cost and errors cover the last hour (the timeline);
// task counts cover every turn, subagent run and plan item still in the visible window.
export function summarize(snapshot: FactorySnapshot, agents: AgentSnapshot[]): Summary {
  const tasks = countByStatus(allMissions(agents))
  const sum = (key: 'calls' | 'errors' | 'tokens' | 'cost') => snapshot.timeline.reduce((total, p) => total + p[key], 0)

  return {
    sessions: agents.length,
    subagents: agents.reduce((n, a) => n + a.subagents.length, 0),
    active: agents.filter((a) => a.status !== 'idle').length,
    running: tasks.running,
    approval: tasks.approval,
    completed: tasks.completed,
    failed: tasks.failed,
    calls: sum('calls'),
    errors: sum('errors'),
    tokens: sum('tokens'),
    cost: sum('cost'),
  }
}

export function occupantsOf(agents: AgentSnapshot[], station: StationId) {
  return {
    agents: agents.filter((a) => a.station === station),
    subagents: agents.flatMap((a) => a.subagents.filter((s) => s.station === station).map((s) => ({ owner: a, sub: s }))),
  }
}

export function successRate(calls: number, errors: number): number | null {
  return calls > 0 ? Math.max(0, 1 - errors / calls) : null
}
