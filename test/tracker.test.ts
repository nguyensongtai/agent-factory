import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

import type { FactorySnapshot } from '../src/features/factory/domain/types'
import { appendLines, prompt, scratchDir, toolResult, toolUse, writeLines } from './helpers'

// The tracker reads its projects dir at import time; point it at a scratch dir first.
// Entries carry no cwd, so no settings file outside the scratch dir is read either.
const projects = path.join(scratchDir(), 'projects')
mkdirSync(path.join(projects, 'demo'), { recursive: true })
const session = path.join(projects, 'demo', 'session-1.jsonl')
process.env.CLAUDE_PROJECTS_DIR = projects

// Hold the parser's `open` so two snapshots can be made to overlap on purpose. Patching the CommonJS
// object and syncing updates the live `open` binding that transcript.ts imported from node:fs/promises.
const fsp = createRequire(import.meta.url)('node:fs/promises') as typeof import('node:fs/promises')
const realOpen = fsp.open
let gate: Promise<void> | null = null
let opens = 0
fsp.open = (async (...args: Parameters<typeof realOpen>) => {
  opens += 1
  if (gate) await gate

  return realOpen(...args)
}) as typeof realOpen
syncBuiltinESMExports()

const { getFactorySnapshot } = await import('../src/features/factory/server/tracker')

async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > end) return false
    await new Promise((resolve) => setTimeout(resolve, 2))
  }

  return true
}

function totals(snapshot: FactorySnapshot) {
  const agent = snapshot.agents.find((a) => a.id === 'session-1')!
  const t = agent.usage.tokens

  return { tools: agent.toolCount, tokens: t.input + t.output + t.cacheRead + t.cacheWrite, cost: agent.usage.cost }
}

test('overlapping snapshots do not apply the same transcript lines twice', async () => {
  // Every API response below is 10 input + 5 output tokens and calls one tool.
  writeLines(session, [prompt('Run the checks'), toolUse('m1', 't1', 'Read')])
  assert.deepEqual(totals(await getFactorySnapshot()), { tools: 1, tokens: 15, cost: (10 * 2 + 5 * 10) / 1e6 })

  appendLines(session, [toolResult('t1'), toolUse('m2', 't2', 'Grep'), toolResult('t2'), toolUse('m3', 't3', 'Bash')])
  let release!: () => void
  gate = new Promise((resolve) => (release = resolve))
  const opensBefore = opens

  // Snapshot A has seen the new size and is now waiting to read it...
  const a = getFactorySnapshot()
  assert.ok(await until(() => opens > opensBefore, 2000), 'snapshot A never reached the read')

  // ...when the file grows again and a second tab polls.
  appendLines(session, [toolResult('t3'), toolUse('m4', 't4', 'Edit')])
  const b = getFactorySnapshot()
  // With the bug B starts its own read at once; without it there is nothing to wait for.
  await until(() => opens > opensBefore + 1, 300)

  release()
  gate = null
  await Promise.all([a, b])

  const final = totals(await getFactorySnapshot())
  assert.deepEqual({ tools: final.tools, tokens: final.tokens }, { tools: 4, tokens: 4 * 15 })
  assert.ok(Math.abs(final.cost - (4 * 70) / 1e6) < 1e-12, `cost ${final.cost}`)
})
