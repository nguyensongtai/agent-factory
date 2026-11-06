import type { Effect, Entity } from '../entities'
import { isWalking } from '../movement'
import { INK, alpha, fill, type Ctx } from './pixels'
import { BOT_H, PERSON_H, SCALE, clanColor } from './sprites'

const LIFE_MS = 1600

const CHECK = ['......G', '.....GG', 'G...GG.', 'GG.GG..', '.GGG...', '..G....']
const BANG = ['RR', 'RR', 'RR', 'RR', '..', 'RR']

function glyph(ctx: Ctx, rows: string[], x: number, y: number, color: string) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] !== '.') fill(ctx, color, x + c, y + r, 1, 1)
  })
}

// Offsets of the puffs in a smoke burst, with their starting radius.
const PUFFS = [
  [0, -6, 5],
  [-6, -3, 4],
  [6, -4, 4],
  [-3, -12, 4],
  [4, -13, 3],
  [0, -1, 4],
]
const SMOKE_MS = 900

// Ninja-style arrival and exit: a cloud of grey puffs that swells and thins out.
function drawSmoke(ctx: Ctx, fx: Effect, t: number) {
  const age = (t - fx.born) / SMOKE_MS
  if (age < 0 || age > 1) return
  const spread = 0.7 + age * 0.8
  PUFFS.forEach(([dx, dy, r], i) => {
    ctx.fillStyle = alpha(i % 2 === 0 ? '#e2e8f0' : '#94a3b8', (1 - age) * 0.85)
    ctx.beginPath()
    ctx.arc(fx.x + dx * spread, fx.y + dy * spread, r * (1 + age), 0, Math.PI * 2)
    ctx.fill()
  })
}

// Short-lived bursts: a green tick for finished work, a red "!" for a failed tool, smoke for arrivals and exits.
export function drawEffects(ctx: Ctx, effects: Effect[], t: number) {
  for (const fx of effects) {
    if (fx.kind === 'smoke') {
      drawSmoke(ctx, fx, t)
      continue
    }
    const age = (t - fx.born) / LIFE_MS
    if (age < 0 || age > 1) continue
    const fade = 1 - age
    const rise = Math.round(age * 14)
    const color = fx.kind === 'done' ? '#4ade80' : '#ef4444'
    ctx.strokeStyle = alpha(color, fade * 0.8)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(fx.x, fx.y, 6 + age * 14, 2 + age * 5, 0, 0, Math.PI * 2)
    ctx.stroke()
    const top = Math.round(fx.y - PERSON_H * SCALE - 10 - rise)
    fill(ctx, alpha(INK, fade * 0.9), fx.x - 6, top - 2, 13, 11)
    if (fx.kind === 'done') glyph(ctx, CHECK, Math.round(fx.x - 3), top, alpha(color, fade))
    else glyph(ctx, BANG, Math.round(fx.x - 1) + (Math.floor(t / 50) % 2), top, alpha(color, fade))
  }
}

// A curved data link from each agent to the subagents it delegated to, with packets flowing outwards.
export function drawLinks(ctx: Ctx, entities: Map<string, Entity>, t: number) {
  for (const bot of entities.values()) {
    if (bot.kind !== 'bot' || bot.status === 'idle') continue
    const owner = entities.get(bot.ownerId)
    if (!owner) continue
    const ax = owner.x
    const ay = owner.y - PERSON_H * SCALE + 8
    const bx = bot.x
    const by = bot.y - BOT_H * SCALE + 6
    const dist = Math.hypot(bx - ax, by - ay)
    if (dist < 12) continue
    const mx = (ax + bx) / 2
    const my = Math.min(ay, by) - Math.min(40, dist * 0.3)
    const color = clanColor(bot.clan)
    ctx.strokeStyle = alpha(color, isWalking(bot) ? 0.35 : 0.55)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.lineDashOffset = -t / 60
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.quadraticCurveTo(mx, my, bx, by)
    ctx.stroke()
    ctx.setLineDash([])
    for (let k = 0; k < 2; k++) {
      const p = ((t / 1400 + k / 2) % 1 + 1) % 1
      const x = (1 - p) * (1 - p) * ax + 2 * (1 - p) * p * mx + p * p * bx
      const y = (1 - p) * (1 - p) * ay + 2 * (1 - p) * p * my + p * p * by
      fill(ctx, '#f8fafc', x - 1, y - 1, 2, 2)
    }
  }
}
