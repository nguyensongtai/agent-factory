import assert from 'node:assert/strict'
import { truncateSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

import { createTranscriptState } from '../src/features/factory/server/transcript'
import {
  advance,
  appendLines,
  parseFixture,
  prompt,
  scratchDir,
  toolResult,
  toolUse,
  totalTokens,
  writeLines,
} from './helpers'

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

describe('usage', () => {
  test('counts the usage of one message.id once, however many assistant entries repeat it', async () => {
    const state = await parseFixture('usage-dedupe.jsonl')

    assert.deepEqual(state.usage.tokens, { input: 110, output: 25, cacheRead: 1000, cacheWrite: 250 })
    assert.equal(state.usage.byModel['claude-sonnet-5-5'].tokens, 1385)
    // msg_1: 100*2 + 20*10 + 1000*0.2 + 50*2*1.25 (5m write) = 725; msg_2: 10*2 + 5*10 + 200*2*2 (1h write) = 870
    close(state.usage.cost, (725 + 870) / 1e6)
    close(state.usage.byModel['claude-sonnet-5-5'].cost, (725 + 870) / 1e6)
    // The timeline buckets get the same once-only totals.
    const buckets = [...state.timeline.values()]
    assert.equal(
      buckets.reduce((sum, p) => sum + p.tokens, 0),
      1385,
    )
    assert.equal(state.model, 'claude-sonnet-5-5')
    assert.equal(state.sessionId, 's-usage')
    assert.equal(state.cwd, '/work/demo')
  })

  test('keeps tokens of a model without a price apart instead of adding $0', async () => {
    const state = await parseFixture('unpriced.jsonl')
    const { byModel } = state.usage

    assert.deepEqual(byModel['claude-sonnet-5-5'], { tokens: 110, cost: (100 * 2 + 10 * 10) / 1e6, unpriced: false })
    assert.deepEqual(byModel['claude-nova-7'], { tokens: 1320, cost: 0, unpriced: true })
    // A synthetic message is not a model: never flagged, never counted as unpriced.
    assert.deepEqual(byModel['<synthetic>'], { tokens: 7, cost: 0, unpriced: false })
    assert.equal(state.usage.unpricedTokens, 1320)
    close(state.usage.cost, 300 / 1e6)
    const buckets = [...state.timeline.values()]
    assert.equal(
      buckets.reduce((sum, p) => sum + p.unpricedTokens, 0),
      1320,
    )
    // The session model stays the last real one.
    assert.equal(state.model, 'claude-nova-7')
  })
})

describe('tool calls', () => {
  test('pairs tool_use with tool_result, measures run time and flags is_error', async () => {
    const state = await parseFixture('tools.jsonl')
    const byId = new Map(state.recent.map((c) => [c.id, c]))

    assert.equal(state.toolCount, 3)
    const ok = byId.get('t-ok')!
    assert.equal(ok.done, true)
    assert.equal(ok.isError, false)
    assert.equal(ok.endedAt - ok.at, 2500)
    assert.equal(ok.station, 'testlab')

    const bad = byId.get('t-bad')!
    assert.equal(bad.done, true)
    assert.equal(bad.isError, true)
    assert.equal(bad.error, 'old_string not found in file')
    assert.equal(bad.endedAt - bad.at, 4000)

    assert.equal(state.toolMs, 6500)
    assert.equal(state.toolMsCount, 2)
    assert.equal(state.errorCount, 1)
    assert.deepEqual(
      state.errors.map((e) => [e.id, e.tool, e.message]),
      [['t-bad', 'Edit', 'old_string not found in file']],
    )

    // A result without a matching call is ignored; the last call is still running.
    assert.deepEqual([...state.pending.keys()], ['t-wait'])
    assert.equal(byId.get('t-wait')!.done, false)
    assert.equal(state.lastEvent, 'tool')

    const turn = state.turns.at(-1)!
    assert.equal(turn.status, 'running')
    assert.equal(turn.toolCount, 3)
    assert.equal(turn.errorCount, 1)
  })

  test('"[Request interrupted" fails the turn and clears running tools', async () => {
    const state = await parseFixture('interrupt.jsonl')

    assert.equal(state.pending.size, 0)
    assert.equal(state.lastEvent, 'done')
    const turn = state.turns.at(-1)!
    assert.equal(turn.status, 'failed')
    assert.equal(turn.note, 'Bị dừng giữa chừng')
    assert.equal(turn.endedAt, Date.parse('2026-01-01T10:00:09.000Z'))
  })

  test('isApiErrorMessage records an API error and fails the turn', async () => {
    const state = await parseFixture('api-error.jsonl')

    assert.equal(state.errorCount, 1)
    assert.deepEqual(
      state.errors.map((e) => [e.tool, e.message]),
      [['API', 'API Error: 529 Overloaded']],
    )
    assert.equal(state.pending.size, 0)
    assert.equal(state.lastEvent, 'done')
    assert.equal(state.turns.at(-1)!.status, 'failed')
    assert.equal(state.turns.at(-1)!.note, 'API Error: 529 Overloaded')
    // The synthetic error message is not a model and carries no usage.
    assert.equal(state.model, 'claude-opus-5-5')
    assert.equal(state.usage.byModel['<synthetic>'], undefined)
  })

  test('SubagentHandback ends the run and is not counted as a tool call', async () => {
    const state = await parseFixture('handback.jsonl')

    assert.equal(state.toolCount, 1)
    assert.equal(state.pending.size, 0)
    assert.equal(state.lastEvent, 'done')
    assert.equal(state.turns.at(-1)!.status, 'completed')
  })
})

describe('plan', () => {
  test('TodoWrite replaces the plan', async () => {
    const state = await parseFixture('plan.jsonl')

    assert.deepEqual(state.plan, [
      { content: 'Write tests', status: 'completed' },
      { content: 'Fix bug', status: 'in_progress' },
      { content: 'Updating docs', status: 'pending' },
    ])
  })

  test('mcp__ccd_turn__update_plan sets, advances, marks done and starts items', async () => {
    const state = await parseFixture('update-plan.jsonl')

    assert.deepEqual(
      state.plan.map((p) => p.status),
      ['completed', 'completed', 'pending', 'in_progress'],
    )
    // The desktop app's own plumbing is not an MCP power.
    assert.deepEqual(state.powers.mcp, {})
  })

  test('advance with nothing in progress starts the first pending item; wrap_up completes all', async () => {
    const file = path.join(scratchDir(), 'plan.jsonl')
    const plan = (input: Record<string, unknown>, id: string) => {
      const entry = toolUse(`m-${id}`, id, 'mcp__ccd_turn__update_plan')
      entry.message.content[0] = { type: 'tool_use', id, name: 'mcp__ccd_turn__update_plan', input } as never

      return entry
    }
    writeLines(file, [
      prompt('Plan it'),
      plan({ items: [{ content: 'A', status: 'pending' }, { content: 'B', status: 'pending' }] }, 'p1'),
      plan({ advance: true }, 'p2'),
    ])
    const state = createTranscriptState()
    await advance(state, file)
    assert.deepEqual(
      state.plan.map((p) => p.status),
      ['in_progress', 'pending'],
    )

    const wrap = toolUse('m-w', 'w1', 'mcp__ccd_turn__wrap_up')
    appendLines(file, [wrap])
    await advance(state, file)
    assert.deepEqual(
      state.plan.map((p) => p.status),
      ['completed', 'completed'],
    )
  })
})

describe('turns', () => {
  test('a slash command names the turn "/command args"; markup is stripped from prompts', async () => {
    const state = await parseFixture('slash-command.jsonl')

    assert.deepEqual(
      state.turns.map((t) => [t.title, t.status]),
      [
        ['/review src/parser.ts', 'completed'],
        ['Now fix the first issue', 'running'],
      ],
    )
    assert.equal(state.powers.skills.review, 1)
  })
})

describe('incremental reads', () => {
  test('keeps a line cut mid-write as leftover until the rest arrives', async () => {
    const file = path.join(scratchDir(), 'partial.jsonl')
    const call = JSON.stringify(toolUse('m1', 't1', 'Read'))
    const cut = 25
    writeFileSync(file, `${JSON.stringify(prompt('Read it'))}\n${call.slice(0, cut)}`)

    const state = createTranscriptState()
    await advance(state, file)
    assert.equal(state.toolCount, 0)
    assert.equal(state.leftover, call.slice(0, cut))

    writeFileSync(file, `${call.slice(cut)}\n`, { flag: 'a' })
    await advance(state, file)
    assert.equal(state.toolCount, 1)
    assert.equal(state.leftover, '')
    assert.equal(totalTokens(state), 15)

    // Nothing new: no work, no double count.
    await advance(state, file)
    assert.equal(state.toolCount, 1)
    assert.equal(totalTokens(state), 15)
  })

  test('starts over when the file shrinks', async () => {
    const file = path.join(scratchDir(), 'shrink.jsonl')
    writeLines(file, [prompt('First'), toolUse('m1', 't1', 'Read'), toolResult('t1'), toolUse('m2', 't2', 'Grep')])
    const state = createTranscriptState()
    await advance(state, file)
    assert.equal(state.toolCount, 2)

    writeLines(file, [prompt('Second'), toolUse('m3', 't3', 'Bash')])
    await advance(state, file)
    assert.equal(state.toolCount, 1)
    assert.deepEqual(
      state.recent.map((c) => c.id),
      ['t3'],
    )
    assert.deepEqual(
      state.turns.map((t) => t.title),
      ['Second'],
    )
    assert.equal(totalTokens(state), 15)
  })

  test('reads only the last 8 MB of a large file and drops the cut first line', async () => {
    const MAX = 8 * 1024 * 1024
    const file = path.join(scratchDir(), 'large.jsonl')
    // The cut lands just before `partial`; were that line kept, its JSON would parse and count.
    const partial = JSON.stringify(toolUse('m-partial', 't-partial', 'Edit'))
    const kept = `${JSON.stringify(toolUse('m-kept', 't-kept', 'Read'))}\n`
    const filler = (n: number) => `${'z'.repeat(n - 1)}\n`
    const tailWithoutFiller = `${partial}\n${kept}`
    const tail = `${partial}\n${filler(MAX - tailWithoutFiller.length)}${kept}`
    assert.equal(Buffer.byteLength(tail), MAX)
    const head = `${JSON.stringify(toolUse('m-early', 't-early', 'Bash'))}\n${'x'.repeat(1000)}`
    writeFileSync(file, head + tail)

    const state = createTranscriptState()
    await advance(state, file)
    assert.deepEqual(
      state.recent.map((c) => c.id),
      ['t-kept'],
    )
    assert.equal(state.offset, Buffer.byteLength(head) + MAX)
    assert.equal(state.leftover, '')

    // Later reads continue from the end, not the tail start.
    appendLines(file, [toolUse('m-next', 't-next', 'Grep')])
    await advance(state, file)
    assert.deepEqual(
      state.recent.map((c) => c.id),
      ['t-kept', 't-next'],
    )
  })

  test('truncation to zero resets everything', async () => {
    const file = path.join(scratchDir(), 'zero.jsonl')
    writeLines(file, [prompt('Hi'), toolUse('m1', 't1', 'Read')])
    const state = createTranscriptState()
    await advance(state, file)
    truncateSync(file, 0)
    await advance(state, file)
    assert.equal(state.offset, 0)
    assert.equal(state.toolCount, 0)
    assert.equal(totalTokens(state), 0)
  })
})
