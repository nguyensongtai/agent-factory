// Shared loading / empty / error placeholders so every view handles the three states the same way.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-800/60 ${className}`} />
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      <span aria-hidden className="text-2xl opacity-70">
        {icon}
      </span>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {hint && <p className="max-w-xs text-sm text-slate-500">{hint}</p>}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      <span aria-hidden>⚠️</span>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="cursor-pointer rounded-md px-2 py-0.5 font-semibold hover:bg-rose-500/20">
          Thử lại
        </button>
      )}
    </div>
  )
}
