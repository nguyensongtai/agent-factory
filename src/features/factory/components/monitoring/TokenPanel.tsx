'use client'

import AreaChart from '@/components/ui/AreaChart'

import { compact, usd } from '../../domain/format'
import type { AgentSnapshot, TimelinePoint } from '../../domain/types'

export default function TokenPanel({ timeline, agents }: { timeline: TimelinePoint[]; agents: AgentSnapshot[] }) {
  const byModel: Record<string, { tokens: number; cost: number }> = {}
  for (const agent of agents) {
    for (const [model, row] of Object.entries(agent.usage.byModel)) {
      const entry = (byModel[model] ??= { tokens: 0, cost: 0 })
      entry.tokens += row.tokens
      entry.cost += row.cost
    }
  }
  const models = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <section className="panel flex flex-col gap-3 p-3" aria-labelledby="tokens-title">
      <h2 id="tokens-title" className="section-title">
        Token theo phút
      </h2>
      <AreaChart label="Token" color="#facc15" format={compact} points={timeline.map((p) => ({ at: p.at, value: p.tokens }))} />
      <div>
        <h3 className="mb-1 text-xs font-semibold text-slate-400">Theo model · cả các phiên đang hiện</h3>
        {models.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có dữ liệu token.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {models.map(([model, row]) => (
                <tr key={model} className="border-b border-line last:border-0">
                  <td className="py-1 text-slate-300">{model}</td>
                  <td className="py-1 text-right text-slate-200 tabular-nums">{compact(row.tokens)}</td>
                  <td className="py-1 text-right text-slate-400 tabular-nums">{usd(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-500">Chi phí ước tính theo giá API công khai; gói đăng ký Claude Code không tính theo token.</p>
      </div>
    </section>
  )
}
