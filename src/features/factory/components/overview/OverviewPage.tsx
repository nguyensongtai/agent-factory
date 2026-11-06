'use client'

import { useMemo } from 'react'

import { ErrorBanner, Skeleton } from '@/components/ui/States'

import { summarize } from '../../domain/metrics'
import { useFactory } from '../../context/FactoryProvider'
import FactoryMap from '../map/FactoryMap'
import ActivityPanel from './ActivityPanel'
import KpiGrid from './KpiGrid'
import LiveFeed from './LiveFeed'

export default function OverviewPage() {
  const { snapshot, error, retry, agents } = useFactory()
  const summary = useMemo(() => (snapshot ? summarize(snapshot, agents) : null), [snapshot, agents])

  return (
    <>
      <h1 className="sr-only">Tổng quan làng ninja AI</h1>
      {error && <ErrorBanner message={error} onRetry={retry} />}
      {snapshot && summary ? (
        <KpiGrid summary={summary} agents={agents} latency={snapshot.latency} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      )}

      {/* The map takes the full width so every room fits and agents stay big enough to read. */}
      <FactoryMap />
      <div className="grid gap-4 md:grid-cols-2">
        {snapshot ? <ActivityPanel timeline={snapshot.timeline} /> : <Skeleton className="h-48" />}
        {snapshot ? <LiveFeed agents={agents} now={snapshot.generatedAt} /> : <Skeleton className="h-80" />}
      </div>
    </>
  )
}
