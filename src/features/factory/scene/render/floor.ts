import { STATION_BY_ID } from '../../domain/stations'
import type { StationId } from '../../domain/types'
import { TILE, doorTiles, type FloorLayout, type RoomRect } from '../layout'
import { pointAt, type Trace } from '../traces'
import { WOOD_DARK } from './dojo'
import { errorFlash } from './glow'
import { INK, alpha, fill, mix, shade, type Ctx } from './pixels'

const PULSE_SPEED = 70 // logical px per second
const PULSE_GAP = 26
const ERROR_FLASH_MS = 2500
const ALERT = '#fb7185'
const DANGER = '#ef4444'

// What the floor needs to know about each room this frame.
// `working` excludes resting agents, so a room full of idle agents does not pull data from the core.
export type RoomState = { count: number; working: number; alert: boolean; errorAt: number }

export const EMPTY_ROOM: RoomState = { count: 0, working: 0, alert: false, errorAt: -Infinity }

function frame(ctx: Ctx, room: RoomRect, color: string) {
  const { x, y, w, h } = room
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, h)
  ctx.fillRect(x + w - 1, y, 1, h)
  ctx.fillRect(x, y, w, 1)
  let cursor = x
  const doors = doorTiles(room)
  for (let i = 0; i < doors.length; i += 2) {
    const left = doors[i].col * TILE
    ctx.fillRect(cursor, y + h - 1, left - cursor, 1)
    cursor = left + TILE * 2
  }
  ctx.fillRect(cursor, y + h - 1, x + w - cursor, 1)
}

function statusLed(state: RoomState, t: number): string {
  if (t - state.errorAt < ERROR_FLASH_MS) return DANGER
  if (state.alert) return ALERT
  if (state.count > 0) return '#4ade80'

  return '#334155'
}

// Neon sign under the eaves: bright in the zone colour when someone is inside, a dull tube when empty.
function plaque(ctx: Ctx, room: RoomRect, lit: boolean) {
  const text = room.station.label
  const accent = room.station.accent
  const w = Math.ceil(ctx.measureText(text).width) + 10
  const x = Math.round(room.x + (room.w - w) / 2)
  fill(ctx, lit ? accent : shade(accent, -0.55), x - 1, room.y, w + 2, 11)
  fill(ctx, '#0b0a14', x, room.y + 1, w, 9)
  ctx.save()
  if (lit) {
    ctx.shadowColor = accent
    ctx.shadowBlur = 8
  }
  ctx.fillStyle = lit ? mix(accent, '#ffffff', 0.55) : shade(accent, -0.45)
  ctx.fillText(text, x + 5, room.y + 5.5)
  ctx.restore()
}

// Drawn after lighting: error flashes, approval alerts, name boards, status LEDs and the "N agent" tag.
export function drawRoomOverlay(ctx: Ctx, layout: FloorLayout, t: number, font: string, rooms: Map<StationId, RoomState>) {
  ctx.font = `10px ${font}`
  ctx.textBaseline = 'middle'
  for (const room of Object.values(layout.rooms)) {
    const state = rooms.get(room.station.id) ?? EMPTY_ROOM
    const sinceError = t - state.errorAt
    if (sinceError < ERROR_FLASH_MS) {
      const fade = 1 - sinceError / ERROR_FLASH_MS
      errorFlash(ctx, room, fade)
      frame(ctx, room, alpha(DANGER, fade))
    }
    if (state.alert && Math.floor(t / 450) % 2 === 0) frame(ctx, room, ALERT)
    plaque(ctx, room, state.count > 0)
    fill(ctx, WOOD_DARK, room.x + room.w - 12, room.y + 1, 8, 8)
    fill(ctx, statusLed(state, t), room.x + room.w - 11, room.y + 2, 6, 6)
    if (state.count === 0) continue
    // Left corner, so it never collides with the centred name board.
    const text = `${state.count} ninja`
    const bw = Math.ceil(ctx.measureText(text).width) + 8
    fill(ctx, shade(room.station.accent, -0.1), room.x + 4, room.y + 1, bw, 9)
    ctx.fillStyle = INK
    ctx.fillText(text, room.x + 8, room.y + 5.5)
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
