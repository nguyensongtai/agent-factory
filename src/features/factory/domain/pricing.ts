// Public Claude API prices in USD per million tokens (platform.claude.com pricing, Nov 2026).
// Claude Code on a subscription is not billed per token, so these only estimate the API equivalent.
type Price = { input: number; output: number; cacheRead: number }

// Longest prefix wins, so 'claude-opus-5-5' is matched before 'claude-opus-5'.
const PRICES: [string, Price][] = (
  [
    ['claude-fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
    ['claude-mythos-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
    ['claude-fable-5', { input: 10, output: 50, cacheRead: 1 }],
    ['claude-mythos-5', { input: 10, output: 50, cacheRead: 1 }],
    ['claude-opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
    ['claude-opus-5', { input: 5, output: 25, cacheRead: 0.5 }],
    ['claude-opus-4-1', { input: 15, output: 75, cacheRead: 1.5 }],
    ['claude-opus-4-2025', { input: 15, output: 75, cacheRead: 1.5 }],
    ['claude-opus-4', { input: 5, output: 25, cacheRead: 0.5 }],
    ['claude-sonnet-5-5', { input: 2, output: 10, cacheRead: 0.2 }],
    ['claude-sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
    ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3 }],
    ['claude-haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01 }],
    ['claude-haiku-4-5', { input: 1, output: 5, cacheRead: 0.1 }],
  ] as [string, Price][]
).sort((a, b) => b[0].length - a[0].length)

export type MessageUsage = {
  input: number
  output: number
  cacheRead: number
  write5m: number
  write1h: number
  fast: boolean
}

// Returns null for models without a known price (e.g. synthetic messages).
export function estimateCost(model: string, u: MessageUsage): number | null {
  const entry = PRICES.find(([prefix]) => model.startsWith(prefix))
  if (!entry) return null
  let price = entry[1]
  // Haiku 5.5 charges 5x for prompts above 100K tokens.
  if (entry[0] === 'claude-haiku-5-5' && u.input + u.cacheRead + u.write5m + u.write1h > 100_000) {
    price = { input: 0.5, output: 2.5, cacheRead: 0.05 }
  }
  const speed = u.fast ? 2 : 1
  const dollars =
    u.input * price.input +
    u.output * price.output +
    u.cacheRead * price.cacheRead +
    u.write5m * price.input * 1.25 +
    u.write1h * price.input * 2

  return (dollars * speed) / 1_000_000
}
