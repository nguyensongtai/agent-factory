'use client'

import { useFactory } from '../../context/FactoryProvider'

// First-run hint: the transcript folder does not exist yet (Claude Code never ran, or the path is wrong).
export default function SetupNotice() {
  const { snapshot } = useFactory()
  if (!snapshot || snapshot.health.projectsDirFound) return null

  return (
    <div role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-semibold">Chưa thấy thư mục transcript của Claude Code</p>
      <p className="mt-1 text-amber-100/80">
        Đang tìm ở <code className="rounded bg-black/30 px-1 font-mono">{snapshot.health.projectsDir}</code>. Hãy chạy Claude
        Code ít nhất một lần trên máy này, hoặc đặt <code className="rounded bg-black/30 px-1 font-mono">CLAUDE_PROJECTS_DIR</code>{' '}
        trong <code className="rounded bg-black/30 px-1 font-mono">.env.local</code> rồi khởi động lại server.
      </p>
    </div>
  )
}
