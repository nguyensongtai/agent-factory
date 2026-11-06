import type { StationId } from '../../domain/types'
import { isAtDesk, stepScene, type Scene } from '../entities'
import type { WalkGrid } from '../grid'
import { DESK_HALF_W, type FloorLayout } from '../layout'
import type { Trace } from '../traces'
import { drawAgentLabels, drawAgents } from './agents'
import { drawCore, type BoardCounts } from './core'
import { deskTop } from './dojo'
import { drawEffects, drawLinks } from './effects'
import { EMPTY_ROOM, drawRoomOverlay, drawTraces, type RoomState } from './floor'
import { drawRoomGlow, drawVillageLights } from './glow'
import { buildLightMaps, drawLighting, lightKey, type LightMaps, type Point } from './lighting'
import { drawClouds, drawMist, drawRain, drawRipples, drawWaterfalls } from './weather'

const BACKDROP = '#07050a'

export type FrameInput = {
  layout: FloorLayout
  grid: WalkGrid
  traces: Trace[]
  floor: HTMLCanvasElement
  scene: Scene
  errors: Map<StationId, number>
  busy: boolean
  board: BoardCounts
  font: string
  selectedId: string | null
  hoveredId: string | null
}

function roomStates(scene: Scene, errors: Map<StationId, number>): Map<StationId, RoomState> {
  const rooms = new Map<StationId, RoomState>()
  for (const e of scene.entities.values()) {
    const state = rooms.get(e.station) ?? { ...EMPTY_ROOM }
    state.count += 1
    if (e.status !== 'idle') state.working += 1
    state.alert ||= e.status === 'asking'
    rooms.set(e.station, state)
  }
  for (const [station, at] of errors) rooms.set(station, { ...(rooms.get(station) ?? EMPTY_ROOM), errorAt: at })

  return rooms
}

// Monitors of the desks someone is working at, which light that person's face.
function busyDesks(scene: Scene): Point[] {
  const desks: Point[] = []
  for (const e of scene.entities.values()) {
    if (isAtDesk(e)) desks.push({ x: Math.round(e.x) - DESK_HALF_W + 7, y: deskTop(Math.round(e.y)) - 6 })
  }

  return desks.sort((a, b) => a.x - b.x || a.y - b.y)
}

// Paints one frame at `pixel` canvas pixels per floor pixel and returns the light maps,
// rebuilt only when lit rooms or busy desks changed.
export function paintFrame(
  ctx: CanvasRenderingContext2D,
  input: FrameInput,
  pixel: number,
  lights: LightMaps | null,
  dt: number,
  t: number,
): LightMaps {
  const { layout, scene } = input
  stepScene(scene, dt, input.grid, t)
  const rooms = roomStates(scene, input.errors)
  const lit = new Set([...rooms].filter(([, s]) => s.count > 0).map(([id]) => id))
  const desks = busyDesks(scene)
  const maps = lights && lights.key === lightKey(lit, desks) ? lights : buildLightMaps(layout, lit, desks)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = BACKDROP
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(pixel, 0, 0, pixel, 0, 0)
  ctx.imageSmoothingEnabled = false

  ctx.drawImage(input.floor, 0, 0)
  drawWaterfalls(ctx, layout, t)
  drawClouds(ctx, layout, t)
  drawLighting(ctx, maps)
  drawRipples(ctx, layout, t)
  drawVillageLights(ctx, layout, t)
  // Agents go on top of the lighting at full colour so they stand out from the night-time rooms.
  drawAgents(ctx, scene.entities, t)

  drawTraces(ctx, input.traces, rooms, t)
  for (const room of Object.values(layout.rooms)) {
    const state = rooms.get(room.station.id) ?? EMPTY_ROOM
    drawRoomGlow(ctx, room, { lit: state.count > 0, alert: state.alert }, t)
  }
  drawCore(ctx, layout.rooms.orchestration, t, input.font, input.busy, input.board)
  drawLinks(ctx, scene.entities, t)
  drawEffects(ctx, scene.effects, t)
  drawMist(ctx, layout, t)
  drawRain(ctx, layout, t)
  drawRoomOverlay(ctx, layout, t, input.font, rooms)
  drawAgentLabels(ctx, scene.entities, t, input.font, input.selectedId, input.hoveredId)

  return maps
}
