export function timeAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 5) return 'vừa xong'
  if (seconds < 60) return `${seconds} giây trước`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`

  return `${Math.round(minutes / 60)} giờ trước`
}

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString('vi-VN', { hour12: false })
}

export function toolLabel(name: string): string {
  return name.startsWith('mcp__') ? 'MCP' : name
}

export function topEntries(record: Record<string, number>, limit = 12): [string, number][] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

export function compact(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`

  return `${Math.round(value)}`
}

export function usd(value: number): string {
  if (value === 0) return '$0'
  if (value < 0.01) return '<$0.01'

  return `$${value.toFixed(value < 100 ? 2 : 0)}`
}

export function duration(ms: number): string {
  if (ms <= 0) return '–'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`

  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–'
}

export function totalTokens(t: { input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  return t.input + t.output + t.cacheRead + t.cacheWrite
}
