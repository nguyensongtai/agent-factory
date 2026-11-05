import type { StationId } from '../domain/types'
import { findPath, type WalkGrid } from './grid'
import { TILE, coreRect, doorTiles, type FloorLayout, type Tile } from './layout'

export type Point = { x: number; y: number }

// A glowing data line from the AI core to a room door, routed along the hallways like a circuit trace.
export type Trace = {
  station: StationId
  points: Point[]
  // Cumulative length at each point, for placing pulses along the line.
  lengths: number[]
  total: number
  badge: Point
}

// Traces share hallways; a small lane offset keeps them side by side instead of on top of each other.
const LANES = [0, -2, 2]

function centre(tile: Tile, lane = 0): Point {
  return { x: tile.col * TILE + TILE / 2 + lane, y: tile.row * TILE + TILE / 2 + lane }
}

function corners(points: Point[]): Point[] {
  return points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return true
    const a = points[i - 1]
    const b = points[i + 1]

    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y))
  })
}

export function buildTraces(layout: FloorLayout, grid: WalkGrid): Trace[] {
  const hub = layout.rooms.orchestration
  const core = coreRect(hub)
  // The floor tile just below the core platform, where every trace leaves the core.
  const start = { col: Math.round((core.x + core.w / 2) / TILE), row: (core.y + core.h) / TILE }
  const traces: Trace[] = []

  Object.values(layout.rooms).forEach((room, index) => {
    if (room.station.id === 'orchestration') return
    const lane = LANES[index % LANES.length]
    const door = doorTiles(room)[1]
    const outside = { col: door.col, row: door.row + 1 }
    const tiles = [start, ...findPath(grid, start, outside), door]
    const origin = centre(start, lane)
    const points = corners([{ x: origin.x, y: core.y + core.h - 2 }, ...tiles.map((t) => centre(t, lane))])
    const lengths = [0]
    for (let i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y))
    }
    traces.push({ station: room.station.id, points, lengths, total: lengths[lengths.length - 1], badge: centre(outside) })
  })

  return traces
}

export function pointAt(trace: Trace, distanceAlong: number): Point {
  const { points, lengths } = trace
  let i = 1
  while (i < points.length - 1 && lengths[i] < distanceAlong) i++
  const a = points[i - 1]
  const b = points[i]
  const span = lengths[i] - lengths[i - 1] || 1
  const k = Math.max(0, Math.min(1, (distanceAlong - lengths[i - 1]) / span))

  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}
