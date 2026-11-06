'use client'

import { compact, duration, percent, timeAgo, totalTokens, usd } from '../../domain/format'
import { roleOf } from '../../domain/stations'
import type { AgentSnapshot } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'
import PixelAvatar from '../common/PixelAvatar'
import RankBadge from '../common/RankBadge'
import StatusBadge from '../common/StatusBadge'

function task(agent: AgentSnapshot): string {
  if (agent.current) return `${agent.current.name} ${agent.current.detail}`
  const running = agent.plan.find((p) => p.status === 'in_progress')

  return running?.content ?? agent.lastPrompt ?? ''
}

export default function AgentTable({ agents, now }: { agents: AgentSnapshot[]; now: number }) {
  const { openAgent } = useFactory()

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Ninja</th>
            <th scope="col" className="px-3 py-2 font-semibold">Vai trò · nhiệm vụ</th>
            <th scope="col" className="px-3 py-2 font-semibold">Model</th>
            <th scope="col" className="px-3 py-2 font-semibold">Trạng thái</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Token</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Tool OK</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">p50</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {agents.map((agent) => (
            <tr
              key={agent.id}
              onClick={() => openAgent(agent.id)}
              className="cursor-pointer transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    openAgent(agent.id)
                  }}
                  className="flex max-w-72 cursor-pointer items-center gap-3 text-left"
                >
                  <PixelAvatar agent={agent} size={34} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-slate-100">{agent.title}</span>
                      <RankBadge agent={agent} />
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {agent.project} · {timeAgo(agent.lastActivityAt, now)}
                      {agent.subagents.length > 0 ? ` · 🤖 ${agent.subagents.length}` : ''}
                    </span>
                  </span>
                </button>
              </td>
              <td className="max-w-80 px-3 py-2.5">
                <span className="block text-slate-300">{roleOf(agent.zones)}</span>
                <span className="block truncate text-xs text-slate-500">{task(agent)}</span>
              </td>
              <td className="px-3 py-2.5 text-slate-300">{agent.model.replace('claude-', '') || '–'}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={agent.status} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                <span className="block text-slate-200">{compact(totalTokens(agent.usage.tokens))}</span>
                <span className="block text-xs text-slate-500">{usd(agent.usage.cost)}</span>
              </td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${agent.errorCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                {percent(agent.toolCount - agent.errorCount, agent.toolCount)}
              </td>
              <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{duration(agent.latency.p50)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
