import type { StationId } from '../../domain/types'
import {
  DESK_HALF_W,
  DESK_RISE,
  DESK_ROOMS,
  BACKDROP_H,
  WALL_H,
  coreRect,
  doorTiles,
  slotCount,
  slotTile,
  TILE,
  type FloorLayout,
  type RoomRect,
} from '../layout'
import { tileX, tileY } from '../movement'
import { fill, shade, type Ctx } from './pixels'
import { random, renderForest, renderTerrain, type Rand } from './terrain'

// The ninja village in its forest clearing: every zone is a hall with a tiled roof and a veranda, the Command
// Tower a pagoda. Everything that never moves is painted once per layout at 1 logical px per pixel.
// Lighting, glowing screens and lanterns are added on top every frame (see lighting.ts and glow.ts).

export const WOOD_DARK = '#2b1a0f'
const WOOD = '#3b2414'
const WOOD_LIGHT = '#5a3a22'
const PLASTER = '#17141f'
const PAPER = '#cdbb92'
const LATTICE = '#7d6646'

type FloorKind = 'wood' | 'darkwood' | 'redwood' | 'sand' | 'stone' | 'slate' | 'tatami'

const FLOOR: Record<StationId, FloorKind> = {
  warehouse: 'darkwood',
  devlab: 'wood',
  testlab: 'sand',
  browser: 'stone',
  mcp: 'redwood',
  orchestration: 'slate',
  approval: 'redwood',
  resources: 'tatami',
}

const PLANK_TONES: Record<'wood' | 'darkwood' | 'redwood', string[]> = {
  wood: ['#5a3a22', '#61402a', '#553620', '#5d3c25'],
  darkwood: ['#3f2a1a', '#45301d', '#3a2617', '#422c1b'],
  redwood: ['#5e2c22', '#663226', '#56281f', '#613026'],
}

function planks(ctx: Ctx, x: number, y: number, w: number, h: number, tones: string[], rand: Rand) {
  for (let py = y, row = 0; py < y + h; py += 7, row++) {
    for (let px = x - ((row * 37) % 96); px < x + w; px += 96) {
      fill(ctx, tones[Math.floor(rand() * tones.length)], px, py, 96, 7)
      fill(ctx, shade(tones[0], -0.18), px, py, 1, 7)
      for (let k = 0; k < 3; k++) {
        fill(ctx, shade(tones[0], -0.08), px + 8 + Math.floor(rand() * 80), py + 2 + Math.floor(rand() * 3), 6 + Math.floor(rand() * 8), 1)
      }
    }
    fill(ctx, shade(tones[0], -0.25), x, py + 6, w, 1)
  }
}

function tiles(ctx: Ctx, x: number, y: number, w: number, h: number, size: number, tones: string[], joint: string, rand: Rand) {
  for (let py = y; py < y + h; py += size) {
    for (let px = x; px < x + w; px += size) {
      fill(ctx, tones[Math.floor(rand() * tones.length)], px, py, size, size)
      fill(ctx, shade(tones[0], 0.08), px + 1, py + 1, size - 2, 1)
      fill(ctx, joint, px, py, size, 1)
      fill(ctx, joint, px, py, 1, size)
    }
  }
}

function tatami(ctx: Ctx, x: number, y: number, w: number, h: number) {
  for (let py = y, row = 0; py < y + h; py += 16, row++) {
    for (let px = x - (row % 2) * 16; px < x + w; px += 32) {
      fill(ctx, '#8f8a52', px, py, 32, 16)
      for (let k = 1; k < 16; k += 2) fill(ctx, '#86814a', px, py + k, 32, 1)
      fill(ctx, '#2f3a1e', px, py, 32, 1)
      fill(ctx, '#2f3a1e', px, py + 15, 32, 1)
      fill(ctx, '#6f6a3e', px, py, 1, 16)
    }
  }
}

function sand(ctx: Ctx, x: number, y: number, w: number, h: number, rand: Rand) {
  fill(ctx, '#8a7655', x, y, w, h)
  for (let i = 0; i < (w * h) / 18; i++) {
    fill(ctx, rand() < 0.5 ? '#7c6a4b' : '#968262', x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1)
  }
  // Raked lines across the training ground.
  for (let py = y + 6; py < y + h; py += 12) fill(ctx, '#80704f', x + 4, py, w - 8, 1)
}

function paintFloor(ctx: Ctx, room: RoomRect, rand: Rand) {
  const kind = FLOOR[room.station.id]
  const y = room.y + WALL_H
  const h = room.h - WALL_H
  ctx.save()
  ctx.beginPath()
  ctx.rect(room.x, y, room.w, h)
  ctx.clip()
  if (kind === 'tatami') tatami(ctx, room.x, y, room.w, h)
  else if (kind === 'sand') sand(ctx, room.x, y, room.w, h, rand)
  else if (kind === 'stone') tiles(ctx, room.x, y, room.w, h, 16, ['#4a4f5a', '#474c56', '#4e535e'], '#2c3038', rand)
  else if (kind === 'slate') tiles(ctx, room.x, y, room.w, h, 24, ['#2a2d36', '#2d3039', '#272a32'], '#17191f', rand)
  else planks(ctx, room.x, y, room.w, h, PLANK_TONES[kind], rand)
  ctx.restore()
  fill(ctx, 'rgba(0,0,0,0.35)', room.x, y, room.w, 3)
}

function shoji(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fill(ctx, WOOD, x, y, w, h)
  fill(ctx, PAPER, x + 2, y + 2, w - 4, h - 4)
  for (let i = x + 7; i < x + w - 2; i += 6) fill(ctx, LATTICE, i, y + 2, 1, h - 4)
  for (let j = y + 8; j < y + h - 2; j += 7) fill(ctx, LATTICE, x + 2, j, w - 4, 1)
  fill(ctx, WOOD_LIGHT, x, y, w, 1)
}

// Lanterns hang one per ~80 px of wall; wall props are placed around them.
export function lanternXs(room: RoomRect): number[] {
  const n = Math.max(1, Math.round(room.w / 80))

  return Array.from({ length: n }, (_, i) => Math.round(room.x + (room.w * (i + 0.5)) / n))
}

function nearLantern(room: RoomRect, from: number, to: number): boolean {
  return lanternXs(room).some((lx) => lx + 6 > from && lx - 6 < to)
}

// Paper doors along the wall wherever no lantern hangs and nothing else is in the way.
function shojiRow(ctx: Ctx, room: RoomRect, from: number, to: number) {
  for (let sx = from; sx + 24 <= to; sx += 30) if (!nearLantern(room, sx, sx + 24)) shoji(ctx, sx, room.y + 9, 24, 28)
}

function shelves(ctx: Ctx, x: number, y: number, rand: Rand) {
  fill(ctx, WOOD, x, y, 28, 34)
  fill(ctx, '#140d08', x + 2, y + 2, 24, 30)
  for (let s = 0; s < 3; s++) {
    const sy = y + 11 + s * 10
    fill(ctx, WOOD_LIGHT, x + 2, sy, 24, 2)
    for (let i = 0; i < 4; i++) {
      const ix = x + 4 + i * 6
      if (rand() < 0.5) {
        fill(ctx, '#d9c9a3', ix, sy - 4, 4, 4)
        fill(ctx, '#8a7354', ix, sy - 3, 1, 2)
      } else fill(ctx, rand() < 0.5 ? '#6b4f3a' : '#4a3a2c', ix, sy - 6, 5, 6)
    }
  }
}

function screenFrame(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fill(ctx, '#0d0f14', x, y, w, h)
  fill(ctx, '#06141c', x + 2, y + 2, w - 4, h - 4)
}

function resultBoard(ctx: Ctx, x: number, y: number, w: number) {
  fill(ctx, WOOD, x, y, w, 24)
  fill(ctx, '#140d08', x + 2, y + 2, w - 4, 20)
}

function roundWindow(ctx: Ctx, cx: number, cy: number, r: number) {
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= r) fill(ctx, '#0b1530', cx + dx, cy + dy, 1, 1)
      else if (d <= r + 2) fill(ctx, WOOD, cx + dx, cy + dy, 1, 1)
    }
  }
  for (let dx = -r; dx <= r; dx++) fill(ctx, '#1a2747', cx + dx, cy + r - 3, 1, 1)
}

function switchboard(ctx: Ctx, x: number, y: number, w: number) {
  fill(ctx, WOOD, x, y, w, 30)
  fill(ctx, '#2a1a10', x + 2, y + 2, w - 4, 26)
  for (let r = 0; r < 4; r++) for (let c = 0; c < Math.floor((w - 8) / 6); c++) fill(ctx, '#0b0705', x + 5 + c * 6, y + 5 + r * 6, 2, 2)
  const cords = ['#ef4444', '#facc15', '#22d3ee', '#a78bfa']
  cords.forEach((color, i) => {
    const from = x + 6 + i * 13
    const to = x + w - 12 - i * 9
    for (let k = 0; k <= 10; k++) {
      const px = from + ((to - from) * k) / 10
      fill(ctx, color, px, y + 7 + i * 5 + Math.round(Math.sin((k / 10) * Math.PI) * 6), 1, 1)
    }
  })
}

function torii(ctx: Ctx, cx: number, y: number) {
  const red = '#b91c1c'
  fill(ctx, '#111', cx - 22, y + 7, 44, 2)
  fill(ctx, red, cx - 20, y + 9, 40, 3)
  fill(ctx, red, cx - 15, y + 17, 30, 2)
  fill(ctx, red, cx - 14, y + 12, 4, 26)
  fill(ctx, red, cx + 10, y + 12, 4, 26)
  fill(ctx, shade(red, -0.3), cx - 11, y + 12, 1, 26)
  fill(ctx, shade(red, -0.3), cx + 13, y + 12, 1, 26)
  fill(ctx, '#7a5c1e', cx - 1, y + 19, 1, 4)
  fill(ctx, '#c9a227', cx - 3, y + 23, 6, 6)
  fill(ctx, '#e5c158', cx - 2, y + 23, 2, 2)
}

// Small red gate standing on the path in front of the shrine's doors.
function gateTorii(ctx: Ctx, cx: number, y: number) {
  const red = '#c2272d'
  fill(ctx, '#1a1a1a', cx - 15, y - 2, 30, 2)
  fill(ctx, red, cx - 13, y, 26, 2)
  fill(ctx, red, cx - 10, y + 5, 20, 2)
  fill(ctx, red, cx - 9, y + 2, 3, 15)
  fill(ctx, red, cx + 6, y + 2, 3, 15)
  fill(ctx, shade(red, -0.35), cx - 7, y + 2, 1, 15)
  fill(ctx, shade(red, -0.35), cx + 8, y + 2, 1, 15)
}

function shimenawa(ctx: Ctx, x: number, y: number, w: number) {
  for (let i = 0; i < w; i++) fill(ctx, i % 4 < 2 ? '#c8b07a' : '#a8905a', x + i, y + (i % 4 === 1 ? 1 : 0), 1, 3)
  for (let i = 8; i < w - 4; i += 16) {
    fill(ctx, '#f1ede2', x + i, y + 3, 3, 2)
    fill(ctx, '#f1ede2', x + i + 1, y + 5, 3, 2)
    fill(ctx, '#f1ede2', x + i, y + 7, 3, 2)
  }
}

function alcove(ctx: Ctx, x: number, y: number) {
  fill(ctx, '#120d0a', x, y + 8, 46, 30)
  fill(ctx, '#4a2d1a', x - 2, y + 36, 50, 4)
  fill(ctx, '#5f3a22', x - 2, y + 36, 50, 1)
  fill(ctx, '#e6dcc2', x + 26, y + 10, 10, 24)
  fill(ctx, WOOD, x + 25, y + 10, 12, 1)
  fill(ctx, WOOD, x + 25, y + 33, 12, 1)
  for (let a = 0; a < Math.PI * 1.8; a += 0.25) fill(ctx, '#2b2b2b', Math.round(x + 31 + Math.cos(a) * 3), Math.round(y + 21 + Math.sin(a) * 4), 1, 1)
  fill(ctx, '#6b3f2a', x + 4, y + 32, 10, 4)
  fill(ctx, WOOD, x + 8, y + 26, 2, 6)
  for (const [dx, dy, w] of [
    [2, 22, 8],
    [7, 20, 9],
    [4, 24, 12],
    [11, 23, 6],
  ]) {
    fill(ctx, '#3f6b35', x + dx, y + dy, w, 3)
    fill(ctx, '#5a8f47', x + dx + 1, y + dy, w - 3, 1)
  }
  // Teapot and cups on the alcove shelf; its steam is drawn live in glow.ts.
  fill(ctx, '#2f3b2f', x + 38, y + 30, 6, 6)
  fill(ctx, '#1f2a1f', x + 40, y + 28, 2, 2)
  fill(ctx, '#2f3b2f', x + 36, y + 32, 2, 2)
}

export function alcoveX(room: RoomRect): number {
  return room.x + room.w - 54
}

function stoneLantern(ctx: Ctx, x: number, y: number) {
  fill(ctx, '#6b6f78', x + 1, y, 6, 2)
  fill(ctx, '#55595f', x, y + 2, 8, 2)
  fill(ctx, '#3a3d43', x + 1, y + 4, 6, 4)
  fill(ctx, '#55595f', x, y + 8, 8, 2)
  fill(ctx, '#4a4d54', x + 2, y + 10, 4, 4)
  fill(ctx, '#55595f', x + 1, y + 14, 6, 2)
}

// The AI core sits on a stone shrine platform in the middle of the orchestration hall.
function shrine(ctx: Ctx, room: RoomRect) {
  const core = coreRect(room)
  fill(ctx, '#3a3d46', core.x, core.y + 4, core.w, core.h - 4)
  fill(ctx, '#454852', core.x + 4, core.y + 8, core.w - 8, core.h - 12)
  fill(ctx, '#2a2c33', core.x, core.y + core.h - 4, core.w, 4)
  fill(ctx, '#4f525c', core.x + 4, core.y + core.h - 8, core.w - 8, 2)
  const cx = core.x + core.w / 2
  const top = core.y + core.h - 34
  fill(ctx, '#2a2c33', cx - 16, top, 32, 30)
  fill(ctx, '#5a5d67', cx - 15, top + 1, 30, 28)
  fill(ctx, '#6b6e78', cx - 15, top + 1, 30, 2)
  stoneLantern(ctx, core.x + 4, core.y + core.h - 26)
  stoneLantern(ctx, core.x + core.w - 12, core.y + core.h - 26)
  shimenawa(ctx, cx - 50, room.y + 9, 100)
}

function wallProps(ctx: Ctx, room: RoomRect, rand: Rand) {
  const { x, w, y } = room
  const cx = Math.round(x + w / 2)
  switch (room.station.id) {
    case 'warehouse':
      shelves(ctx, x + 6, y + 8, rand)
      shelves(ctx, x + w - 34, y + 8, rand)
      if (w > 200) shojiRow(ctx, room, x + 40, x + w - 40)
      else screenFrame(ctx, cx - 18, y + 10, 36, 24)
      break
    case 'devlab':
      shojiRow(ctx, room, x + 6, cx - 32)
      screenFrame(ctx, cx - 26, y + 9, 52, 26)
      shojiRow(ctx, room, cx + 30, x + w - 6)
      break
    case 'testlab':
      shojiRow(ctx, room, x + 6, cx - 34)
      resultBoard(ctx, cx - 30, y + 10, 60)
      shojiRow(ctx, room, cx + 34, x + w - 6)
      break
    case 'browser':
      shojiRow(ctx, room, x + 6, cx - 18)
      roundWindow(ctx, cx, y + 23, 13)
      shojiRow(ctx, room, cx + 18, x + w - 34)
      screenFrame(ctx, x + w - 32, y + 12, 26, 20)
      break
    case 'mcp':
      shojiRow(ctx, room, x + 6, cx - 36)
      switchboard(ctx, cx - 32, y + 8, 64)
      shojiRow(ctx, room, cx + 36, x + w - 6)
      break
    case 'approval':
      shojiRow(ctx, room, x + 6, cx - 26)
      torii(ctx, cx, y)
      shojiRow(ctx, room, cx + 26, x + w - 6)
      break
    case 'resources':
      shojiRow(ctx, room, x + 6, alcoveX(room) - 6)
      alcove(ctx, alcoveX(room), y)
      break
    case 'orchestration':
      shojiRow(ctx, room, x + 80, cx - 54)
      shojiRow(ctx, room, cx + 54, x + w - 80)
      shrine(ctx, room)
      break
  }
}

// Low desk with a monitor seen from behind; the seated agent is drawn cropped just above it.
function desk(ctx: Ctx, cx: number, top: number) {
  const left = cx - DESK_HALF_W
  const width = DESK_HALF_W * 2
  fill(ctx, 'rgba(0,0,0,0.4)', left + 1, top + 13, width, 2)
  fill(ctx, WOOD_DARK, left, top + 10, 3, 4)
  fill(ctx, WOOD_DARK, left + width - 3, top + 10, 3, 4)
  fill(ctx, '#4a2d1a', left, top + 3, width, 7)
  fill(ctx, '#6b4426', left, top, width, 3)
  fill(ctx, '#8a5a34', left, top, width, 1)
  fill(ctx, '#1a1d24', left, top - 12, 14, 12)
  fill(ctx, '#262b35', left + 1, top - 11, 12, 9)
  fill(ctx, '#111318', left + 5, top - 1, 4, 1)
}

function cushion(ctx: Ctx, cx: number, feet: number) {
  fill(ctx, '#3d1616', cx - 14, feet - 4, 28, 8)
  fill(ctx, '#7a2e2e', cx - 13, feet - 4, 26, 6)
  fill(ctx, '#9a3e3e', cx - 13, feet - 4, 26, 1)
  for (const dx of [-14, 13]) for (const dy of [-4, 3]) fill(ctx, '#c9a227', cx + dx, feet + dy, 1, 1)
}

export function deskTop(feetY: number): number {
  return feetY - DESK_RISE
}

function seats(ctx: Ctx, room: RoomRect) {
  const id = room.station.id
  if (id !== 'resources' && !DESK_ROOMS.has(id)) return
  for (let i = 0; i < slotCount(room); i++) {
    const seat = slotTile(room, i)
    const cx = tileX(seat.col)
    const feet = tileY(seat.row)
    if (id === 'resources') cushion(ctx, cx, feet)
    else desk(ctx, cx, deskTop(feet))
  }
}

function dummies(ctx: Ctx, room: RoomRect) {
  for (const dx of [14, room.w - 14]) {
    const x = room.x + dx
    const y = room.y + WALL_H + 6
    fill(ctx, WOOD, x - 1, y + 4, 2, 14)
    fill(ctx, '#c9a35a', x - 4, y, 8, 6)
    fill(ctx, '#b08a45', x - 6, y + 6, 12, 3)
    fill(ctx, '#c9a35a', x - 3, y + 9, 6, 5)
    fill(ctx, '#8a6a32', x - 3, y + 11, 6, 1)
    fill(ctx, 'rgba(0,0,0,0.4)', x - 4, y + 18, 8, 2)
  }
}

function sideWalls(ctx: Ctx, room: RoomRect) {
  const { x, y, w, h } = room
  fill(ctx, '#07050a', x - 2, y - 2, w + 4, 2)
  for (const px of [x, x + w - 3]) {
    fill(ctx, '#2e1b0f', px, y, 3, h)
    fill(ctx, WOOD_LIGHT, px, y, 1, h)
  }
  // Front sill with openings at the doors.
  let cursor = x
  const doors = doorTiles(room)
  for (let i = 0; i < doors.length; i += 2) {
    const left = doors[i].col * TILE
    fill(ctx, WOOD, cursor, y + h - 3, left - cursor, 3)
    fill(ctx, WOOD_LIGHT, cursor, y + h - 3, left - cursor, 1)
    fill(ctx, '#6b4426', left, y + h - 1, TILE * 2, 1)
    cursor = left + TILE * 2
  }
  fill(ctx, WOOD, cursor, y + h - 3, x + w - cursor, 3)
  fill(ctx, WOOD_LIGHT, cursor, y + h - 3, x + w - cursor, 1)
}

function wall(ctx: Ctx, room: RoomRect) {
  const { x, y, w } = room
  fill(ctx, PLASTER, x, y, w, WALL_H)
  fill(ctx, WOOD_DARK, x, y, w, 6)
  fill(ctx, '#45291a', x, y + 5, w, 1)
  fill(ctx, WOOD, x, y + WALL_H - 5, w, 5)
  fill(ctx, '#55361f', x, y + WALL_H - 5, w, 1)
}

// Wooden veranda along the open front of each hall, with paper floor lanterns at its corners (glow.ts).
function veranda(ctx: Ctx, room: RoomRect) {
  const y = room.y + room.h
  fill(ctx, '#5a3a22', room.x - 3, y, room.w + 6, 5)
  for (let x = room.x - 3; x < room.x + room.w + 3; x += 4) fill(ctx, '#7a5232', x, y, 3, 4)
  fill(ctx, WOOD_DARK, room.x - 3, y + 5, room.w + 6, 2)
}

export function andonSpots(layout: FloorLayout): [number, number][] {
  return Object.values(layout.rooms).flatMap((r): [number, number][] => [
    [r.x + 2, r.y + r.h + 4],
    [r.x + r.w - 3, r.y + r.h + 4],
  ])
}

// Stone lanterns along the forest edge, every few halls.
export function toroSpots(layout: FloorLayout): [number, number][] {
  const spots: [number, number][] = []
  for (let y = BACKDROP_H + 60; y < layout.height - 40; y += 150) spots.push([4, y], [layout.width - 12, y + 70])

  return spots
}

function toro(ctx: Ctx, x: number, y: number) {
  fill(ctx, 'rgba(0,0,0,0.35)', x - 1, y + 15, 10, 2)
  fill(ctx, '#7a7e88', x + 1, y, 6, 2)
  fill(ctx, '#666a72', x, y + 2, 8, 2)
  fill(ctx, '#2a2c33', x + 1, y + 4, 6, 4)
  fill(ctx, '#666a72', x, y + 8, 8, 2)
  fill(ctx, '#5a5d65', x + 2, y + 10, 4, 4)
  fill(ctx, '#666a72', x + 1, y + 14, 6, 2)
}

// Smaller roofs stacked above the Command Tower, with lit windows (glow.ts) and a golden finial.
export function pagodaTiers(room: RoomRect): { x: number; y: number; w: number }[] {
  return [1, 2].map((t) => {
    const w = 132 - t * 36
    return { x: Math.round(room.x + (room.w - w) / 2), y: room.y - 8 - t * 16, w }
  })
}

function pagoda(ctx: Ctx, room: RoomRect) {
  for (const tier of pagodaTiers(room)) {
    fill(ctx, '#1d1a28', tier.x + 4, tier.y + 6, tier.w - 8, 12)
    fill(ctx, WOOD, tier.x + 4, tier.y + 6, 2, 12)
    fill(ctx, WOOD, tier.x + tier.w - 6, tier.y + 6, 2, 12)
    for (let k = tier.x + 10; k < tier.x + tier.w - 12; k += 12) fill(ctx, WOOD, k, tier.y + 8, 7, 7)
    roofShape(ctx, tier.x, tier.y, tier.w, 9, room.station.accent)
  }
  const top = pagodaTiers(room)[1].y
  const cx = Math.round(room.x + room.w / 2)
  fill(ctx, '#c9a227', cx - 1, top - 12, 2, 12)
  fill(ctx, '#e5c158', cx - 3, top - 8, 6, 1)
  fill(ctx, '#e5c158', cx - 2, top - 4, 4, 1)
}

// Tiled roof with upturned corners and a neon trim in the zone colour.
function roofShape(ctx: Ctx, x0: number, top: number, width: number, rows: number, accent: string) {
  for (let i = 0; i < rows; i++) {
    const inset = Math.round(((rows - 1 - i) * 6) / (rows - 1)) - 4
    const x = x0 + inset
    const w = width - inset * 2
    fill(ctx, i === 0 ? '#3a4270' : i % 2 ? '#262c48' : '#22283f', x, top + i, w, 1)
    if (i > 0 && i < rows - 1) for (let tx = x + (i % 2) * 2; tx < x + w; tx += 4) fill(ctx, '#1a1e33', tx, top + i, 1, 1)
  }
  fill(ctx, '#3a4270', x0 - 6, top + rows - 3, 2, 2)
  fill(ctx, '#3a4270', x0 + width + 4, top + rows - 3, 2, 2)
  fill(ctx, accent, x0 - 4, top + rows - 1, width + 8, 1)
  fill(ctx, 'rgba(0,0,0,0.45)', x0, top + rows, width, 2)
}

function roof(ctx: Ctx, room: RoomRect) {
  roofShape(ctx, room.x, room.y - 7, room.w, 9, room.station.accent)
}

export function renderStaticFloor(layout: FloorLayout): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')!
  const rand = random(7)
  renderTerrain(ctx, layout, rand)
  for (const room of Object.values(layout.rooms)) {
    fill(ctx, 'rgba(0,0,0,0.35)', room.x - 5, room.y + 4, room.w + 10, room.h + 8)
    wall(ctx, room)
    paintFloor(ctx, room, rand)
    wallProps(ctx, room, rand)
    if (room.station.id === 'testlab') dummies(ctx, room)
    seats(ctx, room)
    sideWalls(ctx, room)
    veranda(ctx, room)
  }
  for (const room of Object.values(layout.rooms)) roof(ctx, room)
  pagoda(ctx, layout.rooms.orchestration)
  renderForest(ctx, layout, rand)
  const shrine = layout.rooms.resources
  for (const door of doorTiles(shrine).filter((_, i) => i % 2 === 1)) gateTorii(ctx, door.col * TILE, shrine.y + shrine.h + 6)
  for (const [x, y] of toroSpots(layout)) toro(ctx, x, y)

  return canvas
}
