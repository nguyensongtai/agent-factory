import type { AgentSnapshot } from './types'

// Ninja ranks come only from transcript data (tool calls made, subagents delegated), never from animation.
// Genin, Chunin and Jonin are the historical ninja grades; Sōke is the head of a school.
export type Rank = 'genin' | 'chunin' | 'jonin' | 'soke'

export const RANKS: Record<Rank, { label: string; color: string; rule: string }> = {
  genin: { label: 'Genin', color: '#cbd5e1', rule: 'Dưới 50 lượt tool' },
  chunin: { label: 'Chunin', color: '#22d3ee', rule: '50–299 lượt tool' },
  jonin: { label: 'Jonin', color: '#a78bfa', rule: 'Từ 300 lượt tool' },
  soke: { label: 'Sōke', color: '#f43f5e', rule: 'Điều phối subagent trong phiên' },
}

const CHUNIN_CALLS = 50
const JONIN_CALLS = 300

export function rankOf(agent: Pick<AgentSnapshot, 'toolCount' | 'subagents'>): Rank {
  if (agent.subagents.length > 0) return 'soke'
  if (agent.toolCount >= JONIN_CALLS) return 'jonin'
  if (agent.toolCount >= CHUNIN_CALLS) return 'chunin'

  return 'genin'
}
