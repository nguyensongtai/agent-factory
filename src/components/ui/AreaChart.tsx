'use client'

import { useState } from 'react'

type Point = { at: number; value: number }

type Props = {
  points: Point[]
  color?: string
  format?: (value: number) => string
  label: string
  height?: number
}

const time = (at: number) => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })

// Minimal area chart with a hover readout; scales to its container width.
export default function AreaChart({ points, color = '#22d3ee', format = String, label, height = 120 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return null
  const max = Math.max(1, ...points.map((p) => p.value))
  const x = (i: number) => (i / (points.length - 1)) * 100
  const y = (v: number) => 100 - (v / max) * 92
  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ')
  const active = hover === null ? null : points[hover]

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    setHover(Math.round(ratio * (points.length - 1)))
  }

  return (
    <figure className="m-0">
      <div
        className="relative"
        style={{ height }}
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label}: cao nhất ${format(max)}`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
          {[25, 50, 75].map((g) => (
            <line key={g} x1="0" x2="100" y1={g} y2={g} stroke="rgb(148 163 184 / 0.08)" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={`0,100 ${line} 100,100`} fill={color} fillOpacity="0.12" />
          <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {active && hover !== null && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-slate-400/40" style={{ left: `${x(hover)}%` }} />
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-slate-900 px-2 py-1 text-xs text-slate-200 shadow"
              style={{ left: `${Math.min(88, Math.max(12, x(hover)))}%` }}
            >
              {time(active.at)} · <b className="text-slate-50">{format(active.value)}</b>
            </div>
          </>
        )}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{time(points[0].at)}</span>
        <span>cao nhất {format(max)}</span>
        <span>bây giờ</span>
      </figcaption>
    </figure>
  )
}
