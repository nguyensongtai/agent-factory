import { STATION_BY_ID } from '../../domain/stations'
import type { StationId } from '../../domain/types'
import { TILE, WALL_H, doorTiles, type FloorLayout, type Rect, type RoomRect } from '../layout'
import { pointAt, type Trace } from '../traces'
import { drawFurniture } from './furniture'
import { HOLO, INK, alpha, fill, mix, shade, type Ctx } from './pixels'

const DECK = '#040a16'
const ROOM_FLOOR = '#0a1426'
const ROOM_WALL = '#0c1830'
const PULSE_SPEED = 70 // logical px per second
const PULSE_GAP = 26
const ERROR_FLASH_MS = 2500
const ALERT = '#fb7185'
const DANGER = '#ef4444'

// What the floor needs to know about each room this frame.
// `working` excludes resting agents, so a room full of idle agents does not pull data from the core.
export type RoomState = { count: number; working: number; alert: boolean; errorAt: number }

// Thin blueprint grid: one device pixel wide whatever the zoom.
function gridLines(ctx: Ctx, area: Rect, step: number, color: string, hair: number) {
  ctx.fillStyle = color
  for (let x = area.x; x <= area.x + area.w; x += step) ctx.fillRect(x, area.y, hair, area.h)
  for (let y = area.y; y <= area.y + area.h; y += step) ctx.fillRect(area.x, y, area.w, hair)
}

function plaque(ctx: Ctx, text: string, x: number, y: number, accent: string) {
  const w = Math.ceil(ctx.measureText(text).width) + 8
  fill(ctx, alpha(INK, 0.9), x, y, w + 2, 12)
  ctx.strokeStyle = alpha(accent, 0.9)
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w + 1, 11)
  ctx.fillStyle = shade(accent, 0.35)
  ctx.fillText(text, x + 5, y + 6.5)
}

function frame(ctx: Ctx, room: RoomRect, color: string) {
  const { x, y, w, h } = room
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, h)
  ctx.fillRect(x + w - 1, y, 1, h)
  let cursor = x
  const doors = doorTiles(room)
  for (let i = 0; i < doors.length; i += 2) {
    const left = doors[i].col * TILE
    ctx.fillRect(cursor, y + h - 1, left - cursor, 1)
    cursor = left + TILE * 2
  }
  ctx.fillRect(cursor, y + h - 1, x + w - cursor, 1)
}

function drawRoomShell(ctx: Ctx, room: RoomRect, hair: number) {
  const { x, y, w, h, station } = room
  const accent = station.accent
  fill(ctx, '#01040b', x - 2, y - 2, w + 4, h + 4)
  fill(ctx, mix(ROOM_FLOOR, accent, 0.05), x, y + WALL_H, w, h - WALL_H)
  gridLines(ctx, { x, y: y + WALL_H, w, h: h - WALL_H }, TILE * 2, alpha(accent, 0.08), hair)

  // Back wall: dark panels, a neon strip on top and a soft glow spilling onto the floor.
  fill(ctx, mix(ROOM_WALL, accent, 0.08), x, y, w, WALL_H)
  for (let px = x + 10; px < x + w; px += 20) fill(ctx, alpha(accent, 0.07), px, y + 16, 1, WALL_H - 18)
  fill(ctx, INK, x, y + WALL_H - 2, w, 2)
  fill(ctx, alpha(accent, 0.12), x, y + WALL_H, w, 2)
  frame(ctx, room, alpha(accent, 0.45))
  for (const door of doorTiles(room).filter((_, i) => i % 2 === 0)) {
    fill(ctx, alpha(accent, 0.3), door.col * TILE, y + h, TILE * 2, 3)
    fill(ctx, alpha(accent, 0.12), door.col * TILE, y + h + 3, TILE * 2, 3)
  }
  plaque(ctx, `${station.icon} ${station.label}`, x + 4, y + 3, accent)
}

// Everything that never moves, painted once per layout/zoom into an offscreen canvas.
export function renderStaticFloor(layout: FloorLayout, zoom: number, font: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(layout.width * zoom)
  canvas.height = Math.round(layout.height * zoom)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.font = `11px ${font}`
  ctx.textBaseline = 'middle'
  const hair = 1 / zoom

  fill(ctx, DECK, 0, 0, layout.width, layout.height)
  const all = { x: 0, y: 0, w: layout.width, h: layout.height }
  gridLines(ctx, all, TILE, alpha(HOLO, 0.035), hair)
  gridLines(ctx, all, TILE * 4, alpha(HOLO, 0.07), hair)
  for (const room of Object.values(layout.rooms)) drawRoomShell(ctx, room, hair)

  return canvas
}

// Ceiling light: a lit strip and a pool of light on the floor when someone works here, dark otherwise.
function lighting(ctx: Ctx, room: RoomRect, state: RoomState, t: number) {
  const { x, y, w, h, station } = room
  const accent = station.accent
  if (state.count === 0) {
    fill(ctx, alpha(INK, 0.5), x, y + 2, w, h - 2)
    fill(ctx, alpha(accent, 0.35), x, y, w, 2)

    return
  }
  fill(ctx, accent, x, y, w, 2)
  fill(ctx, alpha(accent, 0.3), x, y + 2, w, 2)
  const cx = x + w / 2
  const cy = y + WALL_H + (h - WALL_H) / 2
  const pool = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) * 0.6)
  pool.addColorStop(0, alpha(accent, 0.1))
  pool.addColorStop(1, alpha(accent, 0))
  ctx.fillStyle = pool
  ctx.fillRect(x, y + WALL_H, w, h - WALL_H)
  if (state.alert && Math.floor(t / 450) % 2 === 0) {
    frame(ctx, room, ALERT)
    fill(ctx, ALERT, x + w - 10, y + 18, 6, 4)
  }
}

function statusLed(ctx: Ctx, room: RoomRect, state: RoomState, t: number): string {
  if (t - state.errorAt < ERROR_FLASH_MS) return DANGER
  if (state.alert) return ALERT
  if (state.count > 0) return '#4ade80'

  return '#334155'
}

// Animated props, lights, error flashes and the "N agent" counter of each room.
export function drawRooms(ctx: Ctx, layout: FloorLayout, t: number, font: string, rooms: Map<StationId, RoomState>) {
  ctx.font = `11px ${font}`
  ctx.textBaseline = 'middle'
  const empty: RoomState = { count: 0, working: 0, alert: false, errorAt: -Infinity }
  for (const room of Object.values(layout.rooms)) {
    const state = rooms.get(room.station.id) ?? empty
    drawFurniture(ctx, room, t)
    lighting(ctx, room, state, t)
    const sinceError = t - state.errorAt
    if (sinceError < ERROR_FLASH_MS) {
      const fade = 1 - sinceError / ERROR_FLASH_MS
      fill(ctx, alpha(DANGER, 0.12 * fade), room.x, room.y, room.w, room.h)
      frame(ctx, room, alpha(DANGER, fade))
    }
    const led = statusLed(ctx, room, state, t)
    fill(ctx, INK, room.x + room.w - 11, room.y + 4, 8, 8)
    fill(ctx, led, room.x + room.w - 10, room.y + 5, 6, 6)
    if (state.count === 0) continue
    const text = `${state.count} agent`
    const bw = Math.ceil(ctx.measureText(text).width) + 8
    fill(ctx, room.station.accent, room.x + room.w - bw - 14, room.y + 3, bw, 12)
    ctx.fillStyle = INK
    ctx.fillText(text, room.x + room.w - bw - 10, room.y + 9.5)
  }
}

const SHIELD = ['.SSSSS.', 'SsssssS', 'SsLssLS', 'SssLLsS', '.SsssS.', '..SsS..', '...S...']

function shield(ctx: Ctx, cx: number, cy: number, accent: string) {
  const dark = shade(accent, -0.55)
  SHIELD.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      fill(ctx, ch === 'S' ? accent : ch === 'L' ? '#f8fafc' : dark, cx - 3 + c, cy - 3 + r, 1, 1)
    }
  })
}

export function drawTraces(ctx: Ctx, traces: Trace[], rooms: Map<StationId, RoomState>, t: number) {
  const active = (trace: Trace) => (rooms.get(trace.station)?.working ?? 0) > 0
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'square'
  for (const pass of [false, true]) {
    for (const trace of traces) {
      if (active(trace) !== pass) continue
      const accent = STATION_BY_ID[trace.station].accent
      ctx.beginPath()
      trace.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.strokeStyle = alpha(accent, pass ? 0.7 : 0.12)
      ctx.lineWidth = pass ? 1.5 : 1
      if (pass) {
        ctx.shadowColor = accent
        ctx.shadowBlur = 6
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }

  // Data packets stream from the core to every room someone is working in.
  const offset = ((t / 1000) * PULSE_SPEED) % PULSE_GAP
  for (const trace of traces) {
    if (!active(trace)) continue
    const accent = STATION_BY_ID[trace.station].accent
    for (let d = offset; d < trace.total; d += PULSE_GAP) {
      const p = pointAt(trace, d)
      fill(ctx, alpha(accent, 0.35), p.x - 2, p.y - 2, 4, 4)
      fill(ctx, '#f8fafc', p.x - 1, p.y - 1, 2, 2)
    }
    shield(ctx, trace.badge.x, trace.badge.y, accent)
  }
}
