import { duration } from '../../domain/format'
import type { SystemHealth } from '../../domain/types'

function uptime(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút`

  return `${Math.floor(seconds / 3600)} giờ ${Math.floor((seconds % 3600) / 60)} phút`
}

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

// The local server's own health: how long a scan takes, how much it holds in memory.
export default function HealthPanel({ health, rttMs }: { health: SystemHealth; rttMs: number }) {
  const healthy = health.scanMs < 1000 && rttMs < 2000
  const rows: [string, string][] = [
    ['Thời gian quét transcript', duration(health.scanMs)],
    ['Độ trễ cập nhật (trình duyệt)', duration(rttMs)],
    ['Phiên đang theo dõi', `${health.sessions}`],
    ['File subagent', `${health.subagentFiles}`],
    ['Đã đọc', megabytes(health.bytesRead)],
    ['Bộ nhớ server', `${health.rssMb} MB (heap ${health.heapMb} MB)`],
    ['Server chạy được', uptime(health.uptimeSec)],
    ['Cửa sổ theo dõi', `${health.windowHours} giờ`],
    ['Thư mục transcript', health.projectsDirFound ? health.projectsDir : 'không tìm thấy'],
  ]

  return (
    <section className="panel p-3" aria-labelledby="health-title">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="health-title" className="section-title">
          Sức khoẻ hệ thống
        </h2>
        <span className={`ml-auto flex items-center gap-1.5 text-xs font-semibold ${healthy ? 'text-emerald-300' : 'text-amber-300'}`}>
          <span className={`size-2 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {healthy ? 'Ổn định' : 'Chậm'}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-400">{label}</dt>
            <dd className="min-w-0 text-right break-all text-slate-200 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
