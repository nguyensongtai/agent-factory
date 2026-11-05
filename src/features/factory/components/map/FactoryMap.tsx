'use client'

import { Skeleton } from '@/components/ui/States'

import { useFactory } from '../../context/FactoryProvider'
import FloorView from './FloorView'

const LEGEND = [
  { color: '#4ade80', label: 'Phòng có người làm' },
  { color: '#fb7185', label: 'Chờ duyệt' },
  { color: '#ef4444', label: 'Vừa lỗi' },
  { color: '#334155', label: 'Phòng trống (tắt đèn)' },
]

export default function FactoryMap() {
  const { snapshot, agents, agentId, openAgent, openRoom } = useFactory()

  return (
    <section className="holo-frame flex min-w-0 flex-col gap-2 p-2 md:p-3" aria-labelledby="map-title">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <h2 id="map-title" className="section-title text-cyan-200">
          Sàn nhà máy
        </h2>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
        <p className="ml-auto hidden text-xs text-slate-500 lg:block">Bấm vào agent hoặc phòng để xem chi tiết</p>
      </div>
      {snapshot ? (
        <FloorView agents={agents} selectedId={agentId} onSelectAgent={openAgent} onSelectRoom={openRoom} />
      ) : (
        <Skeleton className="aspect-[720/656] w-full" />
      )}
    </section>
  )
}
