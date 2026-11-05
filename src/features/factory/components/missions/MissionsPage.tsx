'use client'

import { useMemo, useState } from 'react'

import Segmented from '@/components/ui/Segmented'
import { ErrorBanner, Skeleton } from '@/components/ui/States'
import Tooltip from '@/components/ui/Tooltip'

import { allMissions } from '../../domain/metrics'
import { COLUMNS, fromManual } from '../../domain/missions'
import type { Mission, MissionSource } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'
import { useManualMissions } from '../../hooks/useManualMissions'
import CreateMissionModal from './CreateMissionModal'
import ManualActions from './ManualActions'
import MissionCard from './MissionCard'

const COLUMN_LIMIT = 25

const SOURCES: { value: MissionSource | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'prompt', label: 'Yêu cầu' },
  { value: 'subagent', label: 'Subagent' },
  { value: 'plan', label: 'Kế hoạch' },
  { value: 'manual', label: 'Tự tạo' },
]

export default function MissionsPage() {
  const { snapshot, agents, openAgent, error: feedError, retry } = useFactory()
  const manual = useManualMissions()
  const [creating, setCreating] = useState(false)
  const [source, setSource] = useState<MissionSource | 'all'>('all')
  const [agentFilter, setAgentFilter] = useState('')
  const now = snapshot?.generatedAt ?? 0

  const missions = useMemo(() => {
    const list: Mission[] = [...(manual.missions ?? []).map(fromManual), ...allMissions(agents)]

    return list
      .filter((m) => (source === 'all' || m.source === source) && (!agentFilter || m.agentId === agentFilter))
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
  }, [manual.missions, agents, source, agentFilter])

  const loading = !snapshot || manual.missions === null

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-slate-50">Mission Control</h1>
          <p className="text-sm text-slate-400">Lượt yêu cầu, subagent và kế hoạch của agent lấy từ transcript; việc tự tạo lưu trên máy này.</p>
        </div>
        <select
          aria-label="Lọc theo agent"
          value={agentFilter}
          onChange={(event) => setAgentFilter(event.target.value)}
          className="h-9 max-w-56 cursor-pointer rounded-md border border-line bg-void px-2 text-sm text-slate-200"
        >
          <option value="">Mọi agent</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <Segmented label="Nguồn nhiệm vụ" options={SOURCES} value={source} onChange={setSource} />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-9 cursor-pointer rounded-md bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          + Tạo nhiệm vụ
        </button>
      </div>

      {feedError && <ErrorBanner message={feedError} onRetry={retry} />}
      {manual.error && <ErrorBanner message={manual.error} onRetry={manual.reload} />}

      <div className="-mx-3 overflow-x-auto px-3 pb-2 md:-mx-6 md:px-6">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {COLUMNS.map((column) => {
            const items = missions.filter((m) => m.status === column.status)

            return (
              <section key={column.status} aria-labelledby={`col-${column.status}`} className="panel flex max-h-[calc(100dvh-12rem)] flex-col">
                <h2 id={`col-${column.status}`} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold text-slate-200">
                  <span className="size-2 rounded-full" style={{ background: column.color }} />
                  <Tooltip label={column.hint} side="bottom">
                    <span tabIndex={0}>{column.label}</span>
                  </Tooltip>
                  <span className="ml-auto rounded-full bg-white/5 px-2 text-xs text-slate-400">{items.length}</span>
                </h2>
                <div className="flex min-h-24 flex-col gap-2 overflow-y-auto p-2">
                  {loading ? (
                    <Skeleton className="h-20" />
                  ) : items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-600">Trống</p>
                  ) : (
                    items.slice(0, COLUMN_LIMIT).map((mission) => {
                      const record = mission.source === 'manual' ? manual.missions!.find((m) => m.id === mission.id) : undefined

                      return (
                        <MissionCard
                          key={mission.id}
                          mission={mission}
                          agent={agents.find((a) => a.id === mission.agentId)}
                          now={now}
                          onOpen={() => mission.agentId && openAgent(mission.agentId)}
                          actions={
                            record && (
                              <ManualActions
                                mission={record}
                                agents={agents}
                                onUpdate={(patch) => manual.update(record.id, patch)}
                                onRemove={() => manual.remove(record.id)}
                              />
                            )
                          }
                        />
                      )
                    })
                  )}
                  {items.length > COLUMN_LIMIT && (
                    <p className="text-center text-xs text-slate-500">+ {items.length - COLUMN_LIMIT} nhiệm vụ cũ hơn</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <CreateMissionModal open={creating} agents={agents} onClose={() => setCreating(false)} onCreate={manual.create} />
    </>
  )
}
