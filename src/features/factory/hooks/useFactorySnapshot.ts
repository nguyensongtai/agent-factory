'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { FactorySnapshot } from '../domain/types'

const POLL_MS = 1500
// A background tab keeps polling, more slowly, so agents waiting for the user are still noticed.
const HIDDEN_POLL_MS = 5000

export type FactoryFeed = {
  snapshot: FactorySnapshot | null
  error: string | null
  // Round trip of the last poll, measured in the browser.
  rttMs: number
  retry: () => void
}

export function useFactorySnapshot(): FactoryFeed {
  const [snapshot, setSnapshot] = useState<FactorySnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rttMs, setRttMs] = useState(0)
  const loadRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    // Only the latest load schedules the next one, so an early reload (tab shown, retry) never leaves
    // two polling loops running.
    let latest = 0

    const load = async () => {
      clearTimeout(timer)
      const id = ++latest
      const startedAt = performance.now()
      try {
        const res = await fetch('/api/agents', { cache: 'no-store' })
        const body = (await res.json()) as FactorySnapshot | { error: string }
        if (cancelled || id !== latest) return
        setRttMs(Math.round(performance.now() - startedAt))
        if ('error' in body) setError(body.error)
        else {
          setSnapshot(body)
          setError(null)
        }
      } catch (err) {
        if (cancelled || id !== latest) return
        console.error('[factory] poll failed', err)
        setError('Mất kết nối tới server làng')
      }
      timer = setTimeout(load, document.visibilityState === 'visible' ? POLL_MS : HIDDEN_POLL_MS)
    }
    // Back in front: refresh now instead of waiting out the slow timer.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }

    loadRef.current = load
    load()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const retry = useCallback(() => loadRef.current(), [])

  return { snapshot, error, rttMs, retry }
}
