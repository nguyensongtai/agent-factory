'use client'

import { useState } from 'react'

// A shell command the user runs themselves; the dashboard never starts processes.
export default function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.error('[factory] copy command failed', error)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? 'Chép lệnh'}
      className="w-full cursor-pointer rounded-md border border-line bg-void px-3 py-2 text-left font-mono text-xs break-all text-slate-300 hover:border-cyan-400/40"
    >
      {copied ? '✓ Đã chép' : command}
    </button>
  )
}
