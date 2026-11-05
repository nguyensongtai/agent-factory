'use client'

import { compact, duration, percent, totalTokens, usd } from '../../domain/format'
import type { AgentSnapshot } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'

export default function PerformanceTable({ agents }: { agents: AgentSnapshot[] }) {
  const { openAgent } = useFactory()
  const rows = [...agents].filter((a) => a.toolCount > 0).sort((a, b) => b.toolCount - a.toolCount)
  const maxCalls = Math.max(1, ...rows.map((a) => a.toolCount))

  return (
    <section className="panel overflow-x-auto" aria-labelledby="perf-title">
      <h2 id="perf-title" className="section-title px-3 pt-3 pb-2">
        Hiệu suất agent
      </h2>
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-y border-line text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Agent</th>
            <th scope="col" className="px-3 py-2 font-semibold">Lượt tool</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Thành công</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">TB / tool</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">API p50 · p95</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Token · chi phí</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((agent) => (
            <tr key={agent.id} onClick={() => openAgent(agent.id)} className="cursor-pointer hover:bg-white/[0.03]">
              <td className="max-w-64 truncate px-3 py-2 font-medium text-slate-200">{agent.title}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-cyan-400" style={{ width: `${(agent.toolCount / maxCalls) * 100}%` }} />
                  </div>
                  <span className="text-slate-300 tabular-nums">{agent.toolCount}</span>
                </div>
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${agent.errorCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {percent(agent.toolCount - agent.errorCount, agent.toolCount)}
              </td>
              <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{duration(agent.avgToolMs)}</td>
              <td className="px-3 py-2 text-right text-slate-300 tabular-nums">
                {duration(agent.latency.p50)} · {duration(agent.latency.p95)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="text-slate-200">{compact(totalTokens(agent.usage.tokens))}</span>
                <span className="text-slate-500"> · {usd(agent.usage.cost)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
