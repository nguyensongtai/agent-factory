'use client'

import { createContext, useContext, useMemo, useState } from 'react'

import type { AgentSnapshot, FactorySnapshot, StationId } from '../domain/types'
import { useFactorySnapshot } from '../hooks/useFactorySnapshot'

type FactoryContextValue = {
  snapshot: FactorySnapshot | null
  error: string | null
  rttMs: number
  retry: () => void
  // Sessions shown everywhere: finished SDK runs are hidden unless asked for.
  agents: AgentSnapshot[]
  hiddenAutomated: number
  showAutomated: boolean
  toggleAutomated: () => void
  agentId: string | null
  openAgent: (id: string | null) => void
  roomId: StationId | null
  openRoom: (id: StationId | null) => void
}

const FactoryContext = createContext<FactoryContextValue | null>(null)

// One poll feeds every page; the agent and room drawers can be opened from anywhere.
export function FactoryProvider({ children }: { children: React.ReactNode }) {
  const { snapshot, error, rttMs, retry } = useFactorySnapshot()
  const [showAutomated, setShowAutomated] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<StationId | null>(null)

  const value = useMemo<FactoryContextValue>(() => {
    const all = snapshot?.agents ?? []
    const finishedSdk = (a: AgentSnapshot) => a.automated && a.status === 'idle'

    return {
      snapshot,
      error,
      rttMs,
      retry,
      agents: showAutomated ? all : all.filter((a) => !finishedSdk(a)),
      hiddenAutomated: all.filter(finishedSdk).length,
      showAutomated,
      toggleAutomated: () => setShowAutomated((v) => !v),
      agentId,
      openAgent: (id) => {
        setRoomId(null)
        setAgentId(id)
      },
      roomId,
      openRoom: (id) => {
        setAgentId(null)
        setRoomId(id)
      },
    }
  }, [snapshot, error, rttMs, retry, showAutomated, agentId, roomId])

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>
}

export function useFactory(): FactoryContextValue {
  const value = useContext(FactoryContext)
  if (!value) throw new Error('useFactory must be used inside <FactoryProvider>')

  return value
}
