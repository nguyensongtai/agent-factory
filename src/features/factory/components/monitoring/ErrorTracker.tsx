'use client'

import { EmptyState } from '@/components/ui/States'

import { timeAgo, toolLabel } from '../../domain/format'
import type { ErrorEvent } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'

export default function ErrorTracker({ errors, now }: { errors: ErrorEvent[]; now: number }) {
  const { openAgent } = useFactory()
  const byTool = Object.entries(
    errors.reduce<Record<string, number>>((acc, e) => {
      const key = toolLabel(e.tool)
      acc[key] = (acc[key] ?? 0) + 1

      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <section className="panel flex min-h-0 flex-col" aria-labelledby="errors-title">
      <h2 id="errors-title" className="section-title px-3 pt-3">
        Theo dõi lỗi
      </h2>
      {errors.length === 0 ? (
        <EmptyState icon="✅" title="Không có lỗi" hint="Lỗi tool và lỗi API của mọi agent sẽ hiện ở đây." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 px-3 py-2">
            {byTool.map(([tool, count]) => (
              <span key={tool} className="rounded-md border border-rose-400/30 px-2 py-0.5 text-xs text-rose-200">
                {tool} <b>×{count}</b>
              </span>
            ))}
          </div>
          <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {errors.slice(0, 20).map((error) => (
              <li key={error.id}>
                <button
                  type="button"
                  onClick={() => openAgent(error.agentId)}
                  className="w-full cursor-pointer px-3 py-2 text-left hover:bg-white/[0.03]"
                >
                  <span className="flex gap-2 text-xs">
                    <b className="text-rose-300">{toolLabel(error.tool)}</b>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{error.agentName}</span>
                    <span className="text-slate-500">{timeAgo(error.at, now)}</span>
                  </span>
                  <span className="line-clamp-2 text-sm text-slate-300">{error.message}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
