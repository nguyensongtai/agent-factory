import type { Effect, Entity } from '../entities'
import { isWalking } from '../movement'
import { INK, alpha, fill, type Ctx } from './pixels'
import { BOT_H, PERSON_H, shirtColor } from './sprites'

const LIFE_MS = 1600

const CHECK = ['......G', '.....GG', 'G...GG.', 'GG.GG..', '.GGG...', '..G....']
const BANG = ['RR', 'RR', 'RR', 'RR', '..', 'RR']

function glyph(ctx: Ctx, rows: string[], x: number, y: number, color: string) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] !== '.') fill(ctx, color, x + c, y + r, 1, 1)
  })
}

// Short-lived bursts: a green tick for finished work, a red "!" for a failed tool, a ring for arrivals.
export function drawEffects(ctx: Ctx, effects: Effect[], t: number) {
  for (const fx of effects) {
    const age = (t - fx.born) / LIFE_MS
    if (age < 0 || age > 1) continue
    const fade = 1 - age
    const rise = Math.round(age * 14)
    const color = fx.kind === 'done' ? '#4ade80' : fx.kind === 'error' ? '#ef4444' : '#22d3ee'
    ctx.strokeStyle = alpha(color, fade * 0.8)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(fx.x, fx.y, 6 + age * 14, 2 + age * 5, 0, 0, Math.PI * 2)
    ctx.stroke()
    if (fx.kind === 'spawn') continue
    const top = Math.round(fx.y - 34 - rise)
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
    const ay = owner.y - PERSON_H + 4
    const bx = bot.x
    const by = bot.y - BOT_H + 3
    const dist = Math.hypot(bx - ax, by - ay)
    if (dist < 12) continue
    const mx = (ax + bx) / 2
    const my = Math.min(ay, by) - Math.min(40, dist * 0.3)
    const color = shirtColor(bot.project)
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
