import { STATUS_COLOR, STATUS_LABEL } from '../../domain/stations'
import type { AgentStatus } from '../../domain/types'

export default function StatusBadge({ status }: { status: AgentStatus }) {
  const color = STATUS_COLOR[status]

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ borderColor: `${color}55`, color, background: `${color}14` }}
    >
      <span
        className={`size-1.5 rounded-full ${status === 'working' || status === 'asking' ? 'animate-pulse' : ''}`}
        style={{ background: color }}
      />
      {STATUS_LABEL[status]}
    </span>
  )
}
