'use client'

import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  // drawer slides in from the right; modal is centred.
  variant?: 'drawer' | 'modal'
  children: React.ReactNode
  footer?: React.ReactNode
}

// Native <dialog>: focus trap, Esc to close and inert background come for free.
export default function Sheet({ open, onClose, title, variant = 'drawer', children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first button (the close ×); prefer the field marked for it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const placement =
    variant === 'drawer'
      ? 'animate-slide-in ml-auto mr-0 h-dvh max-h-dvh w-full max-w-[480px] rounded-l-lg'
      : 'animate-pop m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg rounded-lg'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`sheet border border-line bg-deck p-0 text-slate-200 shadow-2xl shadow-black/60 ${placement}`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="flex items-start gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="-mr-1 cursor-pointer rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-white/5 hover:text-slate-100"
            >
              ×
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="border-t border-line px-4 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
