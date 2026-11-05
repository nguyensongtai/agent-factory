import 'server-only'

import path from 'node:path'

export function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function short(text: string, max = 48): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()

  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

export function mcpServer(name: string): string {
  const server = name.split('__')[1] ?? 'mcp'
  // Connector servers are registered under opaque UUIDs.
  if (/^[0-9a-f-]{36}$/.test(server)) return 'connector'
  if (server === 'claude-in-chrome') return 'Chrome'

  return server.replace(/^claude[-_]/i, '').replace(/^ccd_/, 'app ')
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return short(url)
  }
}

export function describeTool(name: string, input: Record<string, unknown>): string {
  const file = str(input.file_path) || str(input.notebook_path) || str(input.path)
  switch (name) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return path.basename(file)
    case 'Bash':
      return short(str(input.description) || str(input.command))
    case 'Grep':
    case 'Glob':
      return short(str(input.pattern))
    case 'WebFetch':
      return safeHost(str(input.url))
    case 'WebSearch':
      return short(str(input.query))
    case 'Agent':
    case 'Task':
      return short(`${str(input.subagent_type) || 'general'} · ${str(input.description)}`)
    case 'Skill':
      return str(input.skill)
    default:
      if (name.startsWith('mcp__')) return `${mcpServer(name)} › ${name.split('__').slice(2).join('_')}`

      return short(str(input.description) || str(input.query) || str(input.title) || '')
  }
}

// Plain text of a tool_result or user message content, whatever its shape.
export function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((block: { type?: string; text?: string }) => (block?.type === 'text' ? (block.text ?? '') : ''))
    .join(' ')
}
