import { isSeated, type Entity } from '../entities'
import { slotWidth } from '../layout'
import { isWalking, tileX, tileY } from '../movement'
import { drawSeat } from './furniture'
import { INK, alpha, fill, fitText, hash, type Ctx } from './pixels'
import { BOT_H, PERSON_H, botSprite, personSprite, shirtColor, type Pose } from './sprites'

const HIGHLIGHT = '#67e8f9'

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
  if (isSeated(e)) return 'sit'
  if (e.status === 'asking') return 'raise'
  if (e.status === 'working') return Math.floor(t / 220) % 2 === 0 ? 'type' : 'stand'

  return 'stand'
}

function blinking(e: Entity, t: number): boolean {
  if (isSeated(e) && e.status === 'idle') return Math.floor(t / 2600 + (hash(e.id) % 7)) % 4 !== 0

  return (t + (hash(e.id) % 3000)) % 3200 < 140
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

function drawSprite(ctx: Ctx, e: Entity, t: number, selected: boolean) {
  const seated = isSeated(e)
  if (e.station === 'resources' && e.status === 'idle') {
    drawSeat(ctx, tileX(e.home.col), tileY(e.home.row), shirtColor(e.project), t)
  }
  const back = e.facing === 'up' && isWalking(e)
  const sprite =
    e.kind === 'person'
      ? personSprite(e.sessionId, e.project, poseOf(e, t), blinking(e, t), back)
      : botSprite(shirtColor(e.project), blinking(e, t))
  const bob = !isWalking(e) && e.status === 'working' && Math.floor(t / 440) % 2 === 0 ? 1 : 0
  const left = Math.round(e.x - sprite.width / 2)
  const top = Math.round(e.y - sprite.height + bob + (seated ? 1 : 0))
  const feet = Math.round(e.y)

  if (!seated) {
    fill(ctx, alpha(INK, 0.6), left + 3, feet - 1, sprite.width - 6, 2)
    fill(ctx, alpha(INK, 0.6), left + 5, feet + 1, sprite.width - 10, 1)
  }
  if (selected) {
    // Holographic ring on the floor and a hovering marker above the head.
    const pulse = Math.floor(t / 250) % 2
    ctx.strokeStyle = alpha(HIGHLIGHT, 0.8)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(e.x, feet, 10 + pulse, 3 + pulse / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
    fill(ctx, HIGHLIGHT, Math.round(e.x) - 3, top - 9 - pulse, 7, 2)
    fill(ctx, HIGHLIGHT, Math.round(e.x) - 2, top - 7 - pulse, 5, 1)
    fill(ctx, HIGHLIGHT, Math.round(e.x) - 1, top - 6 - pulse, 3, 1)
  }
  ctx.save()
  if (e.facing === 'left' && isWalking(e)) {
    ctx.translate(left * 2 + sprite.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(sprite, left, top)
  ctx.restore()
}

export function drawEntities(
  ctx: Ctx,
  entities: Map<string, Entity>,
  t: number,
  font: string,
  selectedId: string | null,
  hoveredId: string | null,
) {
  const sorted = [...entities.values()].sort((a, b) => a.y - b.y)
  for (const e of sorted) if (e.ownerId === selectedId || e.id === hoveredId) drawRoute(ctx, e, t)
  for (const e of sorted) drawSprite(ctx, e, t, e.ownerId === selectedId && e.kind === 'person')

  // Name tags and bubbles go on top of every sprite.
  ctx.textBaseline = 'middle'
  ctx.font = `10px ${font}`
  for (const e of sorted) {
    const isPerson = e.kind === 'person'
    const highlighted = e.ownerId === selectedId || e.id === hoveredId
    const label = highlighted ? e.label : fitText(ctx, e.label, slotWidth(e.station) - 8)
    if (highlighted) tag(ctx, label, e.x, e.y + 8, HIGHLIGHT, INK, INK)
    else tag(ctx, label, e.x, e.y + 8, '#0a1628', isPerson ? '#e2e8f0' : '#a5f3fc', isPerson ? '#1e3a5f' : '#155e75')

    const height = isPerson ? PERSON_H : BOT_H
    if (e.status === 'idle') {
      if (!isSeated(e)) continue
      const drift = Math.floor(t / 180) % 10
      ctx.fillStyle = '#7dd3fc'
      ctx.fillText(drift < 5 ? 'z' : 'zZ', Math.round(e.x) + 6, Math.round(e.y - height - drift / 2))
      continue
    }
    if (!isPerson && !highlighted && e.status === 'working') continue
    const raw = bubbleText(e, t)
    if (!raw) continue
    const stagger = e.slot % 2 === 1 ? 10 : 0
    const cy = e.y - height - 8 - stagger - (e.status === 'asking' && Math.floor(t / 300) % 2 === 0 ? 1 : 0)
    const color = e.status === 'asking' ? '#fb7185' : e.status === 'thinking' ? '#c4b5fd' : '#e0f2fe'
    const { left, w } = tag(ctx, fitText(ctx, raw, highlighted ? 140 : 76), e.x, cy, color, INK, INK)
    const tail = Math.min(Math.max(Math.round(e.x) - 1, left + 2), left + w - 4)
    fill(ctx, color, tail, cy + 5, 3, 1)
    fill(ctx, color, tail + 1, cy + 6, 1, 1)
  }
}
