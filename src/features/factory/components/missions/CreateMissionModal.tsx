'use client'

import { useState } from 'react'

import Sheet from '@/components/ui/Sheet'

import type { AgentSnapshot } from '../../domain/types'

type Props = {
  open: boolean
  agents: AgentSnapshot[]
  onClose: () => void
  onCreate: (input: { title: string; description: string; agentId: string | null }) => Promise<void>
}

const FIELD =
  'w-full rounded-md border border-line bg-void px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none'

export default function CreateMissionModal({ open, agents, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Cần nhập tiêu đề')

      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({ title: title.trim(), description: description.trim(), agentId: agentId || null })
      setTitle('')
      setDescription('')
      setAgentId('')
      onClose()
    } catch (err) {
      console.error('[missions] create failed', err)
      setError(err instanceof Error ? err.message : 'Không tạo được nhiệm vụ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} variant="modal" title={<h2 className="text-lg font-bold text-slate-50">Tạo nhiệm vụ</h2>}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Tiêu đề
          <input
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            data-autofocus
            aria-invalid={error === 'Cần nhập tiêu đề'}
            placeholder="VD: Viết test cho trang thanh toán"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Mô tả <span className="text-xs text-slate-500">(sẽ thành lời nhắn gửi agent)</span>
          <textarea
            className={`${FIELD} min-h-28 resize-y`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Giao cho
          <select className={FIELD} value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            <option value="">Chưa giao (vào Backlog)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.title} · {agent.project}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Xưởng chỉ quan sát, không tự chạy agent. Sau khi tạo, bấm “Chép lệnh” trên thẻ rồi dán vào terminal để agent bắt đầu.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
            Huỷ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Đang tạo…' : 'Tạo nhiệm vụ'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
