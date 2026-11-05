import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ManualMission } from '../domain/types'

// Missions created in Mission Control live in one JSON file next to the app (git-ignored).
const DATA_DIR = process.env.FACTORY_DATA_DIR ?? path.join(process.cwd(), '.data')
const FILE = path.join(DATA_DIR, 'missions.json')
const STATUSES = new Set<ManualMission['status']>(['backlog', 'assigned', 'completed', 'failed'])

export class MissionInputError extends Error {}

// Writes are chained so two requests never interleave a read-modify-write.
let queue: Promise<unknown> = Promise.resolve()

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)

  return run
}

async function load(): Promise<ManualMission[]> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as ManualMission[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function save(missions: ManualMission[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(missions, null, 2))
  await rename(tmp, FILE)
}

function text(value: unknown, field: string, max: number, required: boolean): string {
  if (value === undefined && !required) return ''
  if (typeof value !== 'string') throw new MissionInputError(`${field} phải là chuỗi`)
  const clean = value.trim()
  if (required && !clean) throw new MissionInputError(`Cần nhập ${field}`)
  if (clean.length > max) throw new MissionInputError(`${field} dài quá ${max} ký tự`)

  return clean
}

function agentId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) throw new MissionInputError('agentId không hợp lệ')

  return value
}

export function listMissions(): Promise<ManualMission[]> {
  return load()
}

export function createMission(input: Record<string, unknown>): Promise<ManualMission> {
  return serial(async () => {
    const now = Date.now()
    const assignee = agentId(input.agentId)
    const mission: ManualMission = {
      id: randomUUID(),
      title: text(input.title, 'tiêu đề', 200, true),
      description: text(input.description, 'mô tả', 4000, false),
      agentId: assignee,
      status: assignee ? 'assigned' : 'backlog',
      createdAt: now,
      updatedAt: now,
    }
    const missions = await load()
    await save([mission, ...missions])

    return mission
  })
}

export function updateMission(id: string, input: Record<string, unknown>): Promise<ManualMission | null> {
  return serial(async () => {
    const missions = await load()
    const mission = missions.find((m) => m.id === id)
    if (!mission) return null
    if ('title' in input) mission.title = text(input.title, 'tiêu đề', 200, true)
    if ('description' in input) mission.description = text(input.description, 'mô tả', 4000, false)
    if ('agentId' in input) {
      mission.agentId = agentId(input.agentId)
      if (mission.status === 'backlog' || mission.status === 'assigned') mission.status = mission.agentId ? 'assigned' : 'backlog'
    }
    if ('status' in input) {
      if (!STATUSES.has(input.status as ManualMission['status'])) throw new MissionInputError('Trạng thái không hợp lệ')
      mission.status = input.status as ManualMission['status']
    }
    mission.updatedAt = Date.now()
    await save(missions)

    return mission
  })
}

export function deleteMission(id: string): Promise<boolean> {
  return serial(async () => {
    const missions = await load()
    const rest = missions.filter((m) => m.id !== id)
    if (rest.length === missions.length) return false
    await save(rest)

    return true
  })
}
