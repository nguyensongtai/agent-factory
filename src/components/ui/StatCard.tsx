import Tooltip from './Tooltip'

type Props = {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: string
  help?: string
  children?: React.ReactNode
}

export default function StatCard({ label, value, sub, accent = '#22d3ee', help, children }: Props) {
  return (
    <section className="panel flex min-w-0 flex-col gap-1 p-3">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="size-1.5 rounded-full" style={{ background: accent }} />
        {label}
        {help && (
          <Tooltip label={help} align="end">
            <button type="button" aria-label={`Giải thích: ${label}`} className="cursor-help text-slate-500">
              ⓘ
            </button>
          </Tooltip>
        )}
      </h2>
      <p className="font-display text-2xl font-semibold leading-tight text-slate-50 tabular-nums md:text-3xl">{value}</p>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
      {children}
    </section>
  )
}
