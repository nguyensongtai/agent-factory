import { compact, duration, timeAgo, toolLabel, topEntries, usd } from '../../domain/format'
import { STATION_BY_ID } from '../../domain/stations'
import type { AgentSnapshot, PlanItem, Powers as PowerCounts, Permissions as Grants, ToolCall, Usage } from '../../domain/types'
import StatusBadge from '../common/StatusBadge'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3">
      <h3 className="section-title mb-2">{title}</h3>
      {children}
    </section>
  )
}

const PLAN_ICON: Record<PlanItem['status'], string> = { completed: '✓', in_progress: '▶', pending: '○' }

export function PlanList({ plan }: { plan: PlanItem[] }) {
  if (plan.length === 0) return null
  const done = plan.filter((p) => p.status === 'completed').length

  return (
    <Section title={`Kế hoạch · ${done}/${plan.length}`}>
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${(done / plan.length) * 100}%` }} />
      </div>
      <ol className="flex flex-col gap-1 text-sm">
        {plan.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span
              aria-hidden
              className={item.status === 'completed' ? 'text-emerald-400' : item.status === 'in_progress' ? 'text-cyan-300' : 'text-slate-500'}
            >
              {PLAN_ICON[item.status]}
            </span>
            <span className={item.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}>{item.content}</span>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function Subagents({ agent }: { agent: AgentSnapshot }) {
  if (agent.subagents.length === 0) return null

  return (
    <Section title={`Subagent đang chạy (${agent.subagents.length})`}>
      <ul className="flex flex-col gap-2">
        {agent.subagents.map((sub) => (
          <li key={sub.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-cyan-200">🤖 {sub.agentType}</span>
              <StatusBadge status={sub.status} />
            </div>
            <p className="text-slate-400">{sub.description}</p>
            {sub.current && (
              <p className="truncate text-xs text-slate-500">
                {STATION_BY_ID[sub.station].icon} {toolLabel(sub.current.name)} {sub.current.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function ExecutionHistory({ calls, now }: { calls: ToolCall[]; now: number }) {
  return (
    <Section title="Lịch sử thực thi">
      {calls.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa gọi công cụ nào.</p>
      ) : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {calls.map((call) => (
            <li key={call.id} className="flex gap-2">
              <span aria-hidden className="w-5 shrink-0 text-center">
                {STATION_BY_ID[call.station].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <b className={call.isError ? 'text-rose-300' : 'text-slate-200'}>{toolLabel(call.name)}</b>{' '}
                  <span className="text-slate-400">{call.detail}</span>
                </span>
                {call.isError && call.error && <span className="block truncate text-xs text-rose-300/80">{call.error}</span>}
              </span>
              <span className="shrink-0 text-right text-xs text-slate-500">
                {call.done ? duration(call.endedAt - call.at) : 'đang chạy'}
                <br />
                {timeAgo(call.at, now)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

function Chips({ icon, entries, color }: { icon: string; entries: [string, number][]; color: string }) {
  return entries.map(([name, count]) => (
    <span key={name} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs" style={{ borderColor: `${color}55`, color }}>
      {icon} {name}
      <span className="opacity-60">×{count}</span>
    </span>
  ))
}

export function Powers({ powers }: { powers: PowerCounts }) {
  const skills = topEntries(powers.skills)
  const subagents = topEntries(powers.subagents)
  const mcp = topEntries(powers.mcp)

  return (
    <Section title="Skill, subagent, MCP đã dùng">
      {skills.length + subagents.length + mcp.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa dùng skill, subagent hay MCP nào.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Chips icon="⚡" entries={skills} color="#facc15" />
          <Chips icon="🤖" entries={subagents} color="#22d3ee" />
          <Chips icon="🔌" entries={mcp} color="#a78bfa" />
        </div>
      )}
    </Section>
  )
}

export function Permissions({ permissions }: { permissions: Grants }) {
  return (
    <Section title="Quyền được cấp">
      <p className="mb-2 text-xs text-slate-500">Đọc từ settings.json của người dùng và dự án, cùng .mcp.json.</p>
      {permissions.mcpServers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {permissions.mcpServers.map((server) => (
            <span key={server} className="rounded-md border border-violet-400/30 px-2 py-0.5 text-xs text-violet-200">
              🔌 {server}
            </span>
          ))}
        </div>
      )}
      {permissions.allow.length === 0 ? (
        <p className="text-sm text-slate-500">Không có quy tắc cho phép sẵn: mỗi lần dùng tool sẽ hỏi.</p>
      ) : (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-300">{permissions.allow.length} quy tắc cho phép</summary>
          <ul className="mt-2 flex flex-col gap-0.5 font-mono text-xs text-slate-400">
            {permissions.allow.map((rule) => (
              <li key={rule} className="break-all">
                {rule}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  )
}

export function UsageByModel({ usage }: { usage: Usage }) {
  const rows = Object.entries(usage.byModel).sort((a, b) => b[1].tokens - a[1].tokens)
  if (rows.length === 0) return null
  const { tokens } = usage

  return (
    <Section title="Token theo model">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([model, row]) => (
            <tr key={model} className="border-b border-line last:border-0">
              <td className="py-1 text-slate-300">{model.replace('claude-', '')}</td>
              <td className="py-1 text-right text-slate-200 tabular-nums">{compact(row.tokens)}</td>
              <td className="py-1 text-right text-slate-400 tabular-nums">{usd(row.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Vào {compact(tokens.input)} · ra {compact(tokens.output)} · đọc cache {compact(tokens.cacheRead)} · ghi cache{' '}
        {compact(tokens.cacheWrite)}. Tính cả subagent.
      </p>
    </Section>
  )
}
