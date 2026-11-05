import { toolLabel } from '../../domain/format'
import { occupantsOf } from '../../domain/metrics'
import { STATION_BY_ID } from '../../domain/stations'
import type { AgentSnapshot, StationId } from '../../domain/types'
import StatusBadge from '../common/StatusBadge'

type Props = {
  hover: { entityId: string | null; roomId: StationId | null; x: number; y: number }
  agents: AgentSnapshot[]
}

function find(agents: AgentSnapshot[], entityId: string) {
  const [agentId, subId] = entityId.split(':')
  const agent = agents.find((a) => a.id === agentId)
  if (!agent) return null
  const sub = subId ? agent.subagents.find((s) => s.id === subId) : undefined

  return { agent, sub }
}

// Follows the pointer; flips to the left of it on the right half so it never leaves the map.
export default function MapTooltip({ hover, agents }: Props) {
  const flip = hover.x > 320
  const style = {
    left: hover.x + (flip ? -14 : 14),
    top: hover.y + 14,
    transform: flip ? 'translateX(-100%)' : undefined,
  }
  let body: React.ReactNode = null

  if (hover.entityId) {
    const found = find(agents, hover.entityId)
    if (!found) return null
    const { agent, sub } = found
    const status = sub?.status ?? agent.status
    const current = sub ? sub.current : agent.current
    body = (
      <>
        <p className="font-semibold text-slate-50">{sub ? `🤖 ${sub.agentType}` : agent.title}</p>
        {sub && <p className="text-slate-400">trợ lý của {agent.name}</p>}
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-slate-400">{STATION_BY_ID[sub?.station ?? agent.station].label}</span>
        </div>
        {current && (
          <p className="mt-1 font-mono text-slate-300">
            {toolLabel(current.name)} {current.detail}
          </p>
        )}
        {!sub && agent.model && <p className="mt-1 text-slate-500">{agent.model}</p>}
      </>
    )
  } else if (hover.roomId) {
    const station = STATION_BY_ID[hover.roomId]
    const occupants = occupantsOf(agents, hover.roomId)
    body = (
      <>
        <p className="font-semibold text-slate-50">
          {station.icon} {station.label}
        </p>
        <p className="text-slate-400">{station.code}</p>
        <p className="mt-1 text-slate-300">
          {occupants.agents.length} agent · {occupants.subagents.length} subagent
        </p>
        <p className="text-slate-500">Bấm để xem chi tiết</p>
      </>
    )
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 max-w-72 rounded-md border border-line bg-slate-900/95 px-2.5 py-2 text-xs shadow-xl"
      style={style}
    >
      {body}
    </div>
  )
}
