import { appendFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after } from 'node:test'

import { advanceTranscript, createTranscriptState, type TranscriptState } from '../src/features/factory/server/transcript'

export const FIXTURES = path.join(import.meta.dirname, 'fixtures')

// Parses a whole hand-written fixture in one read, as the tracker does on first sight.
export async function parseFixture(name: string): Promise<TranscriptState> {
  const file = path.join(FIXTURES, name)
  const state = createTranscriptState()
  await advanceTranscript(state, file, statSync(file).size)

  return state
}

// A scratch directory removed when the test file finishes.
export function scratchDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lang-ninja-test-'))
  after(() => rmSync(dir, { recursive: true, force: true }))

  return dir
}

export function writeLines(file: string, lines: unknown[]): void {
  writeFileSync(file, lines.map((l) => `${typeof l === 'string' ? l : JSON.stringify(l)}\n`).join(''))
}

export function appendLines(file: string, lines: unknown[]): void {
  appendFileSync(file, lines.map((l) => `${typeof l === 'string' ? l : JSON.stringify(l)}\n`).join(''))
}

export async function advance(state: TranscriptState, file: string): Promise<void> {
  await advanceTranscript(state, file, statSync(file).size)
}

let clock = Date.parse('2026-01-01T10:00:00.000Z')

function at(): string {
  clock += 1000

  return new Date(clock).toISOString()
}

export function prompt(text: string, uuid = `u-${clock}`) {
  return { type: 'user', uuid, timestamp: at(), message: { role: 'user', content: text } }
}

// One assistant API response that calls a single tool.
export function toolUse(messageId: string, toolId: string, name: string, tokens = { input: 10, output: 5 }, timestamp = at()) {
  return {
    type: 'assistant',
    uuid: `a-${toolId}`,
    timestamp,
    message: {
      id: messageId,
      model: 'claude-sonnet-5-5',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: toolId, name, input: {} }],
      usage: { input_tokens: tokens.input, output_tokens: tokens.output },
    },
  }
}

export function toolResult(toolId: string, isError = false) {
  return {
    type: 'user',
    uuid: `r-${toolId}`,
    timestamp: at(),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, is_error: isError, content: 'ok' }] },
  }
}

export function totalTokens(state: TranscriptState): number {
  const t = state.usage.tokens

  return t.input + t.output + t.cacheRead + t.cacheWrite
}
