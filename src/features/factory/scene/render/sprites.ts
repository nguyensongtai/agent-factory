import { RANKS, type Rank } from '../../domain/ranks'
import { STATION_BY_ID } from '../../domain/stations'
import type { StationId } from '../../domain/types'
import { cachedSprite, hash, pixelSprite, shade } from './pixels'

// Original pixel ninjas, composed from string layers once per look/pose and cached as tiny canvases.
// Each agent wears the colour of its clan (the zone it works in most) and a belt in its rank colour;
// headgear and skin vary per session.
// Legend: O outline, S/s skin, E eye, W eye shine, M mouth, H/h hair or hood, F/f face cloth, Z/z straw hat,
// N scarf, T/L/t top, Y belt, C factory chip, P/p trousers, k shin wraps, K tabi.

export const PERSON_W = 16
export const PERSON_H = 24
export const BOT_W = 12
export const BOT_H = 15
// Characters are drawn at twice the scenery's pixel size so they read clearly on the whole-village map.
export const SCALE = 2

const OUTLINE = '#120f1c'

const HOODS = ['#1f2433', '#2a2438', '#1d2b2a', '#2e2626']
const HAIRS = ['#1c1917', '#3b2a1e', '#5b3a29', '#1f2a44', '#4a1d2e', '#6b4f3a']
const SKINS = ['#ffd9b8', '#f2bd8f', '#c98a5a', '#8d5a3b']
const TROUSERS = ['#1e2433', '#232634', '#2a2f3d', '#1b2230']
const CHIP = '#22d3ee'

const HEAD = [
  '................',
  '................',
  '.....OOOOOO.....',
  '....OSSSSSSO....',
  '...OSSSSSSSSO...',
  '...OSSSSSSSSO...',
  '...OSEWSSEWSO...',
  '...OSEESSEESO...',
  '...OSSSSSSSSO...',
  '....OSSMMSSO....',
  '.....OssssO.....',
]

type Layer = Record<number, string>

// Headgear styles. Hood and straw hat hide the hair; the other two show it.
const HOOD: Layer = {
  1: '.....OOOOOO.....',
  2: '....OHHHHHHO....',
  3: '...OHHHHHHHHO...',
  4: '...OHHHHHHHHOTO.',
  5: '...OHHHHHHHhO.TO',
  6: '...OHEWSSEWhO...',
  7: '...OHEESSEEhO...',
  8: '...OHHHHHHHhO...',
  9: '....OHHHHHhO....',
  10: '.....OhhhhO.....',
}
const TOPKNOT: Layer = {
  0: '......OOOO......',
  1: '......OHhO......',
  2: '....OOHHHHOO....',
  3: '...OHHHHHHHHO...',
  4: '...OHHHHHHHhO...',
  5: '...OHhSSSSShO...',
  8: '...OFFFFFFFFO...',
  9: '....OFFFFFFO....',
  10: '.....OffffO.....',
}
const PONYTAIL: Layer = {
  1: '.....OOOOOO.....',
  2: '....OHHHHHHO....',
  3: '...OHHHHHHHHOO..',
  4: '...OHHHHHHHhOHO.',
  5: '...OHhSSSSShOHO.',
  6: '.............HO.',
  7: '............OhO.',
  8: '.............O..',
}
const STRAW_HAT: Layer = {
  1: '.......OO.......',
  2: '.....OOZZOO.....',
  3: '...OOZZZZZZOO...',
  4: '.OOZZZZZZZZZZOO.',
  5: 'OzzzzzzzzzzzzzzO',
  6: '.OOOOOOOOOOOOOO.',
  7: '...OsWssssWsO...',
  8: '...OFFFFFFFFO...',
  9: '....OFFFFFFO....',
  10: '.....OffffO.....',
}
const HEADGEAR = [HOOD, TOPKNOT, PONYTAIL, STRAW_HAT]

const BODY = {
  stand: [
    '....ONNNNNNO....',
    '...OTLTtTTTtO...',
    '..OTTLTTtTTTtO..',
    '..OTOTTTTTTOtO..',
    '..OSOYYCYYYOSO..',
    '...OOttttttOO...',
  ],
  // Two hand-seal frames: palms together at the chest, then raised to the chin.
  seal1: [
    '....ONNNNNNO....',
    '...OTLTtTTTtO...',
    '..OTTOSSSSOTtO..',
    '..OTTTOSSOTTtO..',
    '...OYYYCYYYYO...',
    '...OOttttttOO...',
  ],
  seal2: [
    '....ONNNNNNO....',
    '...OTOSSSSOtO...',
    '..OTTTOSSOTTtO..',
    '..OTTTTTTTTTtO..',
    '...OYYYCYYYYO...',
    '...OOttttttOO...',
  ],
  raise: [
    '....ONNNNNNO.OTO',
    '...OTLTtTTTtOTO.',
    '..OTTLTTtTTTtO..',
    '..OTOTTTTTTtO...',
    '..OSOYYCYYYYO...',
    '...OOttttttOO...',
  ],
  meditate: [
    '....ONNNNNNO....',
    '...OTLTtTTTtO...',
    '..OTTLTTtTTTtO..',
    '..OTTTTTTTTTtO..',
    '..OTOSSYYSSOtO..',
    '...OOttttttOO...',
  ],
}
// Raised arm reaches above the shoulder on the right.
const RAISED_ARM: Layer = {
  6: '.............OO.',
  7: '............OSSO',
  8: '............OSSO',
  9: '............OTO.',
  10: '............OTO.',
}

const WALK = [
  '....OPPPPPPO....',
  '....OPPOOPPO....',
  '...OPPO..OPPO...',
  '...OkkO..OkkO...',
  '..OKKKO..OkkO...',
  '..OOOOO.OKKKO...',
  '........OOOOO...',
]
const LEGS = {
  stand: [
    '....OPPPPPPO....',
    '....OPPpPPpO....',
    '....OPPOOPPO....',
    '....OkkOOkkO....',
    '....OkkOOkkO....',
    '...OKKKOOKKKO...',
    '...OOOOOOOOOO...',
  ],
  walk1: WALK,
  walk2: WALK.map((row) => [...row].reverse().join('')),
  // Cross-legged; the empty rows keep every pose the same height.
  crossed: [
    '..OPPPPPPPPPPO..',
    '.OPPPpPPPPpPPPO.',
    '.OKKPPPPPPPPKKO.',
    '.OOOOOOOOOOOOOO.',
    '................',
    '................',
    '................',
  ],
}

const APPRENTICE = [
  '............',
  '...OOOOOO...',
  '..OHHHHHHO..',
  '.OHHHHHHHhOT',
  '.OSEWSSEWSO.',
  '.OSEESSEESO.',
  '.OHHHHHHHhO.',
  '..OhhhhhhO..',
  '..ONNNNNNO..',
  '.OTTLTTTtTO.',
  '.OSTTTTTTSO.',
  '..OYYCYYYO..',
  '..OPPOOPPO..',
  '..OKKOOKKO..',
  '..OOOOOOOO..',
]

export type Pose = 'stand' | 'walk1' | 'walk2' | 'seal1' | 'seal2' | 'raise' | 'meditate'

export function clanColor(clan: StationId): string {
  return STATION_BY_ID[clan].accent
}

function overlay(rows: string[], layer: Layer): void {
  for (const [index, line] of Object.entries(layer)) {
    const i = Number(index)
    const base = [...rows[i]]
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') base[x] = line[x]
    rows[i] = base.join('')
  }
}

// Closed eyes: the shine disappears and the lower eye row becomes a line.
function closeEyes(rows: string[]): void {
  for (let i = 4; i <= 7; i++) {
    if (rows[i].includes('EW')) {
      rows[i] = rows[i].replace(/EW/g, 'SS')
      rows[i + 1] = rows[i + 1].replace(/EE/g, 'OO')
    } else {
      rows[i] = rows[i].replace(/W/g, 's')
    }
  }
}

// Back view: the face turns into the back of the head (or hood).
function turnAround(rows: string[]): void {
  for (let i = 2; i <= 10; i++) rows[i] = rows[i].replace(/[SEWMF]/g, 'H').replace(/[sf]/g, 'h')
}

type Look = { clan: string; style: number; hair: string; skin: string; trousers: string; belt: string }

function lookFor(sessionId: string, clan: StationId, rank: Rank): Look {
  const h = hash(sessionId)
  const style = (h >>> 16) % HEADGEAR.length

  return {
    clan: clanColor(clan),
    style,
    // Hooded ninjas get a dark cloth colour instead of hair.
    hair: style === 0 ? HOODS[h % HOODS.length] : HAIRS[h % HAIRS.length],
    skin: SKINS[(h >>> 4) % SKINS.length],
    trousers: TROUSERS[(h >>> 8) % TROUSERS.length],
    belt: RANKS[rank].color,
  }
}

function palette(look: Look): Record<string, string> {
  return {
    O: OUTLINE,
    S: look.skin,
    s: shade(look.skin, -0.18),
    E: '#1b1b28',
    W: '#ffffff',
    M: '#b5524a',
    H: look.hair,
    h: shade(look.hair, -0.3),
    F: '#1f2937',
    f: '#111827',
    Z: '#d6b46a',
    z: '#a8873f',
    // Deep clan tone for the gi, the bright clan colour on the scarf so the zone still reads at a glance.
    N: look.clan,
    T: shade(look.clan, -0.45),
    L: shade(look.clan, -0.3),
    t: shade(look.clan, -0.62),
    Y: look.belt,
    C: CHIP,
    P: look.trousers,
    p: shade(look.trousers, -0.3),
    k: '#94a3b8',
    K: '#141821',
  }
}

export function ninjaSprite(
  sessionId: string,
  clan: StationId,
  rank: Rank,
  pose: Pose,
  blink: boolean,
  back = false,
): HTMLCanvasElement {
  const look = lookFor(sessionId, clan, rank)
  const key = `n:${JSON.stringify(look)}:${pose}:${blink}:${back}`
  const hit = cachedSprite(key)
  if (hit) return hit
  const walking = pose === 'walk1' || pose === 'walk2'
  const body = walking ? BODY.stand : BODY[pose]
  const legs = walking ? LEGS[pose] : pose === 'meditate' ? LEGS.crossed : LEGS.stand
  const rows = [...HEAD, ...body, ...legs]
  overlay(rows, HEADGEAR[look.style])
  if (blink) closeEyes(rows)
  if (back) turnAround(rows)
  if (pose === 'raise') overlay(rows, RAISED_ARM)

  return pixelSprite(key, rows, palette(look))
}

// Subagents are smaller hooded apprentices wearing their owner's clan colour.
export function apprenticeSprite(sessionId: string, clan: StationId, blink: boolean): HTMLCanvasElement {
  const look = { ...lookFor(sessionId, clan, 'genin'), hair: HOODS[hash(sessionId) % HOODS.length] }
  const key = `a:${JSON.stringify(look)}:${blink}`
  const hit = cachedSprite(key)
  if (hit) return hit
  const rows = [...APPRENTICE]
  if (blink) closeEyes(rows)

  return pixelSprite(key, rows, palette(look))
}

const rims = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

// Solid light silhouette of a sprite, drawn offset around it as a soft rim so ninjas stand out at night.
export function rimOf(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const hit = rims.get(sprite)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = sprite.width
  canvas.height = sprite.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(sprite, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#cfe6ff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  rims.set(sprite, canvas)

  return canvas
}
