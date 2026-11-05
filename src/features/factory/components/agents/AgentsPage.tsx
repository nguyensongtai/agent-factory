'use client'

import { useDeferredValue, useMemo, useState } from 'react'

import Segmented from '@/components/ui/Segmented'
import { EmptyState, ErrorBanner, Skeleton } from '@/components/ui/States'

import { totalTokens } from '../../domain/format'
import type { AgentSnapshot, AgentStatus } from '../../domain/types'
import { useFactory } from '../../context/FactoryProvider'
import AgentTable from './AgentTable'

type Filter = 'all' | 'active' | 'asking' | 'idle'
type Sort = 'activity' | 'tokens' | 'errors'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang chạy' },
  { value: 'asking', label: 'Chờ duyệt' },
  { value: 'idle', label: 'Rảnh' },
]
const SORTS: { value: Sort; label: string }[] = [
  { value: 'activity', label: 'Mới nhất' },
  { value: 'tokens', label: 'Token' },
  { value: 'errors', label: 'Lỗi' },
]
const ORDER: AgentStatus[] = ['asking', 'working', 'thinking', 'idle']

function matches(agent: AgentSnapshot, filter: Filter, query: string): boolean {
  if (filter === 'active' && (agent.status === 'idle' || agent.status === 'asking')) return false
  if (filter === 'asking' && agent.status !== 'asking') return false
  if (filter === 'idle' && agent.status !== 'idle') return false
  if (!query) return true
  const haystack = `${agent.title} ${agent.name} ${agent.project} ${agent.model} ${agent.gitBranch}`.toLowerCase()

  return haystack.includes(query)
}

const SORTERS: Record<Sort, (a: AgentSnapshot, b: AgentSnapshot) => number> = {
  activity: (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.lastActivityAt - a.lastActivityAt,
  tokens: (a, b) => totalTokens(b.usage.tokens) - totalTokens(a.usage.tokens),
  errors: (a, b) => b.errorCount - a.errorCount,
}

export default function AgentsPage() {
  const { snapshot, error, retry, agents } = useFactory()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('activity')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const rows = useMemo(
    () => agents.filter((a) => matches(a, filter, deferredQuery)).sort(SORTERS[sort]),
    [agents, filter, deferredQuery, sort],
  )

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold text-slate-50">Agent</h1>
          <p className="text-sm text-slate-400">Mỗi phiên Claude Code là một agent; subagent nằm trong chi tiết của phiên tạo ra nó.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên, dự án, model…"
          aria-label="Tìm agent"
          className="h-9 w-full rounded-md border border-line bg-void px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none sm:w-64"
        />
        <Segmented label="Lọc trạng thái" options={FILTERS} value={filter} onChange={setFilter} />
        <Segmented label="Sắp xếp" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {error && <ErrorBanner message={error} onRetry={retry} />}
      {!snapshot ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="🔎"
            title={agents.length === 0 ? 'Chưa có agent nào' : 'Không có agent khớp bộ lọc'}
            hint={agents.length === 0 ? `Chỉ hiện phiên hoạt động trong ${snapshot.health.windowHours} giờ qua.` : undefined}
          />
        </div>
      ) : (
        <AgentTable agents={rows} now={snapshot.generatedAt} />
      )}
    </>
  )
}
