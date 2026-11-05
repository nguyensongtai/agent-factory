import 'server-only'

import { open } from 'node:fs/promises'

import { estimateCost } from '../domain/pricing'
import { stationForTool } from '../domain/stations'
import type { Mission, PlanItem, Powers, StationId, TimelinePoint, ToolCall, Usage } from '../domain/types'
import { contentText, describeTool, mcpServer, short, str } from './describe'

// Huge transcripts are only read from their last few MB on first sight; titles repeat
// throughout the file, so the tail is enough to name the session (totals then cover the tail only).
const MAX_INITIAL_BYTES = 8 * 1024 * 1024
const RECENT_LIMIT = 40
const TURN_LIMIT = 20
const ERROR_LIMIT = 20
const LATENCY_LIMIT = 80
const MINUTE = 60_000
const TIMELINE_MS = 3 * 3600_000

type LastEvent = 'prompt' | 'tool' | 'result' | 'text' | 'done'

export type ToolError = { id: string; at: number; tool: string; message: string }

export type TranscriptState = {
  offset: number
  leftover: string
  sessionId: string
  cwd: string
  gitBranch: string
  entrypoint: string
  title: string
  agentName: string
  lastPrompt: string
  model: string
  lastEvent: LastEvent
  lastActivityAt: number
  pending: Map<string, ToolCall>
  recent: ToolCall[]
  toolCount: number
  errorCount: number
  toolMs: number
  toolMsCount: number
  powers: Powers
  zones: Partial<Record<StationId, number>>
  usage: Usage
  // Assistant entries of one API response repeat its usage; count it once.
  lastMessageId: string
  // api-request id -> start time, matched by the response's requestRef.
  requests: Map<string, number>
  latencies: number[]
  timeline: Map<number, TimelinePoint>
  errors: ToolError[]
  turns: Mission[]
  plan: PlanItem[]
}

type ContentBlock = {
  type?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  text?: string
  content?: unknown
}

type RawUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
  speed?: string
}

type Entry = {
  type?: string
  id?: string
  uuid?: string
  requestRef?: string
  isApiErrorMessage?: boolean
  timestamp?: string
  sessionId?: string
  cwd?: string
  gitBranch?: string
  entrypoint?: string
  isMeta?: boolean
  customTitle?: string
  agentName?: string
  lastPrompt?: string
  message?: {
    id?: string
    model?: string
    stop_reason?: string | null
    content?: string | ContentBlock[]
    usage?: RawUsage
  }
}

export function createTranscriptState(): TranscriptState {
  return {
    offset: 0,
    leftover: '',
    sessionId: '',
    cwd: '',
    gitBranch: '',
    entrypoint: '',
    title: '',
    agentName: '',
    lastPrompt: '',
    model: '',
    lastEvent: 'done',
    lastActivityAt: 0,
    pending: new Map(),
    recent: [],
    toolCount: 0,
    errorCount: 0,
    toolMs: 0,
    toolMsCount: 0,
    powers: { skills: {}, subagents: {}, mcp: {} },
    zones: {},
    usage: { tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: 0, byModel: {} },
    lastMessageId: '',
    requests: new Map(),
    latencies: [],
    timeline: new Map(),
    errors: [],
    turns: [],
    plan: [],
  }
}

// Reads only the bytes appended since the previous call.
export async function advanceTranscript(state: TranscriptState, file: string, size: number): Promise<void> {
  if (size < state.offset) Object.assign(state, createTranscriptState())
  if (size === state.offset) return

  const start = state.offset === 0 && size > MAX_INITIAL_BYTES ? size - MAX_INITIAL_BYTES : state.offset
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(size - start)
    await handle.read(buffer, 0, buffer.length, start)
    let text = state.leftover + buffer.toString('utf8')
    // A tail read starts mid-line: drop the partial first line.
    if (start > state.offset) text = text.slice(text.indexOf('\n') + 1)
    const lines = text.split('\n')
    state.leftover = lines.pop() ?? ''
    state.offset = size
    for (const line of lines) {
      if (line) applyLine(state, line)
    }
  } finally {
    await handle.close()
  }
}

function pushLimited<T>(list: T[], item: T, limit: number): void {
  list.push(item)
  if (list.length > limit) list.shift()
}

function bucket(state: TranscriptState, at: number): TimelinePoint {
  const key = Math.floor(at / MINUTE) * MINUTE
  let point = state.timeline.get(key)
  if (!point) {
    point = { at: key, calls: 0, tokens: 0, errors: 0, cost: 0 }
    state.timeline.set(key, point)
    for (const old of state.timeline.keys()) if (old < key - TIMELINE_MS) state.timeline.delete(old)
  }

  return point
}

function applyLine(state: TranscriptState, line: string): void {
  let entry: Entry
  try {
    entry = JSON.parse(line) as Entry
  } catch {
    return
  }
  const at = entry.timestamp ? Date.parse(entry.timestamp) : 0

  switch (entry.type) {
    case 'custom-title':
      state.title = entry.customTitle ?? state.title

      return
    case 'agent-name':
      state.agentName = entry.agentName ?? state.agentName

      return
    case 'last-prompt':
      state.lastPrompt = entry.lastPrompt ?? state.lastPrompt

      return
    case 'api-request':
      if (entry.id && at) {
        state.requests.set(entry.id, at)
        if (state.requests.size > 50) state.requests.delete(state.requests.keys().next().value!)
      }

      return
    case 'assistant':
    case 'user':
      break
    default:
      return
  }

  if (at > state.lastActivityAt) state.lastActivityAt = at
  if (entry.sessionId) state.sessionId = entry.sessionId
  if (entry.cwd) state.cwd = entry.cwd
  if (entry.gitBranch) state.gitBranch = entry.gitBranch
  if (entry.entrypoint) state.entrypoint = entry.entrypoint

  if (entry.type === 'assistant') applyAssistant(state, entry, at)
  else applyUser(state, entry, at)
}

function currentTurn(state: TranscriptState): Mission | undefined {
  const turn = state.turns.at(-1)

  return turn?.status === 'running' ? turn : undefined
}

function finishTurn(state: TranscriptState, status: 'completed' | 'failed', at: number, note = ''): void {
  const turn = currentTurn(state)
  if (!turn) return
  turn.status = status
  turn.endedAt = at
  turn.note = note
}

// `/command args` for slash commands, otherwise the prompt text without markup.
function promptTitle(text: string): string {
  const command = /<command-name>\/?([^<]+)<\/command-name>/.exec(text)
  if (command) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1] ?? ''

    return short(`/${command[1]} ${args}`, 120)
  }

  return short(text.replace(/<[^>]+>/g, ' '), 120)
}

function startTurn(state: TranscriptState, id: string, text: string, at: number): void {
  const title = promptTitle(text)
  if (!title) return
  finishTurn(state, 'completed', at)
  pushLimited(
    state.turns,
    {
      id,
      title,
      source: 'prompt',
      status: 'running',
      agentId: null,
      startedAt: at,
      endedAt: null,
      toolCount: 0,
      errorCount: 0,
      note: '',
    },
    TURN_LIMIT,
  )
}

function addUsage(state: TranscriptState, model: string, raw: RawUsage, at: number): void {
  const write1h = raw.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const write5m = raw.cache_creation
    ? (raw.cache_creation.ephemeral_5m_input_tokens ?? 0)
    : (raw.cache_creation_input_tokens ?? 0)
  const usage = {
    input: raw.input_tokens ?? 0,
    output: raw.output_tokens ?? 0,
    cacheRead: raw.cache_read_input_tokens ?? 0,
    write5m,
    write1h,
    fast: raw.speed === 'fast',
  }
  const tokens = usage.input + usage.output + usage.cacheRead + write5m + write1h
  const cost = estimateCost(model, usage) ?? 0
  const totals = state.usage.tokens
  totals.input += usage.input
  totals.output += usage.output
  totals.cacheRead += usage.cacheRead
  totals.cacheWrite += write5m + write1h
  state.usage.cost += cost
  const perModel = (state.usage.byModel[model] ??= { tokens: 0, cost: 0 })
  perModel.tokens += tokens
  perModel.cost += cost
  const point = bucket(state, at)
  point.tokens += tokens
  point.cost += cost
}

function planItem(raw: unknown): PlanItem {
  const item = (raw ?? {}) as Record<string, unknown>
  const status = item.status === 'in_progress' || item.status === 'completed' ? item.status : 'pending'

  return { content: short(str(item.content) || str(item.subject) || str(item.activeForm), 120), status }
}

// TodoWrite replaces the list; the desktop app's plan tool also advances it step by step.
function applyPlan(state: TranscriptState, name: string, input: Record<string, unknown>): void {
  if (name === 'TodoWrite' && Array.isArray(input.todos)) state.plan = input.todos.map(planItem)
  if (name === 'mcp__ccd_turn__wrap_up') for (const item of state.plan) item.status = 'completed'
  if (name !== 'mcp__ccd_turn__update_plan') return
  if (Array.isArray(input.items)) state.plan = input.items.map(planItem)
  const plan = state.plan
  if (input.advance === true) {
    const active = plan.findIndex((p) => p.status === 'in_progress')
    if (active >= 0) plan[active].status = 'completed'
    const next = plan.findIndex((p) => p.status === 'pending')
    if (next >= 0) plan[next].status = 'in_progress'
  }
  if (Array.isArray(input.done)) {
    for (const n of input.done) if (typeof n === 'number' && plan[n - 1]) plan[n - 1].status = 'completed'
  }
  if (typeof input.start === 'number' && plan[input.start - 1]) plan[input.start - 1].status = 'in_progress'
}

function applyAssistant(state: TranscriptState, entry: Entry, at: number): void {
  const message = entry.message
  if (!message) return
  if (message.model && !message.model.startsWith('<')) state.model = message.model

  if (entry.requestRef) {
    const sentAt = state.requests.get(entry.requestRef)
    if (sentAt !== undefined && at >= sentAt) {
      pushLimited(state.latencies, at - sentAt, LATENCY_LIMIT)
      state.requests.delete(entry.requestRef)
    }
  }

  if (entry.isApiErrorMessage) {
    const text = short(contentText(message.content), 160) || 'Lỗi API'
    pushLimited(state.errors, { id: entry.uuid ?? `${at}`, at, tool: 'API', message: text }, ERROR_LIMIT)
    state.errorCount += 1
    bucket(state, at).errors += 1
    state.pending.clear()
    state.lastEvent = 'done'
    finishTurn(state, 'failed', at, text)

    return
  }

  if (message.usage && message.id && message.id !== state.lastMessageId) {
    state.lastMessageId = message.id
    addUsage(state, message.model ?? state.model, message.usage, at)
  }

  const blocks = Array.isArray(message.content) ? message.content : []
  let sawTool = false
  for (const block of blocks) {
    if (block.type !== 'tool_use' || !block.id || !block.name) continue
    // A subagent ends by handing its report back; nothing runs after that.
    if (block.name === 'SubagentHandback') {
      state.pending.clear()
      state.lastEvent = 'done'
      finishTurn(state, 'completed', at)

      return
    }
    sawTool = true
    const input = block.input ?? {}
    const call: ToolCall = {
      id: block.id,
      name: block.name,
      detail: describeTool(block.name, input),
      station: stationForTool(block.name, str(input.command)),
      at,
      endedAt: 0,
      done: false,
      isError: false,
      error: '',
    }
    state.pending.set(call.id, call)
    pushLimited(state.recent, call, RECENT_LIMIT)
    state.toolCount += 1
    state.zones[call.station] = (state.zones[call.station] ?? 0) + 1
    bucket(state, at).calls += 1
    const turn = currentTurn(state)
    if (turn) turn.toolCount += 1
    countPower(state.powers, block.name, input)
    applyPlan(state, block.name, input)
  }

  if (sawTool) state.lastEvent = 'tool'
  else if (message.stop_reason === 'end_turn' || message.stop_reason === 'stop_sequence') {
    state.lastEvent = 'done'
    finishTurn(state, 'completed', at)
  } else state.lastEvent = 'text'
}

function interrupt(state: TranscriptState, at: number): void {
  state.pending.clear()
  state.lastEvent = 'done'
  finishTurn(state, 'failed', at, 'Bị dừng giữa chừng')
}

function applyResult(state: TranscriptState, block: ContentBlock, at: number): void {
  const call = state.pending.get(block.tool_use_id!)
  if (!call) return
  state.pending.delete(call.id)
  call.done = true
  call.endedAt = at
  if (at >= call.at) {
    state.toolMs += at - call.at
    state.toolMsCount += 1
  }
  if (!block.is_error) return
  call.isError = true
  call.error = short(contentText(block.content), 160)
  state.errorCount += 1
  bucket(state, at).errors += 1
  pushLimited(state.errors, { id: call.id, at, tool: call.name, message: call.error || call.detail }, ERROR_LIMIT)
  const turn = currentTurn(state)
  if (turn) turn.errorCount += 1
}

function applyUser(state: TranscriptState, entry: Entry, at: number): void {
  const content = entry.message?.content
  if (typeof content === 'string') {
    if (entry.isMeta) return
    if (content.startsWith('[Request interrupted')) return interrupt(state, at)
    const command = /<command-name>\/?([^<]+)<\/command-name>/.exec(content)
    if (command) bump(state.powers.skills, command[1])
    state.pending.clear()
    state.lastEvent = 'prompt'
    startTurn(state, entry.uuid ?? `${at}`, content, at)

    return
  }
  if (!Array.isArray(content)) return

  let sawResult = false
  let prompt = ''
  for (const block of content) {
    if (block.type === 'tool_result' && block.tool_use_id) {
      sawResult = true
      applyResult(state, block, at)
    } else if (block.type === 'text' && block.text) {
      if (block.text.startsWith('[Request interrupted')) return interrupt(state, at)
      if (!prompt && !block.text.startsWith('<')) prompt = block.text
    }
  }
  if (sawResult) {
    if (state.lastEvent !== 'done') state.lastEvent = 'result'
  } else if (!entry.isMeta) {
    state.pending.clear()
    state.lastEvent = 'prompt'
    if (prompt) startTurn(state, entry.uuid ?? `${at}`, prompt, at)
  }
}

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1
}

function countPower(powers: Powers, name: string, input: Record<string, unknown>): void {
  if (name === 'Skill') bump(powers.skills, str(input.skill) || 'skill')
  else if (name === 'Agent' || name === 'Task') bump(powers.subagents, str(input.subagent_type) || 'general-purpose')
  // mcp__ccd_* are the desktop app's own plumbing (plan list, wrap-up), not a power.
  else if (name.startsWith('mcp__') && !name.startsWith('mcp__ccd_')) bump(powers.mcp, mcpServer(name))
}
