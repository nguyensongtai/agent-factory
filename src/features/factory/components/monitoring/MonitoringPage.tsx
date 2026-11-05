'use client'

import { useMemo } from 'react'

import StatCard from '@/components/ui/StatCard'
import { ErrorBanner, Skeleton } from '@/components/ui/States'

import { compact, duration, percent, usd } from '../../domain/format'
import { summarize } from '../../domain/metrics'
import { useFactory } from '../../context/FactoryProvider'
import ErrorTracker from './ErrorTracker'
import HealthPanel from './HealthPanel'
import PerformanceTable from './PerformanceTable'
import Terminal from './Terminal'
import TokenPanel from './TokenPanel'

export default function MonitoringPage() {
  const { snapshot, agents, error, retry, rttMs } = useFactory()
  const summary = useMemo(() => (snapshot ? summarize(snapshot, agents) : null), [snapshot, agents])

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-50">Giám sát</h1>
        <p className="text-sm text-slate-400">Số liệu 1 giờ qua, tính từ transcript Claude Code trên máy này.</p>
      </div>
      {error && <ErrorBanner message={error} onRetry={retry} />}

      {!snapshot || !summary ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Phản hồi API"
              value={duration(snapshot.latency.p50)}
              sub={`p95 ${duration(snapshot.latency.p95)} · ${snapshot.latency.samples} mẫu`}
              help="Từ lúc Claude Code gửi yêu cầu API tới khi khối trả lời đầu tiên được ghi vào transcript."
            />
            <StatCard
              label="Lỗi"
              value={summary.errors}
              accent="#fb7185"
              sub={`${percent(summary.errors, summary.calls)} trên ${summary.calls} lượt tool`}
            />
            <StatCard label="Token" value={compact(summary.tokens)} accent="#facc15" sub={`≈ ${usd(summary.cost)} theo giá API`} />
            <StatCard
              label="Cập nhật"
              value={duration(rttMs)}
              accent="#4ade80"
              sub={`server quét ${duration(snapshot.health.scanMs)}`}
              help="Thời gian một lần làm mới dữ liệu, đo từ trình duyệt."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:[&>*]:max-h-[520px]">
            <Terminal agents={agents} errors={snapshot.errors} />
            <ErrorTracker errors={snapshot.errors} now={snapshot.generatedAt} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <TokenPanel timeline={snapshot.timeline} agents={agents} />
            <HealthPanel health={snapshot.health} rttMs={rttMs} />
          </div>

          <PerformanceTable agents={agents} />
        </>
      )}
    </>
  )
}
