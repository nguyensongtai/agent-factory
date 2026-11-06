import { coreRect, type Rect, type RoomRect } from '../layout'
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

const CRYSTAL = ['..C..', '.CcC.', 'CcLcC', 'CcccC', '.CcC.', '..C..']

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

// A data crystal resting on the shrine's stone pedestal; it pulses faster while agents are busy.
function crystal(ctx: Ctx, cx: number, top: number, t: number, busy: boolean) {
  const sprite = pixelSprite('core:crystal', CRYSTAL, { C: '#22d3ee', c: '#0e7490', L: '#ecfeff' })
  ctx.save()
  ctx.shadowColor = HOLO
  ctx.shadowBlur = busy ? 10 + 4 * Math.sin(t / 200) : 4
  ctx.drawImage(sprite, cx - 5, top + 6, 10, 12)
  ctx.restore()
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(t / 180) + i * 2) % 5 < (busy ? 3 : 1)
    fill(ctx, on ? '#4ade80' : '#2a2c33', cx - 12 + i * 5, top + 24, 3, 2)
  }
}

export type BoardCounts = { running: number; approval: number; completed: number }

// The village Mission Board hangs in the Command Tower: live counts of real missions; clicking it opens
// the Missions page (see FloorView).
export function missionBoardRect(room: RoomRect): Rect {
  return { x: room.x + 8, y: room.y + 13, w: 70, h: 32 }
}

function missionBoard(ctx: Ctx, room: RoomRect, font: string, counts: BoardCounts) {
  const { x, y, w, h } = missionBoardRect(room)
  fill(ctx, '#3b2414', x, y, w, h)
  fill(ctx, '#1a120c', x + 2, y + 2, w - 4, h - 4)
  fill(ctx, '#f43f5e', x, y, w, 1)
  ctx.textBaseline = 'middle'
  ctx.font = `9px ${font}`
  ctx.fillStyle = '#fda4af'
  ctx.fillText('BẢNG NHIỆM VỤ', x + 5, y + 7)
  const rows: [string, number, string][] = [
    ['đang chạy', counts.running, '#22d3ee'],
    ['chờ duyệt', counts.approval, '#fb7185'],
    ['đã xong', counts.completed, '#4ade80'],
  ]
  rows.forEach(([label, value, color], i) => {
    const ry = y + 14 + i * 6
    fill(ctx, color, x + 5, ry - 1, 2, 2)
    ctx.fillStyle = '#e2d6c0'
    ctx.font = `8px ${font}`
    ctx.fillText(label, x + 10, ry)
    ctx.fillStyle = color
    ctx.fillText(String(value), x + w - 14, ry)
  })
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

// The glowing parts of the shrine in the orchestration hall: hologram, light beam, crystal and floor rings,
// plus the Mission Board and a wave tablet on the wall. The stone itself is part of the static floor (dojo.ts).
export function drawCore(ctx: Ctx, room: RoomRect, t: number, font: string, busy: boolean, counts: BoardCounts) {
  const core = coreRect(room)
  const cx = core.x + core.w / 2
  const top = core.y + core.h - 34
  rings(ctx, cx, core.y + core.h - 4, t)
  beam(ctx, cx, top, room.y + 34)
  crystal(ctx, cx, top, t, busy)
  hologram(ctx, cx, room.y + 30, t)
  missionBoard(ctx, room, font, counts)
  waveScreen(ctx, room.x + room.w - 76, room.y + 17, t, busy)
}
