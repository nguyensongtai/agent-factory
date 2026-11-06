import { isAtDesk, isSeated, type Entity } from '../entities'
import { isWalking, tileX, tileY } from '../movement'
import { deskTop } from './dojo'
import { INK, alpha, fill, fitText, hash, type Ctx } from './pixels'
import { SCALE, apprenticeSprite, clanColor, ninjaSprite, rimOf, type Pose } from './sprites'

const HIGHLIGHT = '#67e8f9'
const RIM_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]
// Rows of the ninja sprite that show above a desk (head and shoulders).
const ABOVE_DESK = 15

function tag(ctx: Ctx, text: string, cx: number, cy: number, bg: string, fg: string, border: string) {
  const w = Math.ceil(ctx.measureText(text).width) + 6
  const left = Math.round(cx - w / 2)
  fill(ctx, border, left - 1, cy - 5, w + 2, 11)
  fill(ctx, bg, left, cy - 4, w, 9)
  ctx.fillStyle = fg
  ctx.fillText(text, left + 3, Math.round(cy) + 0.5)

  return { left, w }
}

function poseOf(e: Entity, t: number): Pose {
  if (t < e.cheerUntil) return Math.floor(t / 200) % 2 === 0 ? 'raise' : 'stand'
  if (isWalking(e)) return Math.floor(t / 130) % 2 === 0 ? 'walk1' : 'walk2'
  if (isSeated(e) || e.status === 'thinking') return 'meditate'
  if (e.status === 'asking') return 'raise'
  if (e.status === 'working') return Math.floor(t / 260) % 2 === 0 ? 'seal1' : 'seal2'

  return 'stand'
}

// Vertical offset on top of the walk: a hop while celebrating, a slow hover while meditating on a thought.
function lift(e: Entity, t: number): number {
  if (t < e.cheerUntil) return Math.round(Math.abs(Math.sin(((e.cheerUntil - t) / 1400) * Math.PI * 3)) * 4)
  if (!isWalking(e) && e.status === 'thinking' && !isAtDesk(e)) return 2 + (Math.floor(t / 500) % 2)

  return 0
}

function blinking(e: Entity, t: number): boolean {
  if (isSeated(e) && e.status === 'idle') return Math.floor(t / 2600 + (hash(e.id) % 7)) % 4 !== 0

  return (t + (hash(e.id) % 3000)) % 3200 < 140
}

// rows: sprite rows to draw; w/h: size on the floor after scaling.
type Placement = { sprite: HTMLCanvasElement; left: number; top: number; rows: number; w: number; h: number; atDesk: boolean }

function place(e: Entity, t: number): Placement {
  const back = e.facing === 'up' && isWalking(e)
  const sprite =
    e.kind === 'person'
      ? ninjaSprite(e.sessionId, e.clan, e.rank, poseOf(e, t), blinking(e, t), back)
      : apprenticeSprite(e.sessionId, e.clan, blinking(e, t))
  // A failed tool call makes the ninja shudder for a moment.
  const shake = t < e.failUntil ? (Math.floor(t / 60) % 2 ? SCALE : -SCALE) : 0
  const w = sprite.width * SCALE
  const left = Math.round(e.x - w / 2) + shake
  if (isAtDesk(e) && t >= e.cheerUntil) {
    const h = ABOVE_DESK * SCALE
    return { sprite, left, top: deskTop(Math.round(e.y)) - h, rows: ABOVE_DESK, w, h, atDesk: true }
  }
  const h = sprite.height * SCALE
  const top = Math.round(e.y - h + (isSeated(e) ? SCALE : 0)) - lift(e, t) * SCALE

  return { sprite, left, top, rows: sprite.height, w, h, atDesk: false }
}

// Scarf tail in sprite space (before the left-facing flip): streams behind while walking sideways and
// hangs down the back when walking away. Standing still, only the collar in the sprite shows.
function drawScarf(ctx: Ctx, e: Entity, left: number, top: number, t: number) {
  if (!isWalking(e)) return
  const color = clanColor(e.clan)
  const neck = top + 11 * SCALE
  if (e.facing === 'left' || e.facing === 'right') {
    for (let i = 0; i < 6; i++) {
      const wave = Math.round(Math.sin(t / 80 - i * 1.3) * (i / 2))
      fill(ctx, color, left + 6 - i * 2, neck + 2 + wave, 2, 3)
    }

    return
  }
  if (e.facing === 'up') fill(ctx, color, left + 14 + (Math.floor(t / 130) % 2) * 2, neck + 2, 4, 8)
}

function drawSprite(ctx: Ctx, e: Entity, t: number) {
  const { sprite, left, top, rows, w, h, atDesk } = place(e, t)
  const feet = Math.round(e.y)
  if (!atDesk && !isSeated(e)) {
    fill(ctx, alpha(INK, 0.55), left + 6, feet - 2, w - 12, 3)
    fill(ctx, alpha(INK, 0.55), left + 10, feet + 1, w - 20, 1)
  }
  const back = e.facing === 'up' && isWalking(e)
  const isPerson = e.kind === 'person'
  ctx.save()
  if (e.facing === 'left' && isWalking(e)) {
    ctx.translate(left * 2 + w, 0)
    ctx.scale(-1, 1)
  }
  // The scarf hangs behind the body except when the ninja walks away from us.
  if (isPerson && !back) drawScarf(ctx, e, left, top, t)
  const rim = rimOf(sprite)
  ctx.globalAlpha = 0.45
  for (const [dx, dy] of RIM_OFFSETS) ctx.drawImage(rim, 0, 0, sprite.width, rows, left + dx, top + dy, w, h)
  ctx.globalAlpha = 1
  ctx.drawImage(sprite, 0, 0, sprite.width, rows, left, top, w, h)
  if (isPerson && back) drawScarf(ctx, e, left, top, t)
  ctx.restore()
  if (t < e.failUntil) {
    const drop = Math.floor((e.failUntil - t) / 150) % 3
    fill(ctx, '#7dd3fc', left + w - 6, top + 6 + drop * 2, 2, 4)
    fill(ctx, '#e0f2fe', left + w - 6, top + 6 + drop * 2, 2, 2)
  }
}

// Bodies only, drawn before the lighting pass so lanterns and screens light them.
export function drawAgents(ctx: Ctx, entities: Map<string, Entity>, t: number) {
  const sorted = [...entities.values()].sort((a, b) => a.y - b.y)
  for (const e of sorted) drawSprite(ctx, e, t)
}

function bubbleText(e: Entity, t: number): string {
  if (e.status === 'thinking') return '.'.repeat(1 + (Math.floor(t / 350) % 3))
  if (e.status === 'asking') return '? chờ duyệt'
  if (e.status === 'idle') return ''

  return e.bubble
}

// Remaining route of the selected agent: marching dots plus a marker on the destination tile.
function drawRoute(ctx: Ctx, e: Entity, t: number) {
  if (e.path.length === 0) return
  const march = Math.floor(t / 120) % 3
  ctx.fillStyle = HIGHLIGHT
  e.path.forEach((tile, i) => {
    if ((i + march) % 3 === 0) ctx.fillRect(tileX(tile.col) - 1, tileY(tile.row) - 2, 2, 2)
  })
  const end = e.path[e.path.length - 1]
  const x = tileX(end.col)
  const y = tileY(end.row) - 2
  for (const [dx, dy] of [
    [-4, -4],
    [2, -4],
    [-4, 2],
    [2, 2],
  ]) {
    ctx.fillRect(x + dx, y + dy, 2, 2)
  }
}

function selectionMarker(ctx: Ctx, e: Entity, top: number, t: number) {
  const pulse = Math.floor(t / 250) % 2
  ctx.strokeStyle = alpha(HIGHLIGHT, 0.8)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(e.x, Math.round(e.y), 16 + pulse, 5 + pulse / 2, 0, 0, Math.PI * 2)
  ctx.stroke()
  fill(ctx, HIGHLIGHT, Math.round(e.x) - 3, top - 9 - pulse, 7, 2)
  fill(ctx, HIGHLIGHT, Math.round(e.x) - 2, top - 7 - pulse, 5, 1)
  fill(ctx, HIGHLIGHT, Math.round(e.x) - 1, top - 6 - pulse, 3, 1)
}

// Drawn after lighting so text stays readable: routes, selection, sleep marks, bubbles, and a name tag
// only for the hovered or selected agent (the tooltip carries the rest).
export function drawAgentLabels(
  ctx: Ctx,
  entities: Map<string, Entity>,
  t: number,
  font: string,
  selectedId: string | null,
  hoveredId: string | null,
) {
  const sorted = [...entities.values()].sort((a, b) => a.y - b.y)
  ctx.textBaseline = 'middle'
  ctx.font = `10px ${font}`
  for (const e of sorted) {
    const highlighted = e.ownerId === selectedId || e.id === hoveredId
    const { top } = place(e, t)
    if (highlighted) drawRoute(ctx, e, t)
    if (e.ownerId === selectedId && e.kind === 'person') selectionMarker(ctx, e, top, t)
    if (highlighted) tag(ctx, e.label, e.x, e.y + 8, HIGHLIGHT, INK, INK)
    if (e.status === 'idle') {
      if (!isSeated(e)) continue
      const drift = Math.floor(t / 180) % 10
      ctx.fillStyle = '#9fd8ef'
      ctx.fillText(drift < 5 ? 'z' : 'zZ', Math.round(e.x) + 6, Math.round(top + 2 - drift / 2))
      continue
    }
    if (e.kind === 'bot' && !highlighted && e.status === 'working') continue
    const raw = bubbleText(e, t)
    if (!raw) continue
    const stagger = e.slot % 2 === 1 ? 10 : 0
    const cy = top - 6 - stagger - (e.status === 'asking' && Math.floor(t / 300) % 2 === 0 ? 1 : 0)
    const color = e.status === 'asking' ? '#fb7185' : e.status === 'thinking' ? '#c4b5fd' : '#f1dfb8'
    const { left, w } = tag(ctx, fitText(ctx, raw, highlighted ? 140 : 76), e.x, cy, color, INK, INK)
    const tail = Math.min(Math.max(Math.round(e.x) - 1, left + 2), left + w - 4)
    fill(ctx, color, tail, cy + 5, 3, 1)
    fill(ctx, color, tail + 1, cy + 6, 1, 1)
  }
}
