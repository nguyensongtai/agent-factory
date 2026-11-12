import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { newlyAsking, statusesOf, waitingCount, withWaitingCount } from '../src/features/factory/domain/alerts'
import type { AgentSnapshot, AgentStatus, SubagentSnapshot } from '../src/features/factory/domain/types'

const sub = (id: string, status: AgentStatus) => ({ id, agentType: 'Explore', status, current: null }) as unknown as SubagentSnapshot

const agent = (id: string, status: AgentStatus, subagents: SubagentSnapshot[] = []) =>
  ({ id, name: `Agent ${id}`, status, current: null, subagents }) as unknown as AgentSnapshot

describe('asking alerts', () => {
  test('agents already asking when the page loads are not announced', () => {
    assert.deepEqual(newlyAsking(null, [agent('a', 'asking', [sub('s', 'asking')])]), [])
  })

  test('announces a transition to asking once, not on every poll', () => {
    let previous = statusesOf([agent('a', 'working'), agent('b', 'asking')])
    const next = [agent('a', 'asking'), agent('b', 'asking')]
    assert.deepEqual(
      newlyAsking(previous, next).map((a) => a.key),
      ['a'],
    )

    previous = statusesOf(next)
    assert.deepEqual(newlyAsking(previous, next), [])

    // Asking again after answering is a new transition.
    previous = statusesOf([agent('a', 'working'), agent('b', 'asking')])
    assert.deepEqual(
      newlyAsking(previous, next).map((a) => a.key),
      ['a'],
    )
  })

  test('a subagent that starts asking opens the agent that started it', () => {
    const previous = statusesOf([agent('a', 'working', [sub('s1', 'working')])])
    const alerts = newlyAsking(previous, [agent('a', 'working', [sub('s1', 'asking'), sub('s2', 'asking')])])

    assert.deepEqual(
      alerts.map((a) => [a.key, a.agentId, a.name]),
      [
        ['a/s1', 'a', 'Agent a › Explore'],
        ['a/s2', 'a', 'Agent a › Explore'],
      ],
    )
  })

  test('counts every waiting agent and subagent', () => {
    assert.equal(waitingCount([agent('a', 'asking', [sub('s', 'asking')]), agent('b', 'idle', [sub('t', 'working')])]), 2)
    assert.equal(waitingCount([]), 0)
  })

  test('the waiting count prefixes the title without stacking', () => {
    assert.equal(withWaitingCount('Làng Ninja AI', 2), '(2) Làng Ninja AI')
    assert.equal(withWaitingCount('(2) Ninja · Làng Ninja AI', 3), '(3) Ninja · Làng Ninja AI')
    assert.equal(withWaitingCount('(1) Làng Ninja AI', 0), 'Làng Ninja AI')
  })
})
