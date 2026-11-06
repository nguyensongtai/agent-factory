'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { clock } from '../../domain/format'
import { allMissions, countByStatus } from '../../domain/metrics'
import { useFactory } from '../../context/FactoryProvider'

const NAV = [
  { href: '/', label: 'Tổng quan', icon: '🏭' },
  { href: '/agents', label: 'Ninja', icon: '🥷' },
  { href: '/missions', label: 'Nhiệm vụ', icon: '🎯' },
  { href: '/monitoring', label: 'Giám sát', icon: '📡' },
] as const

export default function ConsoleHeader() {
  const pathname = usePathname()
  const { snapshot, error, agents, hiddenAutomated, showAutomated, toggleAutomated } = useFactory()
  const live = snapshot !== null && !error
  const approvals = countByStatus(allMissions(agents)).approval
  const recentErrors = snapshot?.timeline.reduce((n, p) => n + p.errors, 0) ?? 0
  const badges: Record<string, { count: number; color: string; hint: string } | null> = {
    '/missions': approvals > 0 ? { count: approvals, color: '#fb7185', hint: 'đang chờ duyệt' } : null,
    '/monitoring': recentErrors > 0 ? { count: recentErrors, color: '#f59e0b', hint: 'lỗi trong 1 giờ' } : null,
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-void/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand.svg" alt="" width={28} height={28} priority className="[image-rendering:pixelated]" />
          <span className="font-display text-lg font-bold uppercase tracking-[0.14em] text-cyan-50">Làng Ninja AI</span>
        </Link>

        <nav aria-label="Trang" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const badge = badges[item.href]

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-cyan-400/12 text-cyan-100' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
                {badge && (
                  <span
                    className="rounded-full px-1.5 text-xs font-bold text-slate-950"
                    style={{ background: badge.color }}
                    aria-label={`${badge.count} ${badge.hint}`}
                  >
                    {badge.count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {hiddenAutomated > 0 && (
            <button
              type="button"
              onClick={toggleAutomated}
              aria-pressed={showAutomated}
              className="hidden cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5 sm:block"
            >
              {showAutomated ? 'Ẩn' : 'Hiện'} {hiddenAutomated} phiên SDK đã xong
            </button>
          )}
          <span
            role="status"
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${
              live ? 'border-emerald-400/30 text-emerald-300' : 'border-rose-400/40 text-rose-300'
            }`}
          >
            <span className={`size-2 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-rose-400'}`} />
            {live ? `Trực tiếp · ${clock(snapshot.generatedAt)}` : (error ?? 'Đang kết nối…')}
          </span>
        </div>
      </div>
    </header>
  )
}
