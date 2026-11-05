import StatCard from '@/components/ui/StatCard'

import { compact, duration, percent, usd } from '../../domain/format'
import { successRate, type Summary } from '../../domain/metrics'
import { STATUS_COLOR, STATUS_LABEL } from '../../domain/stations'
import type { AgentSnapshot, AgentStatus, LatencyStats } from '../../domain/types'

const STATUSES: AgentStatus[] = ['working', 'thinking', 'asking', 'idle']

type Props = { summary: Summary; agents: AgentSnapshot[]; latency: LatencyStats }

export default function KpiGrid({ summary, agents, latency }: Props) {
  const rate = successRate(summary.calls, summary.errors)
  const finished = summary.completed + summary.failed

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Agent" value={summary.sessions} sub={`+ ${summary.subagents} subagent đang chạy`} />

      <StatCard label="Đang hoạt động" value={summary.active} accent="#4ade80" sub={`trên ${summary.sessions} phiên`}>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
          {STATUSES.map((status) => {
            const count = agents.filter((a) => a.status === status).length

            return count > 0 ? (
              <div key={status} title={STATUS_LABEL[status]} style={{ flex: count, background: STATUS_COLOR[status] }} />
            ) : null
          })}
        </div>
      </StatCard>

      <StatCard
        label="Nhiệm vụ đang chạy"
        value={summary.running}
        accent="#22d3ee"
        sub={summary.approval > 0 ? <span className="text-rose-300">{summary.approval} chờ bạn duyệt</span> : 'không có gì chờ duyệt'}
        help="Lượt yêu cầu, lần chạy subagent và mục kế hoạch đang thực hiện."
      />

      <StatCard
        label="Xong / Thất bại"
        value={
          <>
            {summary.completed}
            <span className="text-slate-500"> / </span>
            <span className={summary.failed > 0 ? 'text-rose-300' : ''}>{summary.failed}</span>
          </>
        }
        accent="#a78bfa"
        sub={`tỉ lệ xong ${percent(summary.completed, finished)}`}
        help={`Tính trên các nhiệm vụ còn trong cửa sổ theo dõi. Thất bại = bị dừng giữa chừng, lỗi API hoặc phiên tắt khi đang chạy.`}
      />

      <StatCard
        label="Token · 1 giờ"
        value={compact(summary.tokens)}
        accent="#facc15"
        sub={`≈ ${usd(summary.cost)} theo giá API`}
        help="Ước tính theo bảng giá API công khai, gồm cả token đọc/ghi cache. Dùng Claude Code bằng gói đăng ký thì không bị tính tiền theo token."
      />

      <StatCard
        label="Hiệu suất · 1 giờ"
        value={rate === null ? '–' : `${Math.round(rate * 100)}%`}
        accent="#2dd4bf"
        sub={`tool thành công · phản hồi p50 ${duration(latency.p50)}`}
        help="Tỉ lệ lượt gọi tool không lỗi trong 1 giờ qua. Phản hồi p50 = thời gian từ lúc gửi yêu cầu API tới khi có khối trả lời đầu tiên."
      />
    </div>
  )
}
