import Tooltip from '@/components/ui/Tooltip'

import { RANKS, rankOf } from '../../domain/ranks'
import type { AgentSnapshot } from '../../domain/types'

type Props = { agent: Pick<AgentSnapshot, 'toolCount' | 'subagents'>; withRule?: boolean }

export default function RankBadge({ agent, withRule = false }: Props) {
  const rank = RANKS[rankOf(agent)]
  const badge = (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold tracking-wide"
      style={{ color: rank.color, borderColor: `${rank.color}66`, background: `${rank.color}14` }}
    >
      <span className="size-1.5 rotate-45" style={{ background: rank.color }} aria-hidden />
      {rank.label}
    </span>
  )
  if (withRule) {
    return (
      <span className="inline-flex items-center gap-2">
        {badge}
        <span className="text-xs text-slate-500">{rank.rule}</span>
      </span>
    )
  }

  return <Tooltip label={rank.rule}>{badge}</Tooltip>
}
