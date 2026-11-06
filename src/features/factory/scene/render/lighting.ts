import type { StationId } from '../../domain/types'
import { BACKDROP_H, coreRect, type FloorLayout, type Rect } from '../layout'
import { andonSpots, lanternXs, pagodaTiers, toroSpots } from './dojo'

// Night-time lighting for the village. A light map is computed per pixel only when the set of lit rooms or
// busy desks changes, then composited every frame: `mul` darkens (multiply), `add` brightens (lighter).
// Levels are stepped with an ordered dither so the falloff reads as pixel art instead of a smooth blur.

type Light = { x: number; y: number; r: number; i: number; c: [number, number, number]; bounds: Rect }
export type Point = { x: number; y: number }
export type LightMaps = { key: string; mul: HTMLCanvasElement; add: HTMLCanvasElement }

// Moonlight: the mountains catch more of it than the forest floor.
const AMBIENT: [number, number, number] = [0.44, 0.48, 0.7]
const SKY: [number, number, number] = [0.78, 0.82, 1.0]
const WARM: [number, number, number] = [1.35, 0.88, 0.52]
const WARM_POOL: [number, number, number] = [1.25, 0.92, 0.62]
const SCREEN: [number, number, number] = [0.35, 0.85, 1.15]
const STEP = 1 / 10
const MAX_LEVEL = 1.45
const ADD_STRENGTH = 80
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5)

export function lightKey(lit: Set<StationId>, desks: Point[]): string {
  return `${[...lit].sort().join(',')}|${desks.map((d) => `${d.x},${d.y}`).join(';')}`
}

function lightsFor(layout: FloorLayout, lit: Set<StationId>, desks: Point[]): Light[] {
  const lights: Light[] = []
  for (const room of Object.values(layout.rooms)) {
    if (!lit.has(room.station.id)) continue
    // Lantern light stays mostly inside the hall but spills onto its veranda.
    const bounds = { x: room.x - 4, y: room.y - 8, w: room.w + 8, h: room.h + 16 }
    for (const x of lanternXs(room)) {
      lights.push({ x, y: room.y + 24, r: 46, i: 0.85, c: WARM, bounds })
      for (let y = room.y + 100; y < room.y + room.h + 40; y += 96) lights.push({ x, y, r: 110, i: 0.7, c: WARM_POOL, bounds })
    }
  }
  const all = { x: 0, y: 0, w: layout.width, h: layout.height }
  for (const [x, y] of andonSpots(layout)) lights.push({ x, y: y - 4, r: 22, i: 0.7, c: WARM, bounds: all })
  for (const [x, y] of toroSpots(layout)) lights.push({ x: x + 4, y: y + 6, r: 28, i: 0.7, c: WARM, bounds: all })
  for (const tier of pagodaTiers(layout.rooms.orchestration)) {
    lights.push({ x: tier.x + tier.w / 2, y: tier.y + 10, r: 36, i: 0.55, c: WARM, bounds: all })
  }
  // The shrine's hologram glows whether or not anyone is in the hall.
  const hall = layout.rooms.orchestration
  const core = coreRect(hall)
  lights.push({ x: core.x + core.w / 2, y: core.y + core.h - 40, r: 80, i: 0.55, c: SCREEN, bounds: hall })
  for (const d of desks) {
    const room = Object.values(layout.rooms).find((r) => d.x >= r.x && d.x < r.x + r.w && d.y >= r.y && d.y < r.y + r.h)
    if (room) lights.push({ x: d.x, y: d.y, r: 24, i: 0.9, c: SCREEN, bounds: room })
  }

  return lights
}

function accumulate(layout: FloorLayout, lights: Light[]): Float32Array {
  const { width: w, height: h } = layout
  const sum = new Float32Array(w * h * 3)
  for (let i = 0; i < w * h; i++) sum.set(i < w * (BACKDROP_H + 6) ? SKY : AMBIENT, i * 3)
  for (const l of lights) {
    const x0 = Math.max(l.bounds.x, Math.floor(l.x - l.r))
    const x1 = Math.min(l.bounds.x + l.bounds.w, Math.ceil(l.x + l.r))
    const y0 = Math.max(l.bounds.y, Math.floor(l.y - l.r))
    const y1 = Math.min(l.bounds.y + l.bounds.h, Math.ceil(l.y + l.r))
    const r2 = l.r * l.r
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x - l.x
        const dy = (y - l.y) * 1.25
        const d2 = dx * dx + dy * dy
        if (d2 >= r2) continue
        const f = (1 - Math.sqrt(d2) / l.r) ** 2 * l.i
        const k = (y * w + x) * 3
        sum[k] += l.c[0] * f
        sum[k + 1] += l.c[1] * f
        sum[k + 2] += l.c[2] * f
      }
    }
  }

  return sum
}

function canvasOf(layout: FloorLayout, pixels: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  canvas.getContext('2d')!.putImageData(pixels, 0, 0)

  return canvas
}

export function buildLightMaps(layout: FloorLayout, lit: Set<StationId>, desks: Point[]): LightMaps {
  const { width: w, height: h } = layout
  const sum = accumulate(layout, lightsFor(layout, lit, desks))
  const mul = new ImageData(w, h)
  const add = new ImageData(w, h)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const r = sum[i * 3]
    const g = sum[i * 3 + 1]
    const b = sum[i * 3 + 2]
    // Step the brightness (not each channel) so the hue never bands into rings.
    const level = (r + g + b) / 3
    const dither = BAYER[(((i / w) | 0) & 3) * 4 + ((i % w) & 3)]
    const stepped = Math.min(MAX_LEVEL, Math.max(STEP, Math.round(level / STEP + dither) * STEP))
    const k = stepped / level
    const channels = [r * k, g * k, b * k]
    for (let c = 0; c < 3; c++) {
      mul.data[j + c] = Math.min(1, channels[c]) * 255
      add.data[j + c] = Math.max(0, channels[c] - 1) * ADD_STRENGTH
    }
    mul.data[j + 3] = 255
    add.data[j + 3] = 255
  }

  return { key: lightKey(lit, desks), mul: canvasOf(layout, mul), add: canvasOf(layout, add) }
}

export function drawLighting(ctx: CanvasRenderingContext2D, maps: LightMaps) {
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(maps.mul, 0, 0)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(maps.add, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}
