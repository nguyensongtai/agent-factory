type Props = {
  label: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom'
  // `end` anchors the tooltip's right edge to the trigger so it opens leftwards (for triggers near the right edge).
  align?: 'center' | 'end'
}

// CSS-only tooltip: shows on hover and on keyboard focus of anything inside. Hidden with display:none so it
// never widens the page while invisible.
export default function Tooltip({ label, children, side = 'top', align = 'center' }: Props) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 hidden w-max max-w-64 rounded-md border border-line bg-slate-900 px-2 py-1 text-xs font-normal normal-case tracking-normal text-slate-200 shadow-lg group-hover/tip:block group-focus-within/tip:block ${
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } ${align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
      >
        {label}
      </span>
    </span>
  )
}
