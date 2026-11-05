'use client'

import { useCallback, useEffect, useState } from 'react'

import type { ManualMission } from '../domain/types'

type Patch = Partial<Pick<ManualMission, 'title' | 'description' | 'agentId' | 'status'>>

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  })
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`)

  return body
}

// Missions the user creates by hand, stored by the local server in .data/missions.json.
export function useManualMissions() {
  const [missions, setMissions] = useState<ManualMission[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setMissions(await request<ManualMission[]>('/api/missions'))
      setError(null)
    } catch (err) {
      console.error('[missions] load failed', err)
      setError(err instanceof Error ? err.message : 'Không tải được nhiệm vụ')
    }
  }, [])

  useEffect(() => {
    // Initial fetch; later updates come from the mutations below.
    let cancelled = false
    request<ManualMission[]>('/api/missions').then(
      (list) => {
        if (!cancelled) setMissions(list)
      },
      (err: unknown) => {
        console.error('[missions] load failed', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được nhiệm vụ')
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback(
    async (input: { title: string; description: string; agentId: string | null }) => {
      await request<ManualMission>('/api/missions', { method: 'POST', body: JSON.stringify(input) })
      await reload()
    },
    [reload],
  )

  const update = useCallback(
    async (id: string, patch: Patch) => {
      try {
        await request<ManualMission>(`/api/missions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      } catch (err) {
        console.error('[missions] update failed', err)
        setError(err instanceof Error ? err.message : 'Không cập nhật được nhiệm vụ')
      }
      await reload()
    },
    [reload],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await request<void>(`/api/missions/${id}`, { method: 'DELETE' })
      } catch (err) {
        console.error('[missions] delete failed', err)
        setError(err instanceof Error ? err.message : 'Không xoá được nhiệm vụ')
      }
      await reload()
    },
    [reload],
  )

  return { missions, error, reload, create, update, remove }
}
