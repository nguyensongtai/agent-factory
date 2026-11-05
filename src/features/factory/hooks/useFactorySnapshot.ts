'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { FactorySnapshot } from '../domain/types'

const POLL_MS = 1500

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

    const load = async () => {
      clearTimeout(timer)
      const startedAt = performance.now()
      try {
        const res = await fetch('/api/agents', { cache: 'no-store' })
        const body = (await res.json()) as FactorySnapshot | { error: string }
        if (cancelled) return
        setRttMs(Math.round(performance.now() - startedAt))
        if ('error' in body) setError(body.error)
        else {
          setSnapshot(body)
          setError(null)
        }
      } catch (err) {
        console.error('[factory] poll failed', err)
        if (!cancelled) setError('Mất kết nối tới server xưởng')
      }
      // Pause while the tab is hidden; resume on the next visibility change.
      if (!cancelled && document.visibilityState === 'visible') timer = setTimeout(load, POLL_MS)
    }
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
