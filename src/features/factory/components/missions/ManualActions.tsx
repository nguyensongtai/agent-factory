'use client'

import { useState } from 'react'

import { launchCommand } from '../../domain/missions'
import type { AgentSnapshot, ManualMission } from '../../domain/types'

type Props = {
  mission: ManualMission
  agents: AgentSnapshot[]
  onUpdate: (patch: Partial<Pick<ManualMission, 'agentId' | 'status'>>) => void
  onRemove: () => void
}

const BUTTON = 'cursor-pointer rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/5'

// Missions created by hand change state only when the user says so: the factory cannot see them run.
export default function ManualActions({ mission, agents, onUpdate, onRemove }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const agent = agents.find((a) => a.id === mission.agentId)
  const open = mission.status === 'backlog' || mission.status === 'assigned'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(launchCommand(mission, agent))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error('[missions] copy command failed', error)
    }
  }

  return (
    <>
      {open && (
        <select
          aria-label="Giao cho agent"
          value={mission.agentId ?? ''}
          onChange={(event) => onUpdate({ agentId: event.target.value || null })}
          className="max-w-40 cursor-pointer rounded border border-line bg-void px-1.5 py-1 text-xs text-slate-300"
        >
          <option value="">Chưa giao</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      {open && (
        <button type="button" onClick={handleCopy} className={`${BUTTON} text-cyan-200`}>
          {copied ? '✓ Đã chép' : '⧉ Chép lệnh'}
        </button>
      )}
      {open ? (
        <>
          <button type="button" onClick={() => onUpdate({ status: 'completed' })} className={BUTTON}>
            ✓ Xong
          </button>
          <button type="button" onClick={() => onUpdate({ status: 'failed' })} className={BUTTON}>
            ✕ Hỏng
          </button>
        </>
      ) : (
        <button type="button" onClick={() => onUpdate({ status: mission.agentId ? 'assigned' : 'backlog' })} className={BUTTON}>
          ↺ Mở lại
        </button>
      )}
      <button
        type="button"
        onClick={() => (confirming ? onRemove() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        className={`${BUTTON} ml-auto ${confirming ? 'bg-rose-500/20 text-rose-200' : 'text-slate-500'}`}
      >
        {confirming ? 'Xoá thật?' : 'Xoá'}
      </button>
    </>
  )
}
