import { BACKDROP_H, GAP, OUTER, TILE, type FloorLayout, type Stream } from '../layout'
import { fill, shade, type Ctx } from './pixels'

// The forest clearing around the halls: a mountain backdrop with three layers of rock spires, grass, dirt
// paths in the gaps, a pine forest along the edges and a stream with wooden bridges. All static.

export type Rand = () => number

export function random(seed: number): Rand {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff

    return s / 0x7fffffff
  }
}

// Centre of the stream at a given height: it meanders a little inside its path.
export function streamX(stream: Stream, y: number): number {
  return stream.x + Math.sin(y / 22) * 3
}

// Where the main waterfall sits and where the thin side fall drops, both in the backdrop.
export function falls(layout: FloorLayout): { main: number; side: number } {
  return { main: layout.stream?.x ?? Math.round(layout.width * 0.8), side: Math.round(layout.width * 0.14) }
}

function spire(ctx: Ctx, cx: number, w: number, top: number, bottom: number, tone: string, rim: string) {
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / (bottom - top)
    const jag = Math.round(Math.sin(y * 0.9 + cx) * 1.5 + Math.sin(y * 0.31 + cx * 0.7) * 2)
    const half = Math.max(2, Math.round((w / 2) * (0.3 + 0.7 * Math.sqrt(t))) + jag)
    fill(ctx, tone, cx - half, y, half * 2, 1)
    fill(ctx, rim, cx - half, y, 1, 1)
    fill(ctx, shade(tone, -0.25), cx + half - 2, y, 2, 1)
    if ((y + cx) % 13 === 0) fill(ctx, shade(tone, 0.08), cx - half + 2, y, Math.max(1, half - 4), 1)
  }
}

function pineSilhouette(ctx: Ctx, x: number, y: number, size: number, color: string) {
  for (let r = 0; r < size; r++) fill(ctx, color, x - Math.floor(r / 2), y + r, r + 1, 1)
}

function backdrop(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  const bottom = BACKDROP_H + 6
  const sky = ['#18244a', '#1c2a55', '#21325f', '#273a6a']
  for (let y = 0; y < bottom; y++) fill(ctx, sky[Math.min(3, Math.floor(y / 20))], 0, y, layout.width, 1)
  for (let i = 0; i < layout.width / 9; i++) fill(ctx, '#9fb0d8', Math.floor(rand() * layout.width), Math.floor(rand() * 26), 1, 1)
  const moon = Math.round(layout.width * 0.07)
  fill(ctx, '#d9e1f2', moon, 7, 10, 10)
  fill(ctx, '#eef2fb', moon + 1, 8, 7, 7)
  fill(ctx, '#18244a', moon + 7, 7, 3, 3)
  const { main, side } = falls(layout)
  const layers: [number, number, number, string, string][] = [
    // spacing, min top, top spread, tone, rim
    [38, 8, 16, '#3a4f86', '#6f86c0'],
    [56, 26, 14, '#2b3d6e', '#5a72ad'],
    [70, 38, 14, '#1f2d55', '#6b84c2'],
  ]
  layers.forEach(([spacing, minTop, spread, tone, rim], depth) => {
    for (let x = Math.floor(rand() * spacing); x < layout.width + spacing; x += spacing - 6 + Math.floor(rand() * 12)) {
      const top = minTop + Math.floor(rand() * spread)
      spire(ctx, x, 22 + Math.floor(rand() * 12), top, bottom, tone, rim)
      if (depth > 0) pineSilhouette(ctx, x - 3, top - 6, 7, depth === 2 ? '#1d3d33' : '#1f3a3a')
      if (depth === 2) pineSilhouette(ctx, x + 6, top + 12, 6, '#25503f')
    }
    if (depth < 2) for (let i = 0; i < 6; i++) fill(ctx, `rgba(170,190,230,${(0.04 + 0.03 * Math.min(i, 5 - i)).toFixed(2)})`, 0, minTop + spread + 6 + i, layout.width, 1)
  })
  // Rock walls the two waterfalls drop down.
  spire(ctx, main, 30, 18, bottom, '#1f2d55', '#6b84c2')
  spire(ctx, side, 26, 40, bottom, '#1f2d55', '#6b84c2')
  fill(ctx, '#1e3a63', main - 16, BACKDROP_H - 2, 32, 8)
  fill(ctx, '#2a4d80', main - 13, BACKDROP_H - 1, 26, 6)
}

function grass(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  const top = BACKDROP_H + 4
  fill(ctx, '#2f4b38', 0, top, layout.width, layout.height - top)
  for (let i = 0; i < (layout.width * (layout.height - top)) / 6; i++) {
    const r = rand()
    fill(ctx, r < 0.5 ? '#36573f' : '#284232', Math.floor(rand() * layout.width), top + Math.floor(rand() * (layout.height - top)), 1, 1)
  }
  for (let i = 0; i < layout.width; i++) {
    const x = Math.floor(rand() * layout.width)
    const y = top + 4 + Math.floor(rand() * (layout.height - top - 4))
    fill(ctx, '#4a7357', x, y, 1, 2)
    fill(ctx, '#4a7357', x + 2, y + 1, 1, 1)
  }
}

function dirt(ctx: Ctx, x: number, y: number, w: number, h: number, rand: Rand) {
  fill(ctx, '#6a5a44', x, y, w, h)
  for (let i = 0; i < (w * h) / 14; i++) fill(ctx, rand() < 0.5 ? '#7d6c52' : '#5e4f3b', x + Math.floor(rand() * w), y + Math.floor(rand() * h), 2, 1)
}

// Dirt paths along the middle of every gap between halls, and one tile in from the forest edge.
function paths(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  const half = TILE / 2
  const edge = OUTER - TILE
  const bottom = layout.height - OUTER
  for (const room of Object.values(layout.rooms)) {
    const below = room.y + room.h + GAP / 2
    dirt(ctx, Math.max(edge, room.x - GAP / 2 - half), below - half, room.w + GAP + TILE, TILE, rand)
    for (const x of [room.x - GAP / 2, room.x + room.w + GAP / 2]) {
      dirt(ctx, Math.max(edge, x - half), room.y - GAP / 2 - half, TILE, room.h + GAP + TILE, rand)
    }
  }
  dirt(ctx, edge, BACKDROP_H + GAP, TILE, bottom - BACKDROP_H - GAP + TILE, rand)
  dirt(ctx, layout.width - OUTER, BACKDROP_H + GAP, TILE, bottom - BACKDROP_H - GAP + TILE, rand)
  dirt(ctx, edge, bottom, layout.width - edge * 2, TILE, rand)
}

export function pine(ctx: Ctx, x: number, y: number, size: number) {
  fill(ctx, 'rgba(0,0,0,0.35)', x - size / 2, y + 1, size, 3)
  fill(ctx, '#4a2d1a', x - 1, y - 4, 2, 5)
  for (let tier = 0; tier < 3; tier++) {
    const top = y - 4 - size + tier * (size / 3)
    for (let r = 0; r < size / 2; r++) {
      const half = Math.floor((r + tier * 2) * 0.7) + 1
      fill(ctx, '#2a5a44', x - half, top + r, half * 2, 1)
      fill(ctx, '#3f7f5f', x - half, top + r, Math.max(1, half - 1), 1)
    }
  }
  fill(ctx, '#5aa07a', x - 1, y - 4 - size, 1, 2)
}

function bush(ctx: Ctx, x: number, y: number) {
  fill(ctx, '#244a35', x, y + 1, 9, 4)
  fill(ctx, '#2f6045', x + 1, y, 7, 3)
  fill(ctx, '#46885f', x + 2, y, 3, 1)
}

// Pines along the left, right and bottom edges, plus bushes peeking out between them.
function forest(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  const band = OUTER - TILE
  const trees: [number, number, number][] = []
  for (let y = BACKDROP_H + 18; y < layout.height + 8; y += 12 + Math.floor(rand() * 6)) {
    trees.push([4 + Math.floor(rand() * (band - 6)), y, 11 + Math.floor(rand() * 5)])
    trees.push([layout.width - 4 - Math.floor(rand() * (band - 6)), y, 11 + Math.floor(rand() * 5)])
  }
  for (let x = band; x < layout.width - band; x += 13 + Math.floor(rand() * 6)) {
    trees.push([x, layout.height - 2 + Math.floor(rand() * 4), 10 + Math.floor(rand() * 5)])
  }
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, size]) => pine(ctx, x, y, size))
  for (let y = BACKDROP_H + 30; y < layout.height - 20; y += 47) {
    bush(ctx, band - 4, y)
    bush(ctx, layout.width - band - 6, y + 20)
  }
}

function streamBed(ctx: Ctx, layout: FloorLayout) {
  const stream = layout.stream
  if (!stream) return
  for (let y = stream.top + 4; y < stream.bottom; y++) {
    const cx = streamX(stream, y)
    fill(ctx, '#1d2b22', cx - 7, y, 14, 1)
    fill(ctx, '#2a4d80', cx - 5, y, 10, 1)
  }
  // A small pool where the stream ends above the shrine.
  fill(ctx, '#1d2b22', stream.x - 12, stream.bottom - 6, 24, 9)
  fill(ctx, '#2a4d80', stream.x - 10, stream.bottom - 5, 20, 7)
  for (const bridge of stream.bridges) {
    const y = bridge.y + Math.round(bridge.h / 2)
    if (y > stream.bottom - 6) continue
    const cx = Math.round(streamX(stream, y))
    fill(ctx, '#2b1a0f', cx - 10, y - 5, 20, 11)
    for (let i = 0; i < 20; i += 3) fill(ctx, i % 2 ? '#7a4e2e' : '#6b4426', cx - 10 + i, y - 4, 2, 9)
    fill(ctx, '#9a6a3e', cx - 10, y - 6, 20, 1)
    fill(ctx, '#9a6a3e', cx - 10, y + 6, 20, 1)
    fill(ctx, '#2b1a0f', cx - 11, y - 9, 2, 4)
    fill(ctx, '#2b1a0f', cx + 9, y - 9, 2, 4)
  }
}

export function renderTerrain(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  backdrop(ctx, layout, rand)
  grass(ctx, layout, rand)
  paths(ctx, layout, rand)
  streamBed(ctx, layout)
}

export function renderForest(ctx: Ctx, layout: FloorLayout, rand: Rand) {
  forest(ctx, layout, rand)
}
