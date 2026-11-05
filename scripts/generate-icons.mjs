// Generates every app icon from one 16x16 pixel-art mark (an AI-core chip).
// Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

const ROOT = path.resolve(import.meta.dirname, '..')
const BACKGROUND = '#020611'

const MARK = [
  '....P.P..P.P....',
  '....P.P..P.P....',
  '..BBBBBBBBBBBB..',
  '..BDDDDDDDDDDB..',
  'PPBDDDCCCCDDDBPP',
  '..BDDCLLLLCDDB..',
  'PPBDCLDDDDLCDBPP',
  '..BDCLDOODLCDB..',
  '..BDCLDOODLCDB..',
  'PPBDCLDDDDLCDBPP',
  '..BDDCLLLLCDDB..',
  'PPBDDDCCCCDDDBPP',
  '..BDDDDDDDDDDB..',
  '..BBBBBBBBBBBB..',
  '....P.P..P.P....',
  '....P.P..P.P....',
]

const PALETTE = {
  P: '#38bdf8', // pins
  B: '#0891b2', // chip edge
  D: '#0b1730', // chip body
  C: '#22d3ee', // outer ring
  L: '#a5f3fc', // inner ring
  O: '#fb923c', // core
}

if (MARK.some((row) => row.length !== MARK.length)) throw new Error('MARK must be square')

const rgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255)

// Square RGBA bitmap: the mark scaled by an integer factor, centred, on an optional background.
function bitmap(size, scale, background) {
  const pixels = new Uint8Array(size * size * 4)
  if (background) {
    const bg = rgba(background)
    for (let i = 0; i < size * size; i++) pixels.set(bg, i * 4)
  }
  const offset = Math.floor((size - MARK.length * scale) / 2)
  MARK.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]]
      if (!color) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          pixels.set(rgba(color), ((offset + y * scale + dy) * size + offset + x * scale + dx) * 4)
        }
      }
    }
  })

  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1

  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)

  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, crc])
}

function png(size, scale, background) {
  const pixels = bitmap(size, scale, background)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ICO container with PNG-compressed entries (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length

    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

function svg() {
  const rects = []
  MARK.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      if (PALETTE[ch]) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[ch]}"/>`)
      x = end
    }
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects.join('')}</svg>\n`
}

function write(relative, data) {
  const file = path.join(ROOT, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, data)
  console.info(`wrote ${relative} (${data.length} B)`)
}

write('src/app/icon.svg', svg())
write('public/brand.svg', svg())
write(
  'src/app/favicon.ico',
  ico([16, 32, 48].map((size) => ({ size, data: png(size, size / 16) }))),
)
write('src/app/apple-icon.png', png(180, 10, BACKGROUND))
write('public/icon-192.png', png(192, 10, BACKGROUND))
// Maskable: keep the mark inside the 80% safe zone.
write('public/icon-512.png', png(512, 24, BACKGROUND))
