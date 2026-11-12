import type { AgentSnapshot, AgentStatus } from './types'

// An agent or subagent that has just started waiting for the user.
export type AskingAlert = {
  key: string
  // The session to open: a subagent opens the drawer of the agent that started it.
  agentId: string
  name: string
  detail: string
}

const subKey = (agentId: string, subId: string) => `${agentId}/${subId}`

// Status of every agent and visible subagent, keyed by agent id and `agentId/subagentId`.
export function statusesOf(agents: AgentSnapshot[]): Map<string, AgentStatus> {
  const statuses = new Map<string, AgentStatus>()
  for (const agent of agents) {
    statuses.set(agent.id, agent.status)
    for (const sub of agent.subagents) statuses.set(subKey(agent.id, sub.id), sub.status)
  }

  return statuses
}

export function waitingCount(agents: AgentSnapshot[]): number {
  let count = 0
  for (const status of statusesOf(agents).values()) if (status === 'asking') count += 1

  return count
}

// Agents and subagents that are asking now but were not in the previous snapshot. With no previous
// snapshot (the page just loaded) nothing is new: those were already waiting before the page opened.
export function newlyAsking(previous: Map<string, AgentStatus> | null, agents: AgentSnapshot[]): AskingAlert[] {
  if (!previous) return []
  const alerts: AskingAlert[] = []
  for (const agent of agents) {
    if (agent.status === 'asking' && previous.get(agent.id) !== 'asking') {
      alerts.push({ key: agent.id, agentId: agent.id, name: agent.name, detail: agent.current?.detail ?? '' })
    }
    for (const sub of agent.subagents) {
      const key = subKey(agent.id, sub.id)
      if (sub.status !== 'asking' || previous.get(key) === 'asking') continue
      alerts.push({ key, agentId: agent.id, name: `${agent.name} › ${sub.agentType}`, detail: sub.current?.detail ?? '' })
    }
  }

  return alerts
}

const COUNT_PREFIX = /^\(\d+\) /

// "(2) Làng Ninja AI" while two are waiting; the bare title otherwise.
export function withWaitingCount(title: string, count: number): string {
  const bare = title.replace(COUNT_PREFIX, '')

  return count > 0 ? `(${count}) ${bare}` : bare
}
