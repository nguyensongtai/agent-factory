// Low-level pixel helpers shared by every renderer. Coordinates are logical floor pixels.
export type Ctx = CanvasRenderingContext2D

export const INK = '#050a14'
export const HOLO = '#22d3ee'

export function fill(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// Filled box with a 1px outline, the basic building block of every prop.
export function box(ctx: Ctx, color: string, x: number, y: number, w: number, h: number, outline = INK): void {
  fill(ctx, outline, x, y, w, h)
  fill(ctx, color, x + 1, y + 1, w - 2, h - 2)
}

export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)

  return h >>> 0
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  return `#${((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).padStart(6, '0')}`
}

// Negative amounts darken towards black, positive ones lighten towards white.
export function shade(hex: string, amount: number): string {
  const mixOne = (c: number) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const [r, g, b] = rgb(hex)

  return toHex(mixOne(r), mixOne(g), mixOne(b))
}

export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a)
  const cb = rgb(b)

  return toHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t)
}

export function alpha(hex: string, a: number): string {
  return `${hex.slice(0, 7)}${Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`
}

const cache = new Map<string, HTMLCanvasElement>()

export function cachedSprite(key: string): HTMLCanvasElement | undefined {
  return cache.get(key)
}

// Paints a sprite from string rows (one char per pixel, '.' is transparent) and caches it.
export function pixelSprite(key: string, rows: string[], palette: Record<string, string>): HTMLCanvasElement {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = rows[0].length
  canvas.height = rows.length
  const ctx = canvas.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  })
  cache.set(key, canvas)

  return canvas
}

export function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let end = text.length
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--

  return `${text.slice(0, end)}…`
}
