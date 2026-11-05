import { findPath, type Tile, type WalkGrid } from './grid'
import { TILE } from './layout'

// Tile-by-tile walking, modelled on pixel-agents: follow a BFS path one tile at a time,
// face the direction of each step, and repath from the next tile when the goal moves.
const SPEED = 110 // logical px per second
const DWELL_SEC = 1.2 // minimum stay at a station before heading to the next one

export type Facing = 'down' | 'up' | 'left' | 'right'

export type Mover = {
  col: number
  row: number
  x: number
  y: number
  path: Tile[]
  progress: number
  goal: Tile
  repath: boolean
  dwell: number
  facing: Facing
}

export function tileX(col: number): number {
  return col * TILE + TILE / 2
}

export function tileY(row: number): number {
  return row * TILE + TILE - 2
}

export function placeAt(m: Mover, tile: Tile): void {
  m.col = tile.col
  m.row = tile.row
  m.x = tileX(tile.col)
  m.y = tileY(tile.row)
  m.path = []
  m.progress = 0
  m.repath = false
  m.facing = 'down'
}

export function setGoal(m: Mover, tile: Tile): void {
  if (m.goal.col === tile.col && m.goal.row === tile.row) return
  m.goal = tile
  m.repath = true
}

export function isWalking(m: Mover): boolean {
  return m.path.length > 0
}

export function atGoal(m: Mover): boolean {
  return m.path.length === 0 && m.col === m.goal.col && m.row === m.goal.row
}

function facingBetween(from: Tile, to: Tile): Facing {
  if (to.col > from.col) return 'right'
  if (to.col < from.col) return 'left'

  return to.row > from.row ? 'down' : 'up'
}

export function stepMover(m: Mover, dt: number, grid: WalkGrid): void {
  if (m.path.length > 0) {
    const next = m.path[0]
    m.facing = facingBetween(m, next)
    m.progress += (SPEED / TILE) * dt
    const t = Math.min(m.progress, 1)
    m.x = tileX(m.col) + (tileX(next.col) - tileX(m.col)) * t
    m.y = tileY(m.row) + (tileY(next.row) - tileY(m.row)) * t
    if (m.progress < 1) return
    m.col = next.col
    m.row = next.row
    m.x = tileX(m.col)
    m.y = tileY(m.row)
    m.path.shift()
    m.progress = 0
    if (m.repath) {
      m.path = findPath(grid, m, m.goal)
      m.repath = false
    }
    if (m.path.length === 0) {
      m.dwell = DWELL_SEC
      m.facing = 'down'
    }

    return
  }

  if (atGoal(m)) {
    m.repath = false
    m.dwell = Math.max(0, m.dwell - dt)

    return
  }
  if (m.dwell > 0) {
    m.dwell -= dt

    return
  }
  m.path = findPath(grid, m, m.goal)
  m.repath = false
  // Unreachable goal (should not happen on a connected floor): jump rather than freeze.
  if (m.path.length === 0) placeAt(m, m.goal)
}
