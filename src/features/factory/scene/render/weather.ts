import { BACKDROP_H, type FloorLayout } from '../layout'
import { falls, streamX } from './terrain'
import { fill, type Ctx } from './pixels'

// Moving parts of the landscape: the two waterfalls and the stream are drawn before lighting (so moonlight
// tints them); ripples, drifting cloud, mist and rain go on top.

function fall(ctx: Ctx, x: number, from: number, to: number, t: number, wide: boolean) {
  for (let y = from; y < to; y++) {
    const w = wide ? 4 + Math.floor((y - from) / 18) : 2
    for (let i = 0; i < w; i++) {
      const k = (y * 3 + i * 7 + Math.floor(t / 40)) % 9
      fill(ctx, k < 2 ? '#eef6ff' : k < 5 ? '#a9cdfc' : '#6fa3f0', x - w / 2 + i, y, 1, 1)
    }
  }
}

export function drawWaterfalls(ctx: Ctx, layout: FloorLayout, t: number) {
  const { main, side } = falls(layout)
  fall(ctx, main, 20, BACKDROP_H + 2, t, true)
  fall(ctx, side, 42, BACKDROP_H + 4, t, false)
  for (let k = 0; k < 6; k++) {
    const p = (t / 900 + k / 6) % 1
    ctx.fillStyle = `rgba(226,240,255,${(0.4 * (1 - p)).toFixed(2)})`
    ctx.beginPath()
    ctx.arc(main + Math.sin(k * 2.1) * 10 * p, BACKDROP_H + 2 - p * 6, 2 + p * 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawRipples(ctx: Ctx, layout: FloorLayout, t: number) {
  const stream = layout.stream
  if (!stream) return
  for (let y = stream.top + 6; y < stream.bottom - 4; y += 3) {
    fill(ctx, 'rgba(180,215,255,0.6)', streamX(stream, y) + ((y * 5 + t / 30) % 8) - 4, y, 3, 1)
  }
}

export function drawClouds(ctx: Ctx, layout: FloorLayout, t: number) {
  const span = layout.width + 80
  for (let k = 0; k < Math.ceil(layout.width / 60); k++) {
    const x = ((k * 71 + t * (0.004 + (k % 4) * 0.001)) % span) - 40
    ctx.fillStyle = 'rgba(190,205,235,0.14)'
    ctx.beginPath()
    ctx.ellipse(x, 24 + (k % 3) * 14, 28 + (k % 2) * 10, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawMist(ctx: Ctx, layout: FloorLayout, t: number) {
  const span = layout.width + 120
  for (let k = 0; k < Math.ceil(layout.width / 90); k++) {
    const x = ((k * 97 + t * 0.006) % span) - 60
    ctx.fillStyle = 'rgba(200,215,240,0.07)'
    ctx.beginPath()
    ctx.ellipse(x, BACKDROP_H + 2 + (k % 2) * 6, 46, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const DROPS_PER_PX = 0.0006

// Light night rain, slanting a little to the left.
export function drawRain(ctx: Ctx, layout: FloorLayout, t: number) {
  const { width: w, height: h } = layout
  const count = Math.round(w * h * DROPS_PER_PX)
  ctx.fillStyle = 'rgba(190,205,240,0.22)'
  for (let k = 0; k < count; k++) {
    const speed = 0.14 + (k % 5) * 0.02
    const y = (((k * 53) % h) + t * speed) % (h + 10) - 5
    const x = ((((k * 37) % w) - t * speed * 0.25) % w + w) % w
    ctx.fillRect(Math.round(x), Math.round(y), 1, 3)
  }
}
