import { DESK_HALF_W, DESK_ROOMS, slotCount, slotTile, type RoomRect } from '../layout'
import { tileX, tileY } from '../movement'
import { alcoveX, andonSpots, deskTop, lanternXs, pagodaTiers, toroSpots } from './dojo'
import type { FloorLayout } from '../layout'
import { alpha, fill, shade, type Ctx } from './pixels'

// Everything that emits light, drawn after the lighting pass so it stays bright in the dark:
// lanterns, screens, LEDs, the night sky and the odd wisp of steam.

export type RoomGlowState = { lit: boolean; alert: boolean }

const LANTERN_ROWS = [5, 7, 9, 9, 9, 9, 9, 7, 5]
const CYAN = '#22d3ee'

function lantern(ctx: Ctx, x: number, top: number, accent: string, state: RoomGlowState, t: number, seed: number) {
  fill(ctx, '#1a0f08', x, top + 6, 1, 6)
  const pulse = state.alert && Math.floor(t / 450) % 2 === 0
  const flicker = Math.sin(t / 140 + seed * 2) + Math.sin(t / 53 + seed) > 1.7
  const [paper, rib, band] = pulse
    ? ['#fda4af', '#f43f5e', '#be123c']
    : state.lit
      ? [flicker ? '#ffd2a0' : '#ffe1b0', '#ff9a4d', shade(accent, -0.1)]
      : ['#4f4232', '#3f3426', '#5a3a2a']
  LANTERN_ROWS.forEach((w, i) => fill(ctx, i % 2 ? rib : paper, x - Math.floor(w / 2), top + 13 + i, w, 1))
  fill(ctx, band, x - 4, top + 17, 9, 1)
  fill(ctx, '#2b1a0f', x - 2, top + 12, 5, 1)
  fill(ctx, '#2b1a0f', x - 2, top + 22, 5, 1)
  if (!state.lit) return
  // Dust drifting down through the lantern light.
  for (let k = 0; k < 6; k++) {
    const y = top + 26 + ((t * 0.006 + k * 13 + seed * 7) % 46)
    const dx = Math.sin(t * 0.0012 + k * 1.7 + seed) * 18
    fill(ctx, `rgba(255,214,150,${(0.55 - (y - top - 26) / 100).toFixed(2)})`, x + dx, y, 1, 1)
  }
}

function codeLines(ctx: Ctx, x: number, y: number, w: number, rows: number, t: number, seed: number) {
  for (let k = 0; k < rows; k++) {
    const len = 6 + ((k * 7 + seed + Math.floor(t / 400)) % 5) * Math.max(2, Math.floor((w - 10) / 5))
    fill(ctx, k % 3 === 0 ? '#fb923c' : CYAN, x + 3, y + 3 + k * 3, Math.min(w - 6, len), 1)
  }
}

function blink(t: number, k: number, period = 300): boolean {
  return (Math.floor(t / period) + k * 3) % 4 !== 0
}

function deskLeds(ctx: Ctx, room: RoomRect) {
  for (let i = 0; i < slotCount(room); i++) {
    const seat = slotTile(room, i)
    fill(ctx, CYAN, tileX(seat.col) - DESK_HALF_W + 7, deskTop(tileY(seat.row)) - 3, 1, 1)
  }
}

function sky(ctx: Ctx, cx: number, cy: number, t: number) {
  fill(ctx, '#f8f1d8', cx + 3, cy - 7, 4, 4)
  fill(ctx, '#f8f1d8', cx + 2, cy - 6, 1, 2)
  fill(ctx, '#0b1530', cx + 5, cy - 7, 2, 2)
  const stars = [
    [-8, -4],
    [-4, -9],
    [-9, 3],
    [6, 2],
    [-2, -1],
    [9, -3],
  ]
  stars.forEach(([dx, dy], k) => {
    if ((Math.floor(t / 500) + k * 5) % 7 !== 0) fill(ctx, '#cbd5e1', cx + dx, cy + dy, 1, 1)
  })
}

function steam(ctx: Ctx, x: number, y: number, t: number) {
  for (let k = 0; k < 4; k++) {
    const p = (t / 1800 + k / 4) % 1
    fill(ctx, `rgba(230,230,230,${(0.5 * (1 - p)).toFixed(2)})`, x + Math.sin(p * 6 + k) * 2, y - p * 14, 1, 1)
  }
}

export function drawRoomGlow(ctx: Ctx, room: RoomRect, state: RoomGlowState, t: number) {
  const { x, y, w } = room
  const cx = Math.round(x + w / 2)
  lanternXs(room).forEach((lx, i) => lantern(ctx, lx, y, room.station.accent, state, t, i + x))
  if (room.station.id === 'browser') sky(ctx, cx, y + 23, t)
  if (!state.lit) return
  if (DESK_ROOMS.has(room.station.id)) deskLeds(ctx, room)
  switch (room.station.id) {
    case 'warehouse':
      for (const sx of [x + 6, x + w - 34]) {
        for (let s = 0; s < 3; s++) if (blink(t, s + sx)) fill(ctx, s === 1 ? '#4ade80' : CYAN, sx + 25, y + 15 + s * 10, 1, 1)
      }
      if (w <= 200) codeLines(ctx, cx - 18, y + 10, 36, 6, t, 2)
      break
    case 'devlab':
      codeLines(ctx, cx - 26, y + 9, 52, 7, t, 0)
      break
    case 'testlab': {
      const tick = Math.floor(t / 300)
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          const failing = (c * 7 + r * 3 + Math.floor(tick / 4)) % 23 === 0
          fill(ctx, failing ? (tick % 2 ? '#ef4444' : '#7f1d1d') : '#4ade80', cx - 26 + c * 5, y + 13 + r * 5, 3, 3)
        }
      }
      break
    }
    case 'browser':
      codeLines(ctx, x + w - 32, y + 12, 26, 5, t, 3)
      break
    case 'mcp': {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) if (!blink(t, r * 9 + c, 220)) fill(ctx, (r + c) % 3 ? CYAN : '#facc15', cx - 27 + c * 6, y + 13 + r * 6, 2, 2)
      const packet = Math.floor(t / 60) % 50
      fill(ctx, '#f8fafc', cx - 26 + packet, y + 35, 2, 1)
      break
    }
    case 'approval':
      if (state.alert && Math.floor(t / 300) % 2 === 0) fill(ctx, '#fff7d6', cx - 2, y + 24, 2, 2)
      break
    case 'resources':
      steam(ctx, alcoveX(room) + 41, y + 27, t)
      break
  }
}

// Paper floor lanterns on the verandas, stone lanterns at the forest edge and the pagoda's windows.
export function drawVillageLights(ctx: Ctx, layout: FloorLayout, t: number) {
  for (const [x, y] of andonSpots(layout)) {
    fill(ctx, '#2b1a0f', x - 3, y - 10, 6, 1)
    fill(ctx, '#2b1a0f', x - 3, y, 6, 1)
    fill(ctx, Math.sin(t / 170 + x) > 0.9 ? '#ffe9c4' : '#ffd8a0', x - 2, y - 9, 4, 9)
    fill(ctx, '#ff9a4d', x - 2, y - 5, 4, 1)
    fill(ctx, '#2b1a0f', x - 3, y - 9, 1, 9)
    fill(ctx, '#2b1a0f', x + 2, y - 9, 1, 9)
  }
  for (const [x, y] of toroSpots(layout)) fill(ctx, Math.sin(t / 200 + x + y) > 0.9 ? '#ffd2a0' : '#ffb35c', x + 2, y + 5, 4, 2)
  for (const tier of pagodaTiers(layout.rooms.orchestration)) {
    for (let k = tier.x + 10; k < tier.x + tier.w - 12; k += 12) {
      fill(ctx, Math.sin(t / 300 + k) > 0.95 ? '#ffd2a0' : '#ff9a4d', k + 1, tier.y + 9, 5, 5)
    }
  }
}

// Warning wash over a room after a failed tool call.
export function errorFlash(ctx: Ctx, room: RoomRect, fade: number) {
  fill(ctx, alpha('#ef4444', 0.12 * fade), room.x, room.y, room.w, room.h)
}
