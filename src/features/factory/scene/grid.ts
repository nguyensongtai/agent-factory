import type { StationId } from '../domain/types'

import { TILE, WALL_H, coreRect, doorTiles, type FloorLayout, type Tile } from './layout'

const HALLWAY = -1
const BLOCKED = -2

export type { Tile }

// Walkability map in the spirit of pixel-agents' tile map: hallway tiles connect everything,
// a room's floor belongs to that room, its back wall and the AI core are solid, and a step between a room and
// the hallway is only allowed through one of the room's doors.
export type WalkGrid = {
  cols: number
  rows: number
  area: Int16Array
  doors: Set<number>
  floors: Partial<Record<StationId, Tile[]>>
}

const edge = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a)

export function buildGrid(layout: FloorLayout): WalkGrid {
  const cols = layout.width / TILE
  const rows = layout.height / TILE
  const area = new Int16Array(cols * rows).fill(HALLWAY)
  const doors = new Set<number>()
  const floors: Partial<Record<StationId, Tile[]>> = {}

  Object.values(layout.rooms).forEach((room, index) => {
    const c0 = room.x / TILE
    const r0 = room.y / TILE
    const wallRows = WALL_H / TILE
    const core = room.station.id === 'orchestration' ? coreRect(room) : null
    const onCore = (c: number, r: number) =>
      core !== null && c * TILE >= core.x && c * TILE < core.x + core.w && r * TILE >= core.y && r * TILE < core.y + core.h
    const floor: Tile[] = []
    for (let r = r0; r < r0 + room.h / TILE; r++) {
      for (let c = c0; c < c0 + room.w / TILE; c++) {
        const isWall = r < r0 + wallRows || onCore(c, r)
        area[r * cols + c] = isWall ? BLOCKED : index
        if (!isWall) floor.push({ col: c, row: r })
      }
    }
    floors[room.station.id] = floor
    for (const door of doorTiles(room)) {
      const inside = door.row * cols + door.col
      doors.add(edge(inside, inside + cols))
    }
  })

  return { cols, rows, area, doors, floors }
}

export function tileIndex(grid: WalkGrid, tile: Tile): number {
  return tile.row * grid.cols + tile.col
}

function canStep(grid: WalkGrid, from: number, to: number): boolean {
  const target = grid.area[to]
  if (target === BLOCKED) return false

  return grid.area[from] === target || grid.doors.has(edge(from, to))
}

// Breadth-first search on the 4-connected grid (no diagonals). Path excludes the start tile.
export function findPath(grid: WalkGrid, start: Tile, end: Tile): Tile[] {
  const from = tileIndex(grid, start)
  const to = tileIndex(grid, end)
  if (from === to || grid.area[to] === BLOCKED) return []

  const parent = new Int32Array(grid.cols * grid.rows).fill(-1)
  parent[from] = from
  const queue = new Int32Array(grid.cols * grid.rows)
  let head = 0
  let tail = 0
  queue[tail++] = from

  while (head < tail) {
    const current = queue[head++]
    if (current === to) break
    const col = current % grid.cols
    const neighbours = [
      col > 0 ? current - 1 : -1,
      col < grid.cols - 1 ? current + 1 : -1,
      current - grid.cols,
      current + grid.cols,
    ]
    for (const next of neighbours) {
      if (next < 0 || next >= parent.length || parent[next] !== -1) continue
      if (!canStep(grid, current, next)) continue
      parent[next] = current
      queue[tail++] = next
    }
  }
  if (parent[to] === -1) return []

  const path: Tile[] = []
  for (let i = to; i !== from; i = parent[i]) path.push({ col: i % grid.cols, row: Math.floor(i / grid.cols) })

  return path.reverse()
}
