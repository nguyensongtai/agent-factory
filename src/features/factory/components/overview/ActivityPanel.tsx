'use client'

import { useState } from 'react'

import AreaChart from '@/components/ui/AreaChart'
import Segmented from '@/components/ui/Segmented'

import { compact, usd } from '../../domain/format'
import type { TimelinePoint } from '../../domain/types'

type Metric = 'calls' | 'tokens' | 'errors' | 'cost'

const METRICS: { value: Metric; label: string; color: string; format: (v: number) => string }[] = [
  { value: 'calls', label: 'Lượt tool', color: '#22d3ee', format: (v) => `${v} lượt` },
  { value: 'tokens', label: 'Token', color: '#facc15', format: compact },
  { value: 'cost', label: 'Chi phí', color: '#a78bfa', format: usd },
  { value: 'errors', label: 'Lỗi', color: '#fb7185', format: (v) => `${v} lỗi` },
]

export default function ActivityPanel({ timeline }: { timeline: TimelinePoint[] }) {
  const [metric, setMetric] = useState<Metric>('calls')
  const config = METRICS.find((m) => m.value === metric)!

  return (
    <section className="panel flex flex-col gap-3 p-3 md:p-4" aria-labelledby="activity-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="activity-title" className="section-title">
          Hoạt động 60 phút qua
        </h2>
        <Segmented label="Chỉ số" options={METRICS} value={metric} onChange={setMetric} />
      </div>
      <AreaChart
        label={config.label}
        color={config.color}
        format={config.format}
        points={timeline.map((p) => ({ at: p.at, value: p[metric] }))}
      />
    </section>
  )
}
