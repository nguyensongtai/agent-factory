'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { STATIONS } from '../../domain/stations'
import type { AgentSnapshot, StationId } from '../../domain/types'
import { createScene, hitTest, stepScene, syncEntities } from '../../scene/entities'
import { buildGrid } from '../../scene/grid'
import { layoutFloor, roomAt } from '../../scene/layout'
import { drawEntities } from '../../scene/render/agents'
import { drawCore } from '../../scene/render/core'
import { drawEffects, drawLinks } from '../../scene/render/effects'
import { drawRooms, drawTraces, renderStaticFloor, type RoomState } from '../../scene/render/floor'
import { buildTraces } from '../../scene/traces'
import MapTooltip from './MapTooltip'

// A failed call lights its room red for a short while.
const ERROR_WINDOW_MS = 20_000

type Props = {
  agents: AgentSnapshot[]
  selectedId: string | null
  onSelectAgent: (id: string) => void
  onSelectRoom: (id: StationId) => void
}

type Hover = { entityId: string | null; roomId: StationId | null; x: number; y: number }

export default function FloorView({ agents, selectedId, onSelectAgent, onSelectRoom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(createScene())
  const selectedRef = useRef(selectedId)
  const hoveredRef = useRef<string | null>(null)
  const countsRef = useRef({ active: 0, total: 0 })
  const errorsRef = useRef(new Map<StationId, number>())
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<Hover | null>(null)

  // Below ~600 px the 4-column floor makes labels unreadable, so narrow screens get a taller 2-column floor.
  const cols = width > 0 && width < 600 ? 2 : 4
  const restingCount = agents.filter((a) => a.station === 'resources').length
  const layout = useMemo(() => layoutFloor(cols, restingCount), [cols, restingCount])
  const grid = useMemo(() => buildGrid(layout), [layout])
  const traces = useMemo(() => buildTraces(layout, grid), [layout, grid])
  const layoutRef = useRef(layout)
  const scale = width > 0 ? width / layout.width : 1

  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Measure once up front: ResizeObserver never fires in a background tab.
    setWidth(Math.floor(el.clientWidth))
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (width === 0) return
    // A floor re-layout teleports everyone instead of making them walk across the new map.
    const teleport = layoutRef.current !== layout
    layoutRef.current = layout
    const now = performance.now()
    syncEntities(sceneRef.current, agents, layout, grid, teleport, now)
    countsRef.current = { active: agents.filter((a) => a.status !== 'idle').length, total: agents.length }
    // Convert wall-clock failure times to the animation clock.
    const errors = new Map<StationId, number>()
    const wallNow = Date.now()
    for (const call of agents.flatMap((a) => [...a.recent.slice(0, 5), ...a.subagents.flatMap((s) => s.recent.slice(0, 3))])) {
      const at = call.endedAt || call.at
      if (call.isError && wallNow - at < ERROR_WINDOW_MS) {
        errors.set(call.station, Math.max(errors.get(call.station) ?? -Infinity, now - (wallNow - at)))
      }
    }
    errorsRef.current = errors
  }, [agents, layout, grid, width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return
    const zoom = scale * (window.devicePixelRatio || 1)
    canvas.width = Math.round(layout.width * zoom)
    canvas.height = Math.round(layout.height * zoom)
    const ctx = canvas.getContext('2d')!
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-vt323') || 'monospace'
    let frame = 0
    let last = performance.now()

    const paint = (floor: HTMLCanvasElement, now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const scene = sceneRef.current
      stepScene(scene, dt, grid, now)
      const rooms = new Map<StationId, RoomState>()
      for (const e of scene.entities.values()) {
        const state = rooms.get(e.station) ?? { count: 0, working: 0, alert: false, errorAt: -Infinity }
        state.count += 1
        if (e.status !== 'idle') state.working += 1
        state.alert ||= e.status === 'asking'
        rooms.set(e.station, state)
      }
      for (const [station, at] of errorsRef.current) {
        const state = rooms.get(station) ?? { count: 0, working: 0, alert: false, errorAt: -Infinity }
        state.errorAt = at
        rooms.set(station, state)
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(floor, 0, 0)
      ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
      ctx.imageSmoothingEnabled = false
      drawTraces(ctx, traces, rooms, now)
      drawRooms(ctx, layout, now, font, rooms)
      drawCore(ctx, layout.rooms.orchestration, now, font, countsRef.current.active, countsRef.current.total)
      drawLinks(ctx, scene.entities, now)
      drawEntities(ctx, scene.entities, now, font, selectedRef.current, hoveredRef.current)
      drawEffects(ctx, scene.effects, now)
      frame = requestAnimationFrame((t) => paint(floor, t))
    }
    let cancelled = false
    document.fonts.ready.then(() => {
      if (cancelled) return
      // Plaques use the pixel font, so the static floor waits for it.
      const floor = renderStaticFloor(layout, zoom, font)
      frame = requestAnimationFrame((t) => paint(floor, t))
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [layout, grid, traces, scale, width])

  const locate = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - box.left
    const py = event.clientY - box.top
    const x = px / scale
    const y = py / scale

    return { px, py, entity: hitTest(sceneRef.current.entities, x, y), room: roomAt(layout, x, y) }
  }

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { entity, room } = locate(event)
    if (entity) onSelectAgent(entity.ownerId)
    else if (room) onSelectRoom(room)
  }

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, entity, room } = locate(event)
    hoveredRef.current = entity?.id ?? null
    setHover(entity || room ? { entityId: entity?.id ?? null, roomId: entity ? null : room, x: px, y: py } : null)
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Sàn nhà máy: ${agents.length} phiên Claude Code trong 8 khu`}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => {
          hoveredRef.current = null
          setHover(null)
        }}
        className={`block w-full rounded-md [image-rendering:pixelated] ${hover ? 'cursor-pointer' : ''}`}
        style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      />
      {hover && <MapTooltip hover={hover} agents={agents} />}
      <ul className="sr-only">
        {STATIONS.map((station) => (
          <li key={station.id}>
            <button type="button" onClick={() => onSelectRoom(station.id)}>
              Xem {station.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
