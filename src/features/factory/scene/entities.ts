import { rankOf, type Rank } from '../domain/ranks'
import { clanOf } from '../domain/stations'
import type { AgentSnapshot, AgentStatus, StationId, ToolCall } from '../domain/types'
import type { Tile, WalkGrid } from './grid'
import { DESK_ROOMS, slotCount, slotTile, type FloorLayout } from './layout'
import { atGoal, isWalking, placeAt, setGoal, stepMover, type Mover } from './movement'
import { BOT_H, BOT_W, PERSON_H, PERSON_W, SCALE } from './render/sprites'

// Resting agents get up now and then, stroll around the resource center and come back,
// like pixel-agents' wander loop (shorter timers so it is visible while you watch).
const WANDER_EVERY_MIN = 12
const WANDER_EVERY_MAX = 40
const WANDER_PAUSE_MIN = 2
const WANDER_PAUSE_MAX = 5
const CHEER_MS = 1400
const FAIL_MS = 1200

export type Entity = Mover & {
  id: string
  kind: 'person' | 'bot'
  ownerId: string
  sessionId: string
  project: string
  label: string
  bubble: string
  status: AgentStatus
  station: StationId
  // Outfit colour: the zone the owning agent works in most.
  clan: StationId
  // Belt colour; subagents are apprentices and always genin.
  rank: Rank
  errorId: string
  slot: number
  // Whether this seat has a desk the agent sits at while working.
  hasDesk: boolean
  home: Tile
  wandering: boolean
  wanderTimer: number
  // Scene time until which the agent celebrates a finished task (arms up).
  cheerUntil: number
  // Scene time until which the agent shakes after a failed tool call.
  failUntil: number
}

export type Effect = { kind: 'done' | 'error' | 'smoke'; x: number; y: number; born: number }

export type Scene = { entities: Map<string, Entity>; effects: Effect[] }

type EntityInit = Pick<
  Entity,
  'id' | 'kind' | 'ownerId' | 'sessionId' | 'project' | 'label' | 'bubble' | 'status' | 'station' | 'clan' | 'rank' | 'errorId'
>

const random = (min: number, max: number) => min + Math.random() * (max - min)

export function createScene(): Scene {
  return { entities: new Map(), effects: [] }
}

function toolBubble(call: ToolCall | null): string {
  if (!call) return ''

  return `${call.name === 'Bash' ? '$ ' : ''}${call.detail || call.name}`
}

// Newest failed call among the last few, so a fresh failure can flash once.
function errorIdOf(recent: ToolCall[]): string {
  return recent.slice(0, 3).find((c) => c.isError)?.id ?? ''
}

function initsFor(agents: AgentSnapshot[]): EntityInit[] {
  const items: EntityInit[] = []
  for (const agent of agents) {
    const clan = clanOf(agent.zones)
    items.push({
      id: agent.id,
      kind: 'person',
      ownerId: agent.id,
      sessionId: agent.id,
      project: agent.project,
      label: agent.name,
      bubble: toolBubble(agent.current),
      status: agent.status,
      station: agent.station,
      clan,
      rank: rankOf(agent),
      errorId: errorIdOf(agent.recent),
    })
    for (const sub of agent.subagents) {
      items.push({
        id: `${agent.id}:${sub.id}`,
        kind: 'bot',
        ownerId: agent.id,
        sessionId: sub.id,
        project: agent.project,
        label: sub.agentType,
        bubble: toolBubble(sub.current),
        status: sub.status,
        station: sub.station,
        clan,
        rank: 'genin',
        errorId: errorIdOf(sub.recent),
      })
    }
  }

  return items
}

// Points every entity at its seat; spawns newcomers at the factory entrance (subagents next to
// whoever spawned them), drops departed ones and emits effects for finished tasks and failures.
export function syncEntities(
  scene: Scene,
  agents: AgentSnapshot[],
  layout: FloorLayout,
  grid: WalkGrid,
  teleport: boolean,
  now: number,
) {
  const { entities, effects } = scene
  const seen = new Set<string>()
  const occupancy = new Map<StationId, number>()
  const firstLoad = entities.size === 0
  const entrance = { col: Math.floor(grid.cols / 2), row: grid.rows - 1 }

  for (const item of initsFor(agents)) {
    seen.add(item.id)
    const slot = occupancy.get(item.station) ?? 0
    occupancy.set(item.station, slot + 1)
    const room = layout.rooms[item.station]
    const home = slotTile(room, slot)
    const hasDesk = item.kind === 'person' && DESK_ROOMS.has(item.station) && slot < slotCount(room)
    const existing = entities.get(item.id)
    if (existing) {
      if (existing.status !== 'idle' && item.status === 'idle') {
        existing.cheerUntil = now + CHEER_MS
        effects.push({ kind: 'done', x: existing.x, y: existing.y, born: now })
      }
      if (item.errorId && item.errorId !== existing.errorId) {
        existing.failUntil = now + FAIL_MS
        effects.push({ kind: 'error', x: existing.x, y: existing.y, born: now })
      }
      if (existing.station !== item.station) existing.wandering = false
      Object.assign(existing, item, { slot, home, hasDesk })
      if (teleport) placeAt(existing, home)
      if (!existing.wandering) setGoal(existing, home)
      continue
    }
    const owner = entities.get(item.ownerId)
    const entity: Entity = {
      ...item,
      slot,
      home,
      hasDesk,
      wandering: false,
      wanderTimer: random(WANDER_EVERY_MIN, WANDER_EVERY_MAX),
      cheerUntil: 0,
      failUntil: 0,
      col: 0,
      row: 0,
      x: 0,
      y: 0,
      path: [],
      progress: 0,
      goal: home,
      repath: false,
      dwell: 0,
      facing: 'down',
    }
    placeAt(entity, firstLoad || teleport ? home : owner ? { col: owner.col, row: owner.row } : entrance)
    entity.goal = home
    entities.set(item.id, entity)
    if (!firstLoad && !teleport) effects.push({ kind: 'smoke', x: entity.x, y: entity.y, born: now })
  }
  for (const [id, entity] of entities) {
    if (seen.has(id)) continue
    // A subagent leaving the floor has handed its work back and vanishes in a puff of smoke.
    if (entity.kind === 'bot') {
      effects.push({ kind: 'done', x: entity.x, y: entity.y, born: now })
      effects.push({ kind: 'smoke', x: entity.x, y: entity.y, born: now })
    }
    entities.delete(id)
  }
}

function updateWander(e: Entity, dt: number, grid: WalkGrid) {
  const resting = e.status === 'idle' && e.station === 'resources'
  if (!resting) return
  if (e.wandering) {
    // Paused at the stroll spot long enough: head back to the seat.
    if (atGoal(e) && e.dwell <= 0) {
      e.wandering = false
      setGoal(e, e.home)
    }

    return
  }
  if (!atGoal(e)) return
  e.wanderTimer -= dt
  if (e.wanderTimer > 0) return
  e.wanderTimer = random(WANDER_EVERY_MIN, WANDER_EVERY_MAX)
  const floor = grid.floors.resources
  if (!floor?.length) return
  e.wandering = true
  setGoal(e, floor[Math.floor(Math.random() * floor.length)])
  e.dwell = 0
}

export function stepScene(scene: Scene, dt: number, grid: WalkGrid, now: number) {
  for (const e of scene.entities.values()) {
    const wasWalking = isWalking(e)
    updateWander(e, dt, grid)
    stepMover(e, dt, grid)
    if (wasWalking && !isWalking(e) && e.wandering) e.dwell = random(WANDER_PAUSE_MIN, WANDER_PAUSE_MAX)
  }
  scene.effects = scene.effects.filter((fx) => now - fx.born < 1600)
}

// Working at a desk: only the upper body shows above it.
export function isAtDesk(e: Entity): boolean {
  return e.hasDesk && e.status !== 'idle' && atGoal(e)
}

export function isSeated(e: Entity): boolean {
  return e.station === 'resources' && e.status === 'idle' && !e.wandering && atGoal(e)
}

export function hitTest(entities: Map<string, Entity>, x: number, y: number): Entity | null {
  const sorted = [...entities.values()].sort((a, b) => b.y - a.y)
  for (const e of sorted) {
    const w = (e.kind === 'person' ? PERSON_W : BOT_W) * SCALE
    const h = (e.kind === 'person' ? PERSON_H : BOT_H) * SCALE
    if (x >= e.x - w / 2 - 3 && x <= e.x + w / 2 + 3 && y >= e.y - h - 3 && y <= e.y + 12) return e
  }

  return null
}
