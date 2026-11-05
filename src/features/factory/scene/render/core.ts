import { coreRect, type RoomRect } from '../layout'
import { HOLO, INK, alpha, box, fill, pixelSprite, type Ctx } from './pixels'

// Holographic overseer floating above the data core.
const BUST = [
  '.....hhhhhh.....',
  '....hHHHHHHh....',
  '...hHHHHHHHHh...',
  '...hHHHHHHHHh...',
  '...hHEEHHEEHh...',
  '...hHHHHHHHHh...',
  '....hHHHHHHh....',
  '.....hHHHHh.....',
  '......hHHh......',
  '...hhhHHHHhhh...',
  '..hHHHHHHHHHHh..',
  '.hHHHHHHHHHHHHh.',
  '.hHHHHHhhHHHHHh.',
  'hHHHHHHhhHHHHHHh',
  'hHHHHHHhhHHHHHHh',
  'hHHHHHHHHHHHHHHh',
]

const LOCK = ['..LLL..', '.L...L.', '.L...L.', 'LLLLLLL', 'LLLkLLL', 'LLLkLLL', 'LLLLLLL']

function hologram(ctx: Ctx, cx: number, top: number, t: number) {
  const bust = pixelSprite('core:bust', BUST, { H: '#67e8f9', h: '#0e7490', E: '#ecfeff' })
  const flicker = Math.sin(t / 90) > 0.93 ? 0.35 : 0
  const bob = Math.round(Math.sin(t / 650) * 1.5)
  const y = top + bob
  ctx.save()
  ctx.globalAlpha = 0.75 - flicker
  ctx.shadowColor = HOLO
  ctx.shadowBlur = 14
  ctx.drawImage(bust, cx - 16, y, 32, 32)
  ctx.restore()
  // Scanlines sweep down through the projection.
  for (let row = 0; row < 32; row += 2) fill(ctx, alpha(INK, 0.35), cx - 16, y + row, 32, 1)
  const sweep = Math.floor(t / 40) % 40
  if (sweep < 32) fill(ctx, alpha('#ecfeff', 0.35), cx - 16, y + sweep, 32, 1)
}

function beam(ctx: Ctx, cx: number, from: number, to: number) {
  const gradient = ctx.createLinearGradient(0, from, 0, to)
  gradient.addColorStop(0, alpha(HOLO, 0.32))
  gradient.addColorStop(1, alpha(HOLO, 0.02))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(cx - 9, from)
  ctx.lineTo(cx + 9, from)
  ctx.lineTo(cx + 24, to)
  ctx.lineTo(cx - 24, to)
  ctx.closePath()
  ctx.fill()
}

function rings(ctx: Ctx, cx: number, cy: number, t: number) {
  ctx.lineWidth = 1
  for (let i = 0; i < 3; i++) {
    const phase = (t / 700 - i) % 3
    const glow = phase < 0.8 ? 0.55 : 0.18
    ctx.strokeStyle = alpha(HOLO, glow)
    ctx.beginPath()
    ctx.ellipse(cx, cy, 30 + i * 16, 8 + i * 4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function datacore(ctx: Ctx, cx: number, top: number, t: number, busy: boolean) {
  box(ctx, '#0b1a33', cx - 15, top, 30, 30, '#0e7490')
  fill(ctx, '#12284a', cx - 13, top + 2, 26, 3)
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(t / 180) + i * 2) % 5 < (busy ? 3 : 1)
    fill(ctx, on ? '#4ade80' : '#14335a', cx - 12 + i * 5, top + 25, 3, 2)
  }
  const lock = pixelSprite('core:lock', LOCK, { L: '#67e8f9', k: '#0b1a33' })
  ctx.save()
  ctx.shadowColor = HOLO
  ctx.shadowBlur = busy ? 10 : 4
  ctx.drawImage(lock, cx - 7, top + 8, 14, 14)
  ctx.restore()
}

function statusScreen(ctx: Ctx, x: number, y: number, font: string, active: number, total: number) {
  box(ctx, '#03101c', x, y, 66, 28, alpha(HOLO, 0.7))
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#a5f3fc'
  ctx.font = `9px ${font}`
  ctx.fillText('ĐANG CHẠY', x + 4, y + 7)
  ctx.fillStyle = '#ecfeff'
  ctx.font = `16px ${font}`
  ctx.fillText(`${active}`, x + 4, y + 18)
  const w = ctx.measureText(`${active}`).width
  ctx.fillStyle = '#67e8f9'
  ctx.font = `10px ${font}`
  ctx.fillText(`/ ${total} agent`, x + 7 + w, y + 19)
  fill(ctx, '#0b2440', x + 4, y + 24, 58, 2)
  fill(ctx, '#4ade80', x + 4, y + 24, Math.round(58 * (total > 0 ? active / total : 0)), 2)
}

function waveScreen(ctx: Ctx, x: number, y: number, t: number, busy: boolean) {
  box(ctx, '#03101c', x, y, 66, 28, alpha(HOLO, 0.7))
  const amp = busy ? 6 : 1
  for (let i = 0; i < 58; i++) {
    const v = Math.sin((i + t / 60) / 5) * Math.sin((i + t / 140) / 11)
    fill(ctx, i % 2 ? '#22d3ee' : '#67e8f9', x + 4 + i, y + 12 + Math.round(v * amp), 1, 1)
  }
  for (let b = 0; b < 6; b++) {
    const h = 2 + ((b * 7 + Math.floor(t / 300)) % (busy ? 6 : 2))
    fill(ctx, alpha('#4ade80', 0.8), x + 6 + b * 9, y + 26 - h, 5, h)
  }
}

// The AI core in the orchestration center: hologram, light beam, data core and floor rings,
// plus two wall screens with live agent counts.
export function drawCore(ctx: Ctx, room: RoomRect, t: number, font: string, active: number, total: number) {
  const core = coreRect(room)
  const cx = core.x + core.w / 2
  const top = core.y + core.h - 32
  const busy = active > 0
  rings(ctx, cx, core.y + core.h - 4, t)
  beam(ctx, cx, top, room.y + 34)
  datacore(ctx, cx, top, t, busy)
  hologram(ctx, cx, room.y + 30, t)
  statusScreen(ctx, room.x + 10, room.y + 17, font, active, total)
  waveScreen(ctx, room.x + room.w - 76, room.y + 17, t, busy)
}
