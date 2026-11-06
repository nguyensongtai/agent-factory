'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { allMissions, countByStatus } from '../../domain/metrics'
import { STATIONS } from '../../domain/stations'
import type { AgentSnapshot, StationId } from '../../domain/types'
import { createScene, hitTest, syncEntities } from '../../scene/entities'
import { buildGrid } from '../../scene/grid'
import { layoutFloor, roomAt } from '../../scene/layout'
import { missionBoardRect } from '../../scene/render/core'
import { renderStaticFloor } from '../../scene/render/dojo'
import { paintFrame } from '../../scene/render/frame'
import type { LightMaps } from '../../scene/render/lighting'
import { buildTraces } from '../../scene/traces'
import MapTooltip from './MapTooltip'

// A failed call lights its room red for a short while.
const ERROR_WINDOW_MS = 20_000
// Sticky header plus the map card's title row and padding: the floor must fit the window below them.
const PAGE_CHROME = 128

type Props = {
  agents: AgentSnapshot[]
  selectedId: string | null
  onSelectAgent: (id: string) => void
  onSelectRoom: (id: StationId) => void
}

type Hover = {
  entityId: string | null
  roomId: StationId | null
  board: boolean
  x: number
  y: number
}

export default function FloorView({ agents, selectedId, onSelectAgent, onSelectRoom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef(createScene())
  const selectedRef = useRef(selectedId)
  const hoveredRef = useRef<string | null>(null)
  const boardRef = useRef({ busy: false, board: { running: 0, approval: 0, completed: 0 } })
  const router = useRouter()
  const errorsRef = useRef(new Map<StationId, number>())
  const [width, setWidth] = useState(0)
  const [windowH, setWindowH] = useState(0)
  const [hover, setHover] = useState<Hover | null>(null)

  // Below ~600 px the 4-column floor makes agents too small, so narrow screens get a taller 2-column floor.
  const cols = width > 0 && width < 600 ? 2 : 4
  const restingCount = agents.filter((a) => a.station === 'resources').length
  const layout = useMemo(() => layoutFloor(cols, restingCount), [cols, restingCount])
  const grid = useMemo(() => buildGrid(layout), [layout])
  const traces = useMemo(() => buildTraces(layout, grid), [layout, grid])
  const layoutRef = useRef(layout)
  // CSS px per logical floor px: the whole floor fits the card width and, on wide screens, the window height
  // too, so every room is visible at once. The tall 2-column phone layout scrolls instead.
  const maxH = cols === 4 && windowH > 0 ? windowH - PAGE_CHROME : Infinity
  const scale = width > 0 ? Math.min(width / layout.width, maxH / layout.height) : 1
  const cssW = Math.floor(layout.width * scale)

  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Measure once up front: ResizeObserver never fires in a background tab.
    setWidth(Math.floor(el.clientWidth))
    setWindowH(window.innerHeight)
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    const onResize = () => setWindowH(window.innerHeight)
    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useEffect(() => {
    if (width === 0) return
    // A floor re-layout teleports everyone instead of making them walk across the new map.
    const teleport = layoutRef.current !== layout
    layoutRef.current = layout
    const now = performance.now()
    syncEntities(sceneRef.current, agents, layout, grid, teleport, now)
    const missions = countByStatus(allMissions(agents))
    boardRef.current = {
      busy: agents.some((a) => a.status !== 'idle'),
      board: { running: missions.running, approval: missions.approval, completed: missions.completed },
    }
    // Convert wall-clock failure times to the animation clock.
    const errors = new Map<StationId, number>()
    const wallNow = Date.now()
    for (const call of agents.flatMap((a) => [
      ...a.recent.slice(0, 5),
      ...a.subagents.flatMap((s) => s.recent.slice(0, 3)),
    ])) {
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
    // Paint at a whole number of device pixels per floor pixel (rounded up) and let the browser scale the
    // result down to the layout width: every pixel stays the same size instead of some doubling.
    const pixel = Math.max(1, Math.ceil(scale * (window.devicePixelRatio || 1)))
    canvas.width = layout.width * pixel
    canvas.height = layout.height * pixel
    const ctx = canvas.getContext('2d')!
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-vt323') || 'monospace'
    const floor = renderStaticFloor(layout)
    let lights: LightMaps | null = null
    let frame = 0
    let last = performance.now()

    const paint = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const input = {
        layout,
        grid,
        traces,
        floor,
        scene: sceneRef.current,
        errors: errorsRef.current,
        ...boardRef.current,
        font,
        selectedId: selectedRef.current,
        hoveredId: hoveredRef.current,
      }
      lights = paintFrame(ctx, input, pixel, lights, dt, now)
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)

    return () => cancelAnimationFrame(frame)
  }, [layout, grid, traces, width, scale])

  const locate = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - box.left
    const py = event.clientY - box.top
    const x = px / scale
    const y = py / scale
    const entity = hitTest(sceneRef.current.entities, x, y)
    const b = missionBoardRect(layout.rooms.orchestration)
    const board = !entity && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

    return { px, py, entity, board, room: roomAt(layout, x, y) }
  }

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { entity, board, room } = locate(event)
    if (entity) onSelectAgent(entity.ownerId)
    else if (board) router.push('/missions')
    else if (room) onSelectRoom(room)
  }

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, entity, board, room } = locate(event)
    hoveredRef.current = entity?.id ?? null
    setHover(
      entity || board || room
        ? { entityId: entity?.id ?? null, roomId: entity || board ? null : room, board, x: px, y: py }
        : null,
    )
  }

  return (
    <div ref={wrapRef} className="w-full">
      <div className="relative mx-auto" style={{ width: cssW || undefined }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Làng ninja: ${agents.length} phiên Claude Code trong 8 khu`}
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => {
            hoveredRef.current = null
            setHover(null)
          }}
          className={`block w-full rounded-md ${hover ? 'cursor-pointer' : ''}`}
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
        />
        {hover && <MapTooltip hover={hover} agents={agents} />}
      </div>
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
