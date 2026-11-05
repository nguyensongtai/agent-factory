'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { clock, duration, toolLabel } from '../../domain/format'
import type { AgentSnapshot, ErrorEvent } from '../../domain/types'

type Line = { key: string; at: number; who: string; tool: string; detail: string; state: 'run' | 'ok' | 'err'; ms: number; note: string }

const MAX_LINES = 300

function buildLines(agents: AgentSnapshot[], errors: ErrorEvent[]): Line[] {
  const lines: Line[] = []
  for (const agent of agents) {
    const sources = [
      { who: agent.name, calls: agent.recent },
      ...agent.subagents.map((sub) => ({ who: `${agent.name} › ${sub.agentType}`, calls: sub.recent })),
    ]
    for (const { who, calls } of sources) {
      for (const call of calls) {
        lines.push({
          key: `${agent.id}:${call.id}`,
          at: call.at,
          who,
          tool: toolLabel(call.name),
          detail: call.detail,
          state: !call.done ? 'run' : call.isError ? 'err' : 'ok',
          ms: call.done ? call.endedAt - call.at : 0,
          note: call.error,
        })
      }
    }
  }
  for (const error of errors) {
    if (error.tool !== 'API') continue
    lines.push({ key: error.id, at: error.at, who: error.agentName, tool: 'API', detail: '', state: 'err', ms: 0, note: error.message })
  }

  return lines.sort((a, b) => a.at - b.at).slice(-MAX_LINES)
}

const STATE_MARK = { run: { text: '…', className: 'text-cyan-300' }, ok: { text: '✓', className: 'text-emerald-400' }, err: { text: '✕', className: 'text-rose-400' } }

// Live execution log built from every agent's recent tool calls; sticks to the bottom unless paused.
export default function Terminal({ agents, errors }: { agents: AgentSnapshot[]; errors: ErrorEvent[] }) {
  const [frozen, setFrozen] = useState<Line[] | null>(null)
  const [onlyErrors, setOnlyErrors] = useState(false)
  const live = useMemo(() => buildLines(agents, errors), [agents, errors])
  const lines = (frozen ?? live).filter((l) => !onlyErrors || l.state === 'err')
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && !frozen) el.scrollTop = el.scrollHeight
  }, [lines.length, frozen])

  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden" aria-labelledby="terminal-title">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span aria-hidden className="flex gap-1">
          <span className="size-2.5 rounded-full bg-rose-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </span>
        <h2 id="terminal-title" className="section-title">
          Execution log
        </h2>
        <span className="text-xs text-slate-500">{lines.length} dòng</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={onlyErrors} onChange={(event) => setOnlyErrors(event.target.checked)} className="accent-rose-400" />
          Chỉ lỗi
        </label>
        <button
          type="button"
          onClick={() => setFrozen(frozen ? null : live)}
          aria-pressed={frozen !== null}
          className="cursor-pointer rounded-md border border-line px-2 py-0.5 text-xs text-slate-300 hover:bg-white/5"
        >
          {frozen ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
        </button>
      </div>
      <div
        ref={scrollRef}
        role="log"
        aria-live={frozen ? 'off' : 'polite'}
        aria-relevant="additions"
        className="min-h-72 flex-1 overflow-y-auto bg-[#01040b] px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {lines.length === 0 ? (
          <p className="text-slate-500">$ chờ hoạt động…</p>
        ) : (
          lines.map((line) => (
            <div key={line.key} className="flex gap-2 whitespace-nowrap">
              <span className="text-slate-600">{clock(line.at)}</span>
              <span className={STATE_MARK[line.state].className}>{STATE_MARK[line.state].text}</span>
              <span className="max-w-48 shrink-0 truncate text-violet-300">{line.who}</span>
              <span className="text-cyan-200">{line.tool}</span>
              <span className="min-w-0 truncate text-slate-400">
                {line.detail}
                {line.note && <span className="text-rose-300"> — {line.note}</span>}
              </span>
              {line.ms > 0 && <span className="ml-auto shrink-0 text-slate-600">{duration(line.ms)}</span>}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
