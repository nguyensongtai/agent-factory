'use client'

import Sheet from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/States'

import { timeAgo, toolLabel } from '../../domain/format'
import { occupantsOf } from '../../domain/metrics'
import { STATION_BY_ID } from '../../domain/stations'
import { useFactory } from '../../context/FactoryProvider'
import PixelAvatar from '../common/PixelAvatar'
import StatusBadge from '../common/StatusBadge'

export default function RoomDrawer() {
  const { roomId, openRoom, openAgent, agents, snapshot } = useFactory()
  const station = roomId ? STATION_BY_ID[roomId] : null
  const now = snapshot?.generatedAt ?? 0
  const occupants = roomId ? occupantsOf(agents, roomId) : { agents: [], subagents: [] }
  const history = roomId
    ? agents
        .flatMap((agent) => agent.recent.filter((call) => call.station === roomId).map((call) => ({ call, agent })))
        .sort((a, b) => b.call.at - a.call.at)
        .slice(0, 10)
    : []

  return (
    <Sheet
      open={station !== null}
      onClose={() => openRoom(null)}
      title={
        station && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: station.accent }}>
              {station.code}
            </p>
            <h2 className="text-lg font-bold text-slate-50">
              {station.icon} {station.label}
            </h2>
          </div>
        )
      }
    >
      {station && (
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-slate-400">
            Công cụ: <span className="text-slate-200">{station.tools}</span>
          </p>

          <section aria-labelledby="room-agents">
            <h3 id="room-agents" className="section-title mb-2">
              Đang ở đây ({occupants.agents.length + occupants.subagents.length})
            </h3>
            {occupants.agents.length + occupants.subagents.length === 0 ? (
              <EmptyState icon="💡" title="Khu đang tắt đèn" hint="Đèn sáng khi có ninja dùng công cụ của khu này." />
            ) : (
              <ul className="flex flex-col gap-1">
                {occupants.agents.map((agent) => (
                  <li key={agent.id}>
                    <button
                      type="button"
                      onClick={() => openAgent(agent.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5"
                    >
                      <PixelAvatar agent={agent} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-100">{agent.title}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {agent.current ? `${toolLabel(agent.current.name)} ${agent.current.detail}` : agent.project}
                        </span>
                      </span>
                      <StatusBadge status={agent.status} />
                    </button>
                  </li>
                ))}
                {occupants.subagents.map(({ owner, sub }) => (
                  <li key={`${owner.id}:${sub.id}`}>
                    <button
                      type="button"
                      onClick={() => openAgent(owner.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5"
                    >
                      <span aria-hidden className="grid size-8 place-items-center rounded-md bg-cyan-400/10">
                        🤖
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-cyan-100">{sub.agentType}</span>
                        <span className="block truncate text-xs text-slate-400">trợ lý của {owner.name}</span>
                      </span>
                      <StatusBadge status={sub.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="room-history">
            <h3 id="room-history" className="section-title mb-2">
              Việc gần đây trong phòng
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có lượt gọi công cụ nào ở đây.</p>
            ) : (
              <ol className="flex flex-col gap-1 text-sm">
                {history.map(({ call, agent }) => (
                  <li key={`${agent.id}:${call.id}`} className="flex gap-2">
                    <span className={call.isError ? 'text-rose-400' : 'text-emerald-400'}>{call.isError ? '✕' : '✓'}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <b className="text-slate-200">{toolLabel(call.name)}</b> <span className="text-slate-400">{call.detail}</span>
                      <span className="block truncate text-xs text-slate-500">{agent.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{timeAgo(call.at, now)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Sheet>
  )
}
