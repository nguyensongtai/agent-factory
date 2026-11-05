'use client'

import { EmptyState } from '@/components/ui/States'

import { timeAgo, toolLabel } from '../../domain/format'
import { STATION_BY_ID } from '../../domain/stations'
import type { AgentSnapshot } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'

const LIMIT = 14

// Latest tool calls across every agent and subagent, newest first.
export default function LiveFeed({ agents, now }: { agents: AgentSnapshot[]; now: number }) {
  const { openAgent } = useFactory()
  const events = agents
    .flatMap((agent) => [
      ...agent.recent.map((call) => ({ call, agent, who: agent.name })),
      ...agent.subagents.flatMap((sub) => sub.recent.map((call) => ({ call, agent, who: `${agent.name} › ${sub.agentType}` }))),
    ])
    .sort((a, b) => b.call.at - a.call.at)
    .slice(0, LIMIT)

  return (
    <section className="panel flex min-h-0 flex-col" aria-labelledby="feed-title">
      <h2 id="feed-title" className="section-title px-3 pt-3 pb-2">
        Đang diễn ra
      </h2>
      {events.length === 0 ? (
        <EmptyState icon="🌙" title="Chưa có hoạt động" hint="Mở một phiên Claude Code là nó sẽ xuất hiện ở đây." />
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {events.map(({ call, agent, who }) => {
            const station = STATION_BY_ID[call.station]

            return (
              <li key={`${agent.id}:${call.id}`}>
                <button
                  type="button"
                  onClick={() => openAgent(agent.id)}
                  className="flex w-full cursor-pointer gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
                >
                  <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full" style={{ background: station.accent }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">
                      <b className={call.isError ? 'text-rose-300' : 'text-slate-100'}>{toolLabel(call.name)}</b>{' '}
                      <span className="text-slate-400">{call.detail}</span>
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {who} · {station.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {call.done ? (call.isError ? '✕' : '✓') : '…'} {timeAgo(call.at, now)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
