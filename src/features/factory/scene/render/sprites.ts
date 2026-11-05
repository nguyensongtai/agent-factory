import { cachedSprite, hash, pixelSprite, shade } from './pixels'

// Pixel sprites are composed from string layers once per look/pose and cached as tiny canvases.
// Legend: O outline, S/s skin, E eye, W eye shine, B blush, M mouth, H/h hair, T/L/t shirt,
// P/p pants, K shoes, C/c cap, G glasses, A headphones.

export const PERSON_W = 16
export const PERSON_H = 24
export const BOT_W = 12
export const BOT_H = 15

const OUTLINE = '#120f1c'

const SHIRTS = ['#e4572e', '#3f88c5', '#2bb24c', '#f3a712', '#b23a7a', '#17bebb', '#ef476f', '#7b4fe0', '#06c28f', '#ff8a1c']
const HAIRS = ['#2b1d14', '#6b4226', '#e0b04c', '#24242b', '#b23a3a', '#ece4d0', '#5a5f8a', '#d96c9a']
const SKINS = ['#ffd9b8', '#f2bd8f', '#c98a5a', '#8d5a3b']
const PANTS = ['#2f3b52', '#3a3a44', '#6b5a3e', '#2c4a6e']
const ACCENTS = ['#ffd23f', '#73d99f', '#ff7a90', '#5fd3e6']

const HEAD = [
  '................',
  '................',
  '.....OOOOOO.....',
  '....OSSSSSSO....',
  '...OSSSSSSSSO...',
  '...OSSSSSSSSO...',
  '...OSEWSSEWSO...',
  '...OSEESSEESO...',
  '...OBSSSSSSBO...',
  '....OSSMMSSO....',
  '.....OssssO.....',
]
const EYES_CLOSED = { 6: '...OSSSSSSSSO...', 7: '...OSOOSSOOSO...' }

const BODY = {
  stand: [
    '....OOTTTTOO....',
    '...OTLTTTTTtO...',
    '..OTTLTTTTTTtO..',
    '..OTOTTTTTTOtO..',
    '..OSOTTTTTTOSO..',
    '...OOttttttOO...',
  ],
  type: [
    '....OOTTTTOO....',
    '...OTLTTTTTtO...',
    '..OTTLTTTTTTtO..',
    '..OTOTTTTTTOtO..',
    '...OOTSTTSTOO...',
    '...OOttttttOO...',
  ],
  raise: [
    '....OOTTTTOO.OTO',
    '...OTLTTTTTtOTO.',
    '..OTTLTTTTTTtO..',
    '..OTOTTTTTTtO...',
    '..OSOTTTTTTtO...',
    '...OOttttttOO...',
  ],
}
// Raised arm reaches above the shoulder on the right.
const RAISED_ARM: Record<number, string> = {
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
  '...OPPO..OPPO...',
  '..OKKKO..OPPO...',
  '..OOOOO.OKKKO...',
  '........OOOOO...',
]
const LEGS = {
  stand: [
    '....OPPPPPPO....',
    '....OPPpPPpO....',
    '....OPPOOPPO....',
    '....OPPOOPPO....',
    '....OPPOOPPO....',
    '...OKKKOOKKKO...',
    '...OOOOOOOOOO...',
  ],
  walk1: WALK,
  walk2: WALK.map((row) => [...row].reverse().join('')),
  sit: [
    '....OPPPPPPO....',
    '...OPPPPPPPPO...',
    '...OPPpPPpPPO...',
    '...OKKO..OKKO...',
    '...OOOO..OOOO...',
    '................',
    '................',
  ],
}

const HAIR_STYLES: Record<number, string>[] = [
  // short
  { 1: '.....OOOOOO.....', 2: '....OHHHHHHO....', 3: '...OHHHHHHHHO...', 4: '...OHHHHHHHhO...', 5: '...OHhHSSHHhO...' },
  // long
  {
    1: '.....OOOOOO.....',
    2: '....OHHHHHHO....',
    3: '...OHHHHHHHHO...',
    4: '..OHHHHHHHHHhO..',
    5: '..OHHhSSSSShHO..',
    6: '..OHH......HHO..',
    7: '..OHH......HHO..',
    8: '..OHH......HHO..',
    9: '..OHH......HHO..',
    10: '..OOO......OOO..',
  },
  // bun
  {
    0: '......OOOO......',
    1: '.....OHHhHO.....',
    2: '....OHHHHHHO....',
    3: '...OHHHHHHHHO...',
    4: '...OHHHHHHHhO...',
    5: '...OhSSSSSShO...',
  },
  // curly
  {
    0: '....OOOOOOOO....',
    1: '...OHHhHHhHHO...',
    2: '..OHHHHHHHHHhO..',
    3: '..OHhHHHHHHhHO..',
    4: '..OHHHHHHHHHhO..',
    5: '..OHhSSSSSShHO..',
    6: '..OO........OO..',
  },
  // cap
  { 1: '.....OOOOOO.....', 2: '....OCCCCCCO....', 3: '...OCCCCCCCCO...', 4: '...OCCCCCCCcO...', 5: '...OOOOOOOOOOOO.' },
]
const GLASSES = { 5: '....GGG..GGG....', 6: '....G..GG..G....' }
const HEADPHONES = {
  1: '.....AAAAAA.....',
  2: '....A......A....',
  3: '...A........A...',
  5: '..AA........AA..',
  6: '..AA........AA..',
  7: '..AA........AA..',
}

const BOT = [
  '.....OO.....',
  '.....AA.....',
  '...OOOOOO...',
  '..OBBBBBBO..',
  '.OBLBBBBBbO.',
  '.OBVVVVVVbO.',
  '.OBVEVVEVbO.',
  '.OBVVVVVVbO.',
  '..OBBBBBbO..',
  '...OOOOOO...',
  '..OCCCCCCO..',
  '.OCLCCCCcCO.',
  '.OCCCCCCccO.',
  '..OOcOOcOO..',
  '...OK..KO...',
]

export type Pose = 'stand' | 'walk1' | 'walk2' | 'type' | 'raise' | 'sit'

export function shirtColor(project: string): string {
  return SHIRTS[hash(project) % SHIRTS.length]
}

function overlay(rows: string[], layer: Record<number, string>): void {
  for (const [index, line] of Object.entries(layer)) {
    const i = Number(index)
    const base = [...rows[i]]
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') base[x] = line[x]
    rows[i] = base.join('')
  }
}

type Look = { shirt: string; hair: string; skin: string; pants: string; accent: string; style: number; extra: number }

export function lookFor(sessionId: string, project: string): Look {
  const h = hash(sessionId)

  return {
    shirt: shirtColor(project),
    hair: HAIRS[h % HAIRS.length],
    skin: SKINS[(h >>> 4) % SKINS.length],
    pants: PANTS[(h >>> 8) % PANTS.length],
    accent: ACCENTS[(h >>> 12) % ACCENTS.length],
    style: (h >>> 16) % HAIR_STYLES.length,
    // 0-1 none, 2 glasses, 3 headphones
    extra: (h >>> 20) % 4,
  }
}

// Back view: the face turns into the back of the head.
function turnAround(rows: string[]): void {
  for (let i = 2; i <= 9; i++) rows[i] = rows[i].replace(/[SEWBMG]/g, 'H').replace(/s/g, 'h')
}

export function personSprite(
  sessionId: string,
  project: string,
  pose: Pose,
  blink: boolean,
  back = false,
): HTMLCanvasElement {
  const look = lookFor(sessionId, project)
  const key = `p:${JSON.stringify(look)}:${pose}:${blink}:${back}`
  const hit = cachedSprite(key)
  if (hit) return hit
    const body = pose === 'type' || pose === 'raise' ? BODY[pose] : BODY.stand
  const legs = pose === 'walk1' || pose === 'walk2' || pose === 'sit' ? LEGS[pose] : LEGS.stand
  const rows = [...HEAD, ...body, ...legs]
  if (blink) overlay(rows, EYES_CLOSED)
  overlay(rows, HAIR_STYLES[look.style])
  if (look.extra === 2) overlay(rows, GLASSES)
  if (look.extra === 3) overlay(rows, HEADPHONES)
  if (pose === 'raise') overlay(rows, RAISED_ARM)
  if (back) turnAround(rows)

  return pixelSprite(key, rows, {
    O: OUTLINE,
    S: look.skin,
    s: shade(look.skin, -0.18),
    E: '#1b1b28',
    W: '#ffffff',
    B: '#f3a0a0',
    M: '#b5524a',
    H: look.hair,
    h: shade(look.hair, -0.3),
    T: look.shirt,
    L: shade(look.shirt, 0.3),
    t: shade(look.shirt, -0.28),
    P: look.pants,
    p: shade(look.pants, -0.3),
    K: '#2a2230',
    C: look.accent,
    c: shade(look.accent, -0.3),
    G: '#1b1b28',
    A: look.accent,
  })
}

export function botSprite(color: string, blink: boolean): HTMLCanvasElement {
  return pixelSprite(`b:${color}:${blink}`, BOT, {
    O: OUTLINE,
    A: '#ffd23f',
    B: '#d7dde6',
    L: '#ffffff',
    b: '#9aa4b2',
    V: '#14222e',
    E: blink ? '#14222e' : '#5fe3f5',
    C: color,
    c: shade(color, -0.3),
    K: '#2a2230',
  })
}
