import type { RoomRect } from '../layout'
import { INK, alpha, box, fill, shade, type Ctx } from './pixels'

// Sci-fi props on each bay's back wall. Everything is drawn in logical pixels with the bay accent.
const STEEL = '#16233b'
const STEEL_DARK = '#0d1628'
const STEEL_LIGHT = '#2a3d5e'
const SCREEN = '#03101c'
const ARM = '#fb923c'

function screen(ctx: Ctx, x: number, y: number, w: number, h: number, accent: string) {
  box(ctx, SCREEN, x, y, w, h, alpha(accent, 0.85))
  fill(ctx, alpha(accent, 0.18), x + 1, y + 1, w - 2, 2)
}

function textLines(ctx: Ctx, x: number, y: number, w: number, rows: number, t: number, seed: number, color: string) {
  for (let l = 0; l < rows; l++) {
    const len = 3 + ((seed * 5 + l * 7 + Math.floor(t / 260)) % Math.max(4, w - 8))
    fill(ctx, l === 0 ? '#e2e8f0' : color, x + 3 + (l % 2) * 2, y + 4 + l * 3, len, 1)
  }
}

function rack(ctx: Ctx, x: number, y: number, h: number, t: number, seed: number, led: string) {
  box(ctx, STEEL_DARK, x, y, 22, h, '#020611')
  for (let l = 0; l < Math.floor((h - 3) / 5); l++) {
    fill(ctx, STEEL, x + 2, y + 2 + l * 5, 18, 4)
    const state = (seed * 7 + l * 3 + Math.floor(t / 300)) % 5
    fill(ctx, state === 0 ? led : state === 1 ? '#4ade80' : '#1e3350', x + 4, y + 3 + l * 5, 2, 2)
    fill(ctx, STEEL_LIGHT, x + 9, y + 3 + l * 5, 9, 1)
  }
}

function desk(ctx: Ctx, x: number, y: number, w: number) {
  box(ctx, STEEL, x, y, w, 6, '#020611')
  fill(ctx, STEEL_LIGHT, x + 1, y + 1, w - 2, 1)
  fill(ctx, INK, x + 3, y + 6, 2, 6)
  fill(ctx, INK, x + w - 5, y + 6, 2, 6)
}

// Two-joint industrial arm swinging over the conveyor, welding sparks at the lowest point.
function robotArm(ctx: Ctx, bx: number, by: number, t: number, phase: number) {
  const swing = Math.sin(t / 700 + phase)
  const a1 = -Math.PI / 2 + 0.55 * swing
  const a2 = a1 + 1.3 + 0.5 * Math.sin(t / 480 + phase)
  const x1 = bx + Math.cos(a1) * 15
  const y1 = by + Math.sin(a1) * 15
  const x2 = x1 + Math.cos(a2) * 13
  const y2 = y1 + Math.sin(a2) * 13
  box(ctx, '#334155', bx - 6, by - 2, 12, 6, '#020611')
  ctx.lineCap = 'round'
  for (const [width, color] of [
    [5, INK],
    [3, ARM],
  ] as const) {
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  fill(ctx, '#1f2937', x1 - 2, y1 - 2, 4, 4)
  fill(ctx, '#fbbf24', x1 - 1, y1 - 1, 2, 2)
  fill(ctx, '#e2e8f0', x2 - 1, y2, 2, 3)
  if (Math.sin(t / 480 + phase) < -0.75) {
    for (let s = 0; s < 4; s++) fill(ctx, s % 2 ? '#fde68a' : '#ffffff', x2 - 3 + ((s * 5 + t / 40) % 7), y2 + 3 - (s % 3), 1, 1)
  }
}

function conveyor(ctx: Ctx, x: number, y: number, w: number, t: number) {
  box(ctx, '#1e293b', x, y, w, 6, '#020611')
  const shift = Math.floor(t / 50) % 8
  for (let sx = x + 2 + shift; sx < x + w - 2; sx += 8) fill(ctx, '#334155', sx, y + 2, 3, 2)
  const crate = Math.floor(t / 35)
  for (const offset of [0, Math.floor(w / 2)]) {
    const cx = x + ((crate + offset) % (w - 10))
    box(ctx, '#b45309', cx, y - 6, 9, 7, '#020611')
    fill(ctx, '#f59e0b', cx + 2, y - 4, 5, 1)
  }
}

function globe(ctx: Ctx, cx: number, cy: number, r: number, t: number, accent: string) {
  ctx.lineWidth = 1
  ctx.strokeStyle = alpha(accent, 0.9)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = alpha(accent, 0.45)
  for (let m = 0; m < 3; m++) {
    const rx = Math.abs(Math.cos(t / 900 + (m * Math.PI) / 3)) * r
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(0.5, rx), r, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const k of [-0.5, 0, 0.5]) {
    const half = r * Math.sqrt(1 - k * k)
    fill(ctx, alpha(accent, 0.45), cx - half, cy + k * r, 2 * half, 1)
  }
  fill(ctx, alpha(accent, 0.2), cx - r, cy + r + 2, r * 2, 2)
}

function capsule(ctx: Ctx, cx: number, y: number, t: number, index: number, accent: string) {
  const pulse = (Math.floor(t / 400) + index) % 4 === 0
  box(ctx, STEEL, cx - 8, y + 22, 18, 8, '#020611')
  fill(ctx, INK, cx - 3, y + 2, 8, 20)
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = pulse ? 10 : 4
  fill(ctx, pulse ? '#fef9c3' : accent, cx - 2, y + 3, 6, 18)
  ctx.restore()
  fill(ctx, '#ffffff', cx - 1, y + 5, 1, 6)
  const spark = (Math.floor(t / 120) + index * 5) % 18
  fill(ctx, accent, cx + (index % 2 ? 7 : -6), y + 18 - spark, 1, 1)
}

const SHIELD = [
  '.SSSSSSSSS.',
  'SsssssssssS',
  'SsssssssssS',
  'SsssssssLsS',
  'SssssssLLsS',
  'SsLsssLLssS',
  '.SLLsLLssS.',
  '.SsLLLsssS.',
  '..SsLsssS..',
  '...SsssS...',
  '....SsS....',
  '.....S.....',
]

function bigShield(ctx: Ctx, x: number, y: number, accent: string, bright: boolean) {
  const dark = shade(accent, -0.6)
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = bright ? 10 : 3
  SHIELD.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      fill(ctx, ch === 'S' ? accent : ch === 'L' ? '#f8fafc' : dark, x + c * 2, y + r * 2, 2, 2)
    }
  })
  ctx.restore()
}

// Test results wall: rows of passing cases with the odd failure blinking, plus a progress bar.
function testBoard(ctx: Ctx, x: number, y: number, w: number, t: number, accent: string) {
  screen(ctx, x, y, w, 28, accent)
  const tick = Math.floor(t / 300)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < Math.floor((w - 8) / 6); c++) {
      const failing = (c * 7 + r * 3 + Math.floor(tick / 4)) % 23 === 0
      fill(ctx, failing ? (tick % 2 ? '#ef4444' : '#7f1d1d') : alpha(accent, 0.85), x + 4 + c * 6, y + 5 + r * 6, 4, 4)
    }
  }
  const progress = (tick % 20) / 19
  fill(ctx, '#0b2440', x + 4, y + 23, w - 8, 2)
  fill(ctx, accent, x + 4, y + 23, Math.round((w - 8) * progress), 2)
}

function chargePanel(ctx: Ctx, x: number, y: number, t: number, accent: string) {
  screen(ctx, x, y, 34, 26, accent)
  box(ctx, STEEL_DARK, x + 7, y + 6, 18, 12, accent)
  fill(ctx, accent, x + 25, y + 10, 2, 4)
  const level = Math.floor(t / 400) % 5
  for (let b = 0; b < level; b++) fill(ctx, accent, x + 9 + b * 3, y + 8, 2, 8)
}

function coffeeMachine(ctx: Ctx, x: number, y: number, t: number) {
  box(ctx, '#1e293b', x, y - 2, 20, 30, '#020611')
  fill(ctx, '#fb7185', x + 4, y + 2, 12, 3)
  box(ctx, '#e2e8f0', x + 6, y + 16, 8, 8, '#020611')
  const steam = Math.floor(t / 400)
  if (steam % 2 === 0) fill(ctx, alpha('#ffffff', 0.6), x + 9, y + 10 - (steam % 4), 2, 4)
}

function plant(ctx: Ctx, x: number, y: number) {
  box(ctx, '#334155', x, y + 10, 10, 8, '#020611')
  fill(ctx, '#22c55e', x + 1, y + 2, 8, 8)
  fill(ctx, '#15803d', x + 3, y, 4, 6)
  fill(ctx, '#86efac', x + 2, y + 3, 2, 2)
}

function skylineScreen(ctx: Ctx, x: number, y: number, seed: number) {
  screen(ctx, x, y, 44, 24, '#60a5fa')
  fill(ctx, alpha('#60a5fa', 0.18), x + 2, y + 12, 40, 10)
  for (let b = 0; b < 6; b++) {
    const h = 3 + ((b * 5 + seed) % 7)
    fill(ctx, '#1e3a8a', x + 4 + b * 6, y + 22 - h, 4, h)
    fill(ctx, '#fde68a', x + 5 + b * 6, y + 23 - h, 1, 1)
  }
}

export function drawFurniture(ctx: Ctx, room: RoomRect, t: number) {
  const { x, w, station } = room
  const y = room.y + 16
  const a = station.accent
  switch (station.id) {
    case 'warehouse':
      for (let i = 0; i < 4; i++) rack(ctx, x + 8 + i * 26, y - 2, 30, t, i + 1, a)
      screen(ctx, x + w - 44, y, 36, 26, a)
      textLines(ctx, x + w - 44, y, 36, 7, t, 2, a)
      break
    case 'devlab':
      conveyor(ctx, x + 6, y + 22, w - 12, t)
      robotArm(ctx, x + 40, y + 20, t, 0)
      robotArm(ctx, x + w - 40, y + 20, t, 2.2)
      screen(ctx, x + w / 2 - 14, y - 2, 28, 16, a)
      textLines(ctx, x + w / 2 - 14, y - 2, 28, 3, t, 4, a)
      break
    case 'testlab':
      testBoard(ctx, x + 8, y - 2, w - 64, t, a)
      for (let m = 0; m < 2; m++) {
        const mx = x + w - 52 + m * 24
        screen(ctx, mx, y + 2, 20, 16, a)
        textLines(ctx, mx, y + 2, 20, 3, t, m + 3, a)
      }
      desk(ctx, x + w - 56, y + 20, 48)
      break
    case 'browser':
      globe(ctx, x + 40, y + 12, 13, t, a)
      screen(ctx, x + w - 52, y - 2, 42, 28, a)
      textLines(ctx, x + w - 52, y - 2, 42, 7, t, 3, a)
      for (let r = 0; r <= Math.floor(t / 400) % 3; r++) fill(ctx, alpha(a, 0.8), x + 62 + r * 5, y + 4 - r * 2, 2, 6 + r * 4)
      break
    case 'mcp': {
      for (let r = 0; r < 4; r++) rack(ctx, x + 8 + r * 37, y - 2, 30, t, r + 5, a)
      const packet = Math.floor(t / 60) % 15
      for (let r = 0; r < 3; r++) {
        const cx = x + 30 + r * 37
        fill(ctx, alpha(a, 0.5), cx, y + 8, 15, 1)
        fill(ctx, '#f8fafc', cx + packet, y + 7, 2, 3)
      }
      break
    }
    case 'approval': {
      const blink = Math.floor(t / 500) % 2 === 0
      bigShield(ctx, x + w / 2 - 11, y - 4, a, blink)
      box(ctx, STEEL, x + 10, y + 20, w - 20, 8, '#020611')
      for (let s = 0; s < 6; s++) {
        fill(ctx, (s + Math.floor(t / 250)) % 2 ? a : '#f8fafc', x + 14 + s * ((w - 32) / 5), y + 22, 4, 2)
      }
      break
    }
    case 'resources': {
      for (let c = 0; c < 3; c++) capsule(ctx, x + 20 + c * 30, y - 2, t, c, a)
      chargePanel(ctx, x + 108, y, t, '#4ade80')
      coffeeMachine(ctx, x + w - 54, y, t)
      plant(ctx, x + w - 26, y + 8)
      const screens = Math.max(0, Math.min(4, Math.floor((w - 220) / 60)))
      for (let i = 0; i < screens; i++) skylineScreen(ctx, x + 156 + i * 60, y, i)
      break
    }
    case 'orchestration':
      break
  }
}

// A charging pad under every idle seat so resting agents plug in instead of standing around.
export function drawSeat(ctx: Ctx, cx: number, feetY: number, color: string, t: number) {
  fill(ctx, '#020611', cx - 11, feetY - 6, 22, 9)
  fill(ctx, STEEL, cx - 10, feetY - 5, 20, 7)
  const glow = 0.35 + 0.25 * Math.sin(t / 500 + cx)
  fill(ctx, alpha(color, glow), cx - 10, feetY + 1, 20, 1)
  fill(ctx, alpha(color, glow * 0.6), cx - 8, feetY + 2, 16, 1)
}
