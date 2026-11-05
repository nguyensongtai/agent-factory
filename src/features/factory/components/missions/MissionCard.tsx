'use client'

import { timeAgo } from '../../domain/format'
import { SOURCE_LABEL } from '../../domain/missions'
import type { AgentSnapshot, Mission } from '../../domain/types'
import PixelAvatar from '../common/PixelAvatar'

type Props = {
  mission: Mission
  agent: AgentSnapshot | undefined
  now: number
  onOpen: () => void
  actions?: React.ReactNode
}

const SOURCE_COLOR: Record<Mission['source'], string> = {
  prompt: '#22d3ee',
  subagent: '#a78bfa',
  plan: '#60a5fa',
  manual: '#facc15',
}

export default function MissionCard({ mission, agent, now, onOpen, actions }: Props) {
  const color = SOURCE_COLOR[mission.source]
  const ended = mission.endedAt !== null

  return (
    <article className="rounded-md border border-line bg-void/70 p-2.5 transition-colors hover:border-slate-600">
      <button type="button" onClick={onOpen} className="block w-full cursor-pointer text-left">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="rounded px-1.5 py-px font-semibold" style={{ color, background: `${color}18` }}>
            {SOURCE_LABEL[mission.source]}
          </span>
          <span className="ml-auto text-slate-500">{timeAgo(mission.endedAt ?? mission.startedAt, now)}</span>
        </div>
        <h3 className="line-clamp-3 text-sm font-medium text-slate-100">{mission.title}</h3>
        {mission.note && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{mission.note}</p>}
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          {agent ? (
            <>
              <PixelAvatar sessionId={agent.id} project={agent.project} size={20} />
              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
            </>
          ) : (
            <span className="flex-1 text-slate-500">{mission.agentId ? 'agent đã rời xưởng' : 'chưa giao'}</span>
          )}
          {mission.toolCount > 0 && <span title="Lượt gọi tool">🔧 {mission.toolCount}</span>}
          {mission.errorCount > 0 && <span className="text-rose-300" title="Lỗi">⚠ {mission.errorCount}</span>}
          {ended && mission.source !== 'plan' && mission.startedAt > 0 && (
            <span title="Thời gian">⏱ {Math.max(1, Math.round((mission.endedAt! - mission.startedAt) / 60_000))}′</span>
          )}
        </div>
      </button>
      {actions && <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">{actions}</div>}
    </article>
  )
}
