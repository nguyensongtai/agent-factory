import 'server-only'

import { readdir, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isAskTool, stationForStatus } from '../domain/stations'
import type {
  AgentSnapshot,
  AgentStatus,
  ErrorEvent,
  FactorySnapshot,
  LatencyStats,
  Mission,
  MissionStatus,
  PlanItem,
  SubagentSnapshot,
  TimelinePoint,
  ToolCall,
  Usage,
} from '../domain/types'
import { readPermissions } from './permissions'
import { advanceTranscript, createTranscriptState, type TranscriptState } from './transcript'

// Read at runtime only: the comment stops Turbopack from tracing the whole project for this path.
const PROJECTS_DIR = path.join(
  /* turbopackIgnore: true */ process.env.CLAUDE_PROJECTS_DIR ?? path.join(os.homedir(), '.claude', 'projects'),
)
const WINDOW_HOURS = Number(process.env.FACTORY_WINDOW_HOURS ?? 3)
const VISIBLE_WINDOW_MS = WINDOW_HOURS * 3600_000
const MAX_AGENTS = 40
const RESCAN_MS = 5000
// No transcript write for this long means the process is gone, even with a tool pending.
const STALE_MS = 15 * 60_000
const THINKING_MS = 3 * 60_000
const MINUTE = 60_000
const TIMELINE_POINTS = 60
const startedAt = Date.now()

type Tracked = { file: string; mtime: number; size: number; state: TranscriptState }

type SubTracked = Tracked & { agentType: string; description: string }

const sessions = new Map<string, Tracked>()
const subagents = new Map<string, SubTracked>()
let candidates: string[] = []
let lastScanAt = 0

// False until Claude Code has written its first transcript (or CLAUDE_PROJECTS_DIR points nowhere).
let projectsDirFound = true

async function listCandidates(now: number): Promise<string[]> {
  const dirs = await readdir(PROJECTS_DIR, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  projectsDirFound = dirs !== null
  if (!dirs) return []
  const found: { file: string; mtime: number }[] = []
  await Promise.all(
    dirs
      .filter((d) => d.isDirectory())
      .map(async (d) => {
        const dir = path.join(PROJECTS_DIR, d.name)
        const names = await readdir(dir)
        await Promise.all(
          names
            .filter((n) => n.endsWith('.jsonl'))
            .map(async (n) => {
              const file = path.join(dir, n)
              const info = await stat(file)
              if (now - info.mtimeMs < VISIBLE_WINDOW_MS) found.push({ file, mtime: info.mtimeMs })
            }),
        )
      }),
  )

  return found
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_AGENTS)
    .map((f) => f.file)
}

async function refresh<T extends Tracked>(map: Map<string, T>, file: string, init: () => T): Promise<T | null> {
  const info = await stat(file).catch(() => null)
  if (!info) {
    map.delete(file)

    return null
  }
  const tracked = map.get(file) ?? init()
  map.set(file, tracked)
  if (info.size !== tracked.size || info.mtimeMs !== tracked.mtime) {
    tracked.size = info.size
    tracked.mtime = info.mtimeMs
    await advanceTranscript(tracked.state, file, info.size)
  }

  return tracked
}

function deriveStatus(tracked: Tracked, now: number): { status: AgentStatus; current: ToolCall | null; stale: boolean } {
  const { state, mtime } = tracked
  const age = now - Math.max(mtime, state.lastActivityAt)
  const current = [...state.pending.values()].at(-1) ?? null

  if (age > STALE_MS) return { status: 'idle', current: null, stale: true }
  if (current) return { status: isAskTool(current.name) ? 'asking' : 'working', current, stale: false }
  if (state.lastEvent === 'done') return { status: 'idle', current: null, stale: false }
  if (age < THINKING_MS) return { status: 'thinking', current: null, stale: false }

  return { status: 'idle', current: null, stale: false }
}

async function readMeta(file: string): Promise<{ agentType: string; description: string }> {
  try {
    const raw = await readFile(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')
    const meta = JSON.parse(raw) as { agentType?: string; description?: string }

    return { agentType: meta.agentType ?? 'subagent', description: meta.description ?? '' }
  } catch {
    return { agentType: 'subagent', description: '' }
  }
}

function latencyOf(values: number[]): LatencyStats {
  if (values.length === 0) return { p50: 0, p95: 0, samples: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

  return { p50: at(0.5), p95: at(0.95), samples: sorted.length }
}

function addUsage(target: Usage, source: Usage): void {
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) target.tokens[key] += source.tokens[key]
  target.cost += source.cost
  for (const [model, value] of Object.entries(source.byModel)) {
    const entry = (target.byModel[model] ??= { tokens: 0, cost: 0 })
    entry.tokens += value.tokens
    entry.cost += value.cost
  }
}

function cloneUsage(usage: Usage): Usage {
  const copy: Usage = { tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: 0, byModel: {} }
  addUsage(copy, usage)

  return copy
}

function turnStatus(turn: Mission, status: AgentStatus, stale: boolean, isLast: boolean): Pick<Mission, 'status' | 'note'> {
  if (turn.status !== 'running') return turn
  if (stale) return { status: 'failed', note: 'Phiên không còn hoạt động' }
  if (isLast && status === 'asking') return { status: 'approval', note: turn.note }

  return turn
}

function runStatus(tracked: SubTracked, status: AgentStatus): MissionStatus {
  if (status === 'asking') return 'approval'
  if (status !== 'idle') return 'running'

  return tracked.state.turns.at(-1)?.status === 'failed' ? 'failed' : 'completed'
}

type SubagentScan = { active: SubagentSnapshot[]; runs: Mission[]; states: TranscriptState[] }

async function collectSubagents(sessionFile: string, agentId: string, now: number): Promise<SubagentScan> {
  const dir = path.join(sessionFile.replace(/\.jsonl$/, ''), 'subagents')
  const names = await readdir(dir).catch(() => [] as string[])
  const scan: SubagentScan = { active: [], runs: [], states: [] }
  await Promise.all(
    names
      .filter((n) => n.endsWith('.jsonl'))
      .map(async (n) => {
        const file = path.join(dir, n)
        const info = await stat(file).catch(() => null)
        if (!info || now - info.mtimeMs > VISIBLE_WINDOW_MS) return
        const meta = subagents.has(file) ? null : await readMeta(file)
        const tracked = await refresh(subagents, file, () => ({
          file,
          mtime: 0,
          size: 0,
          state: createTranscriptState(),
          agentType: meta?.agentType ?? 'subagent',
          description: meta?.description ?? '',
        }))
        if (!tracked) return
        const id = n.replace(/\.jsonl$/, '')
        const { state } = tracked
        const { status, current } = deriveStatus(tracked, now)
        scan.states.push(state)
        scan.runs.push({
          id: `${agentId}:sub:${id}`,
          title: tracked.description || tracked.agentType,
          source: 'subagent',
          status: runStatus(tracked, status),
          agentId,
          startedAt: state.turns[0]?.startedAt ?? tracked.mtime,
          endedAt: status === 'idle' ? state.lastActivityAt : null,
          toolCount: state.toolCount,
          errorCount: state.errorCount,
          note: tracked.agentType,
        })
        if (status === 'idle') return
        scan.active.push({
          id,
          agentType: tracked.agentType,
          description: tracked.description,
          status,
          station: stationForStatus(status, current),
          current,
          lastActivityAt: state.lastActivityAt,
          toolCount: state.toolCount,
          recent: state.recent.slice(-10).reverse(),
        })
      }),
  )
  scan.active.sort((a, b) => a.id.localeCompare(b.id))

  return scan
}

function planMissions(plan: PlanItem[], agentId: string, status: AgentStatus, at: number): Mission[] {
  return plan.map((item, i) => ({
    id: `${agentId}:plan:${i}`,
    title: item.content,
    source: 'plan',
    status:
      item.status === 'completed'
        ? 'completed'
        : item.status === 'pending'
          ? 'assigned'
          : status === 'asking'
            ? 'approval'
            : 'running',
    agentId,
    startedAt: at,
    endedAt: item.status === 'completed' ? at : null,
    toolCount: 0,
    errorCount: 0,
    note: '',
  }))
}

// Headless SDK runs often have a JSON payload as their first prompt; that is not a usable name.
function readable(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()

  return /^[[{<]/.test(clean) ? '' : clean
}

// Unnamed sessions get a short id first so it survives truncation on the floor.
function nameOf(state: TranscriptState, id: string): string {
  return readable(state.agentName) || readable(state.title) || `#${id.slice(0, 4)} ${path.basename(state.cwd) || 'agent'}`
}

function titleOf(state: TranscriptState, name: string): string {
  return readable(state.title) || readable(state.agentName) || readable(state.lastPrompt).slice(0, 60) || name
}

function mergeTimeline(target: Map<number, TimelinePoint>, state: TranscriptState): void {
  for (const point of state.timeline.values()) {
    const into = target.get(point.at)
    if (!into) continue
    into.calls += point.calls
    into.tokens += point.tokens
    into.errors += point.errors
    into.cost += point.cost
  }
}

async function agentSnapshot(file: string, now: number): Promise<{ agent: AgentSnapshot; states: TranscriptState[] } | null> {
  const tracked = await refresh(sessions, file, () => ({ file, mtime: 0, size: 0, state: createTranscriptState() }))
  if (!tracked) return null
  const { state } = tracked
  const { status, current, stale } = deriveStatus(tracked, now)
  const id = path.basename(file, '.jsonl')
  const name = nameOf(state, id)
  const [subs, permissions] = await Promise.all([collectSubagents(file, id, now), readPermissions(state.cwd)])
  const usage = cloneUsage(state.usage)
  for (const sub of subs.states) addUsage(usage, sub.usage)
  const lastActivityAt = Math.max(state.lastActivityAt, tracked.mtime)
  const turns = state.turns.slice(-10)
  const missions: Mission[] = [
    ...turns.map((turn, i) => ({
      ...turn,
      ...turnStatus(turn, status, stale, i === turns.length - 1),
      id: `${id}:${turn.id}`,
      agentId: id,
    })),
    ...subs.runs,
    ...planMissions(state.plan, id, status, lastActivityAt),
  ]

  return {
    states: [state, ...subs.states],
    agent: {
      id,
      name,
      automated: state.entrypoint.startsWith('sdk'),
      title: titleOf(state, name),
      project: path.basename(state.cwd) || path.basename(path.dirname(file)),
      cwd: state.cwd,
      gitBranch: state.gitBranch,
      model: state.model,
      lastPrompt: state.lastPrompt,
      status,
      station: stationForStatus(status, current),
      current,
      lastActivityAt,
      toolCount: state.toolCount,
      errorCount: state.errorCount,
      avgToolMs: state.toolMsCount > 0 ? state.toolMs / state.toolMsCount : 0,
      recent: state.recent.slice(-20).reverse(),
      powers: state.powers,
      zones: state.zones,
      usage,
      latency: latencyOf([state, ...subs.states].flatMap((s) => s.latencies)),
      plan: state.plan,
      missions,
      permissions,
      subagents: subs.active,
    },
  }
}

export async function getFactorySnapshot(): Promise<FactorySnapshot> {
  const begin = performance.now()
  const now = Date.now()
  if (now - lastScanAt > RESCAN_MS) {
    candidates = await listCandidates(now)
    lastScanAt = now
    const keep = new Set(candidates)
    for (const file of sessions.keys()) if (!keep.has(file)) sessions.delete(file)
    const dirs = candidates.map((c) => c.replace(/\.jsonl$/, path.sep))
    for (const file of subagents.keys()) if (!dirs.some((d) => file.startsWith(d))) subagents.delete(file)
  }

  const results = (await Promise.all(candidates.map((file) => agentSnapshot(file, now)))).filter((r) => r !== null)
  const agents = results.map((r) => r.agent)

  const lastMinute = Math.floor(now / MINUTE) * MINUTE
  const timeline = new Map<number, TimelinePoint>()
  for (let i = TIMELINE_POINTS - 1; i >= 0; i--) {
    const at = lastMinute - i * MINUTE
    timeline.set(at, { at, calls: 0, tokens: 0, errors: 0, cost: 0 })
  }
  const errors: ErrorEvent[] = []
  const latencies: number[] = []
  for (const { agent, states } of results) {
    for (const state of states) {
      mergeTimeline(timeline, state)
      latencies.push(...state.latencies)
      for (const e of state.errors) errors.push({ ...e, id: `${agent.id}:${e.id}`, agentId: agent.id, agentName: agent.name })
    }
  }
  const memory = process.memoryUsage()
  let bytesRead = 0
  for (const tracked of [...sessions.values(), ...subagents.values()]) bytesRead += tracked.state.offset

  return {
    generatedAt: now,
    agents,
    timeline: [...timeline.values()],
    errors: errors.sort((a, b) => b.at - a.at).slice(0, 40),
    latency: latencyOf(latencies),
    health: {
      scanMs: Math.round(performance.now() - begin),
      sessions: sessions.size,
      subagentFiles: subagents.size,
      bytesRead,
      rssMb: Math.round(memory.rss / 1048576),
      heapMb: Math.round(memory.heapUsed / 1048576),
      uptimeSec: Math.round((now - startedAt) / 1000),
      windowHours: WINDOW_HOURS,
      projectsDir: PROJECTS_DIR,
      projectsDirFound,
    },
  }
}
