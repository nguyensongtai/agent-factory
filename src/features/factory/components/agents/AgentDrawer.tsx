'use client'

import Sheet from '@/components/ui/Sheet'

import { compact, duration, percent, timeAgo, totalTokens, usd } from '../../domain/format'
import { roleOf, STATION_BY_ID } from '../../domain/stations'
import { useFactory } from '../../context/FactoryProvider'
import CopyCommand from '../common/CopyCommand'
import PixelAvatar from '../common/PixelAvatar'
import RankBadge from '../common/RankBadge'
import StatusBadge from '../common/StatusBadge'
import { ExecutionHistory, Permissions, PlanList, Powers, Section, Subagents, UsageByModel } from './AgentSections'

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-line bg-void/60 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="truncate font-display text-lg font-semibold text-slate-50 tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export default function AgentDrawer() {
  const { agentId, openAgent, snapshot } = useFactory()
  const agent = snapshot?.agents.find((a) => a.id === agentId) ?? null
  const now = snapshot?.generatedAt ?? 0

  return (
    <Sheet
      open={agent !== null}
      onClose={() => openAgent(null)}
      title={
        agent && (
          <div className="flex items-start gap-3">
            <PixelAvatar agent={agent} size={44} />
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-snug text-slate-50">{agent.title}</h2>
              <p className="truncate text-sm text-slate-400" title={agent.cwd}>
                {agent.project}
                {agent.gitBranch ? ` · ${agent.gitBranch}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <RankBadge agent={agent} withRule />
                <StatusBadge status={agent.status} />
                <span>
                  {STATION_BY_ID[agent.station].icon} {STATION_BY_ID[agent.station].label}
                </span>
                <span>· {timeAgo(agent.lastActivityAt, now)}</span>
              </div>
            </div>
          </div>
        )
      }
      footer={agent && <CopyCommand command={`cd "${agent.cwd}" && claude --resume ${agent.id}`} label="Chép lệnh mở lại phiên" />}
    >
      {agent && (
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-2 p-4">
            <Stat label="Vai trò" value={roleOf(agent.zones)} sub={agent.automated ? 'phiên SDK tự động' : 'phiên Claude Code'} />
            <Stat label="Model" value={agent.model.replace('claude-', '') || '–'} />
            <Stat
              label="Token cả phiên"
              value={compact(totalTokens(agent.usage.tokens))}
              sub={`≈ ${usd(agent.usage.cost)} theo giá API`}
            />
            <Stat
              label="Tool thành công"
              value={percent(agent.toolCount - agent.errorCount, agent.toolCount)}
              sub={`${agent.toolCount} lượt · ${agent.errorCount} lỗi`}
            />
            <Stat label="Phản hồi API" value={duration(agent.latency.p50)} sub={`p95 ${duration(agent.latency.p95)}`} />
            <Stat label="Thời gian 1 tool" value={duration(agent.avgToolMs)} sub="trung bình" />
          </div>

          {(agent.current || agent.lastPrompt) && (
            <Section title="Đang làm">
              {agent.current && (
                <p className="mb-2 rounded-md bg-cyan-400/5 px-3 py-2 font-mono text-sm break-all text-cyan-100">
                  {agent.current.name} {agent.current.detail}
                </p>
              )}
              {agent.lastPrompt && <p className="line-clamp-4 text-sm text-slate-300">“{agent.lastPrompt}”</p>}
            </Section>
          )}
          <PlanList plan={agent.plan} />
          <Subagents agent={agent} />
          <ExecutionHistory calls={agent.recent} now={now} />
          <Powers powers={agent.powers} />
          <Permissions permissions={agent.permissions} />
          <UsageByModel usage={agent.usage} />
        </div>
      )}
    </Sheet>
  )
}
