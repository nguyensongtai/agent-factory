'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import { newlyAsking, statusesOf, waitingCount, withWaitingCount } from '../domain/alerts'
import type { AgentSnapshot, AgentStatus } from '../domain/types'

// on: the user turned alerts on and the browser allows them. Permission is only ever requested from
// the header toggle, never on page load.
export type NotifyState = 'unsupported' | 'denied' | 'off' | 'on'

const PREF_KEY = 'lang-ninja:notify-asking'
const listeners = new Set<() => void>()

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

function writePref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  for (const listener of listeners) listener()
}

function readState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'

  return Notification.permission === 'granted' && readPref() ? 'on' : 'off'
}

// Re-read on focus too: permission can be changed from the browser's site settings.
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  window.addEventListener('focus', listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
    window.removeEventListener('focus', listener)
  }
}

function show(title: string, body: string, tag: string, onClick: () => void): void {
  try {
    const notification = new Notification(title, { body, tag, icon: '/icon-192.png' })
    notification.onclick = () => {
      window.focus()
      onClick()
      notification.close()
    }
  } catch (error) {
    // Some browsers only allow notifications from a service worker.
    console.error('[factory] notification failed', error)
  }
}

// Tells the user when an agent or subagent starts waiting for them: a browser notification (if turned
// on) and the waiting count in front of the tab title.
export function useAskingAlerts(agents: AgentSnapshot[] | null, openAgent: (id: string) => void) {
  const notify = useSyncExternalStore<NotifyState>(subscribe, readState, () => 'unsupported')
  const previous = useRef<Map<string, AgentStatus> | null>(null)

  useEffect(() => {
    if (!agents) return
    const alerts = newlyAsking(previous.current, agents)
    previous.current = statusesOf(agents)
    if (notify !== 'on') return
    for (const alert of alerts) {
      const body = alert.detail ? `${alert.name}: ${alert.detail}` : `${alert.name} đang chờ bạn trả lời`
      show('Ninja đang chờ bạn', body, `asking:${alert.key}`, () => openAgent(alert.agentId))
    }
  }, [agents, notify, openAgent])

  const waiting = agents ? waitingCount(agents) : 0
  useEffect(() => {
    // Next.js rewrites the title on every navigation; put the count back each time it does.
    const apply = () => {
      const title = withWaitingCount(document.title, waiting)
      if (title !== document.title) document.title = title
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })

    return () => {
      observer.disconnect()
      document.title = withWaitingCount(document.title, 0)
    }
  }, [waiting])

  const toggleNotify = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    if (readState() === 'on') return writePref(false)
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    writePref(permission === 'granted')
  }, [])

  return { notify, toggleNotify, waiting }
}
