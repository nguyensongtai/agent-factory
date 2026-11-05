import { STATIONS, STATION_BY_ID, type Station } from '../domain/stations'
import type { StationId } from '../domain/types'

// Everything is aligned to an 8px walk grid: rooms, hallways (GAP) and seats sit on whole tiles.
export const TILE = 8
export const ROOM_W = 160
const ROOM_H = 144
export const WALL_H = 48
const GAP = 16
const SLOT_W = 48
// Resource-center seats are wider so resting agents' names have room to be read.
const WIDE_SLOT_W = 72
const SLOT_H = 48
const FIRST_ROW = 28 // feet offset below the wall: centre of the 4th floor tile
// The orchestration center takes two cells of the second row, with the AI core in the middle of its floor.
const CORE_ROW = 1
const CORE_SPAN = 2
const CORE_HALF_W = 40
const CORE_GAP_BOTTOM = 24

export type Tile = { col: number; row: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type RoomRect = Rect & { station: Station }
export type FloorLayout = { width: number; height: number; rooms: Record<StationId, RoomRect> }

export function slotWidth(station: StationId): number {
  return station === 'resources' ? WIDE_SLOT_W : SLOT_W
}

function perRow(w: number, slotW: number): number {
  return Math.max(1, Math.floor((w - 8) / slotW))
}

function heightFor(w: number, occupants: number): number {
  const rows = Math.max(2, Math.ceil(occupants / perRow(w, WIDE_SLOT_W)))
  const h = WALL_H + FIRST_ROW + (rows - 1) * SLOT_H + 20

  return Math.max(ROOM_H, Math.ceil(h / TILE) * TILE)
}

// Work rooms fill the grid around the orchestration center; the resource center takes the rest of the
// last row (or a row of its own) and grows taller so every resting agent gets a seat.
export function layoutFloor(cols: number, restingCount: number): FloorLayout {
  const work = STATIONS.filter((s) => s.id !== 'resources' && s.id !== 'orchestration')
  const coreCol = Math.floor((cols - CORE_SPAN) / 2)
  const isCore = (r: number, c: number) => r === CORE_ROW && c >= coreCol && c < coreCol + CORE_SPAN
  const cells: { r: number; c: number }[] = []
  for (let r = 0; cells.length < work.length; r++) {
    for (let c = 0; c < cols && cells.length < work.length; c++) if (!isCore(r, c)) cells.push({ r, c })
  }

  const cellX = (c: number) => GAP + c * (ROOM_W + GAP)
  const spanW = (n: number) => n * ROOM_W + (n - 1) * GAP
  const last = cells[cells.length - 1]
  const free = cols - 1 - last.c
  const restOnLastRow = free >= 2
  const restRow = restOnLastRow ? last.r : last.r + 1
  const restCols = restOnLastRow ? free : cols
  const restH = heightFor(spanW(restCols), restingCount)
  const rowH = (r: number) => (r === restRow ? restH : ROOM_H)
  const rowY = (r: number) => {
    let y = GAP
    for (let i = 0; i < r; i++) y += rowH(i) + GAP

    return y
  }

  const rooms = {} as Record<StationId, RoomRect>
  work.forEach((station, i) => {
    const { r, c } = cells[i]
    const stretch = i === work.length - 1 && free === 1 ? 2 : 1
    rooms[station.id] = { station, x: cellX(c), y: rowY(r), w: spanW(stretch), h: rowH(r) }
  })
  rooms.orchestration = {
    station: STATION_BY_ID.orchestration,
    x: cellX(coreCol),
    y: rowY(CORE_ROW),
    w: spanW(CORE_SPAN),
    h: ROOM_H,
  }
  rooms.resources = {
    station: STATION_BY_ID.resources,
    x: cellX(restOnLastRow ? last.c + 1 : 0),
    y: rowY(restRow),
    w: spanW(restCols),
    h: restH,
  }

  return { width: GAP + cols * (ROOM_W + GAP), height: rowY(restRow + 1), rooms }
}

// The AI core platform in the middle of the orchestration floor; agents walk around it.
export function coreRect(room: RoomRect): Rect {
  const cx = room.x + room.w / 2

  return {
    x: cx - CORE_HALF_W,
    y: room.y + WALL_H,
    w: CORE_HALF_W * 2,
    h: room.h - WALL_H - CORE_GAP_BOTTOM,
  }
}

// Orchestration seats sit left and right of the core, alternating sides.
function coreSeat(room: RoomRect, index: number): Tile {
  const core = coreRect(room)
  const perSide = perRow(core.x - room.x, SLOT_W)
  const rows = 2
  const side = index % 2
  const k = Math.floor(index / 2)
  const col = k % perSide
  const row = Math.floor(k / perSide) % rows
  const left = side === 0 ? room.x + 4 : core.x + core.w + 4

  return {
    col: Math.floor((left + SLOT_W / 2 + col * SLOT_W) / TILE),
    row: Math.floor((room.y + WALL_H + FIRST_ROW + row * SLOT_H) / TILE),
  }
}

// Tile under the feet of the n-th occupant of a room, seats centred in the room.
export function slotTile(room: RoomRect, index: number): Tile {
  if (room.station.id === 'orchestration') return coreSeat(room, index)
  const slotW = slotWidth(room.station.id)
  const cols = perRow(room.w, slotW)
  const rows = Math.max(1, Math.floor((room.h - WALL_H - FIRST_ROW - 20) / SLOT_H) + 1)
  const row = Math.floor(index / cols) % rows
  const col = index % cols
  const overflow = Math.floor(index / (cols * rows)) * TILE
  const left = room.x + (room.w - cols * slotW) / 2

  return {
    col: Math.floor((left + slotW / 2 + col * slotW + overflow) / TILE),
    row: Math.floor((room.y + WALL_H + FIRST_ROW + row * SLOT_H) / TILE),
  }
}

// Bottom-wall openings, as the floor tile just inside each one. Wide rooms get two.
export function doorTiles(room: RoomRect): Tile[] {
  const row = (room.y + room.h) / TILE - 1
  const centres = room.w > ROOM_W * 2 ? [room.x + room.w * 0.25, room.x + room.w * 0.75] : [room.x + room.w / 2]

  return centres.flatMap((cx) => {
    const col = Math.round(cx / TILE)

    return [
      { col: col - 1, row },
      { col, row },
    ]
  })
}

export function roomAt(layout: FloorLayout, x: number, y: number): StationId | null {
  for (const room of Object.values(layout.rooms)) {
    if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) return room.station.id
  }

  return null
}
