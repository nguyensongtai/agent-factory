import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { estimateCost, type MessageUsage } from '../src/features/factory/domain/pricing'

const M = 1_000_000
const none: MessageUsage = { input: 0, output: 0, cacheRead: 0, write5m: 0, write1h: 0, fast: false }
const usage = (u: Partial<MessageUsage>): MessageUsage => ({ ...none, ...u })
const close = (actual: number | null, expected: number) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

describe('estimateCost', () => {
  test('the longest matching prefix wins', () => {
    // claude-opus-5-5 ($4) must not fall back to claude-opus-5 ($5).
    close(estimateCost('claude-opus-5-5', usage({ input: M })), 4)
    close(estimateCost('claude-opus-5-5-20261101', usage({ input: M })), 4)
    close(estimateCost('claude-opus-5-20260301', usage({ input: M })), 5)
    close(estimateCost('claude-fable-5-1', usage({ cacheRead: M })), 0.25)
    close(estimateCost('claude-fable-5', usage({ cacheRead: M })), 1)
    close(estimateCost('claude-opus-4-1-20250805', usage({ output: M })), 75)
    close(estimateCost('claude-opus-4-6', usage({ output: M })), 25)
  })

  test('unknown and synthetic models have no price', () => {
    assert.equal(estimateCost('<synthetic>', usage({ input: M })), null)
    assert.equal(estimateCost('claude-nova-7', usage({ input: M })), null)
    assert.equal(estimateCost('', usage({ input: M })), null)
  })

  test('Haiku 5.5 switches to the long-context tier above 100K prompt tokens', () => {
    close(estimateCost('claude-haiku-5-5', usage({ input: 100_000, output: M })), (100_000 * 0.1) / M + 0.5)
    close(estimateCost('claude-haiku-5-5', usage({ input: 100_001, output: M })), (100_001 * 0.5) / M + 2.5)
    // Cached and cache-write tokens count toward the prompt size.
    close(
      estimateCost('claude-haiku-5-5', usage({ input: 1, cacheRead: 60_000, write5m: 40_000 })),
      (1 * 0.5 + 60_000 * 0.05 + 40_000 * 0.5 * 1.25) / M,
    )
    // Other models keep their price at any size.
    close(estimateCost('claude-haiku-4-5', usage({ input: 200_000 })), (200_000 * 1) / M)
  })

  test('cache writes cost 1.25x input for 5 minutes and 2x for 1 hour', () => {
    close(estimateCost('claude-sonnet-5-5', usage({ write5m: M })), 2 * 1.25)
    close(estimateCost('claude-sonnet-5-5', usage({ write1h: M })), 2 * 2)
    close(estimateCost('claude-sonnet-5-5', usage({ cacheRead: M })), 0.2)
  })

  test('fast mode doubles the whole message', () => {
    const u = { input: M, output: M, cacheRead: M, write5m: M, write1h: M }
    const normal = estimateCost('claude-opus-5-5', usage(u))!
    close(normal, 4 + 20 + 0.2 + 5 + 8)
    close(estimateCost('claude-opus-5-5', usage({ ...u, fast: true })), normal * 2)
  })
})
