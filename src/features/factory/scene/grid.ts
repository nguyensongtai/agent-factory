import type { StationId } from '../domain/types'

import {
  BACKDROP_H,
  DESK_HALF_W,
  DESK_ROOMS,
  OUTER,
  TILE,
  WALL_H,
  coreRect,
  doorTiles,
  slotCount,
  slotTile,
  type FloorLayout,
  type RoomRect,
  type Tile,
} from './layout'

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

// Desks block the tile row just behind each seat, so walkers go round them instead of over them.
function deskTiles(room: RoomRect): Set<number> {
  const tiles = new Set<number>()
  if (!DESK_ROOMS.has(room.station.id)) return tiles
  for (let i = 0; i < slotCount(room); i++) {
    const seat = slotTile(room, i)
    const from = Math.floor((seat.col * TILE + TILE / 2 - DESK_HALF_W) / TILE)
    const to = Math.floor((seat.col * TILE + TILE / 2 + DESK_HALF_W - 1) / TILE)
    for (let c = from; c <= to; c++) tiles.add((seat.row - 1) * 65536 + c)
  }

  return tiles
}

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
    const desks = deskTiles(room)
    const onCore = (c: number, r: number) =>
      core !== null && c * TILE >= core.x && c * TILE < core.x + core.w && r * TILE >= core.y && r * TILE < core.y + core.h
    const floor: Tile[] = []
    for (let r = r0; r < r0 + room.h / TILE; r++) {
      for (let c = c0; c < c0 + room.w / TILE; c++) {
        const isWall = r < r0 + wallRows || onCore(c, r) || desks.has(r * 65536 + c)
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

  // The mountains and the outer trees are scenery; one tile of path is left along the forest edge.
  const forest = (OUTER - TILE) / TILE
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const scenery = r * TILE < BACKDROP_H || c < forest || c >= cols - forest || r >= rows - forest
      if (scenery && area[r * cols + c] === HALLWAY) area[r * cols + c] = BLOCKED
    }
  }
  // The stream can only be crossed on its bridges.
  const stream = layout.stream
  if (stream) {
    for (let c = Math.floor((stream.x - TILE) / TILE); c < Math.ceil((stream.x + TILE) / TILE); c++) {
      for (let r = Math.floor(stream.top / TILE); r * TILE < stream.bottom; r++) {
        const onBridge = stream.bridges.some((b) => r * TILE >= b.y && r * TILE < b.y + b.h)
        if (!onBridge && area[r * cols + c] === HALLWAY) area[r * cols + c] = BLOCKED
      }
    }
  }

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
