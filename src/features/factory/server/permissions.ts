import 'server-only'

import { readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { Permissions } from '../domain/types'

// Claude Code settings that grant tools to a project. Only rule strings and MCP server *names* are read;
// server configs (commands, env, tokens) never leave this module.
const USER_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json')
const USER_STATE = path.join(os.homedir(), '.claude.json')
const MAX_RULES = 60

type Cached = { mtime: number; json: unknown }
const files = new Map<string, Cached>()

async function readJson(file: string): Promise<unknown> {
  const info = await stat(file).catch(() => null)
  if (!info) return null
  const hit = files.get(file)
  if (hit && hit.mtime === info.mtimeMs) return hit.json
  let json: unknown = null
  try {
    json = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    console.error('[factory] unreadable settings file', file, error)
  }
  files.set(file, { mtime: info.mtimeMs, json })

  return json
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export async function readPermissions(cwd: string): Promise<Permissions> {
  if (!cwd) return { allow: [], mcpServers: [] }
  const [user, project, local, mcpJson, state] = await Promise.all([
    readJson(USER_SETTINGS),
    readJson(path.join(cwd, '.claude', 'settings.json')),
    readJson(path.join(cwd, '.claude', 'settings.local.json')),
    readJson(path.join(cwd, '.mcp.json')),
    readJson(USER_STATE),
  ])
  const allow = new Set<string>()
  for (const settings of [user, project, local]) {
    for (const rule of strings(record(record(settings).permissions).allow)) allow.add(rule)
  }
  const servers = new Set<string>([
    ...Object.keys(record(record(mcpJson).mcpServers)),
    ...Object.keys(record(record(state).mcpServers)),
    ...Object.keys(record(record(record(record(state).projects)[cwd]).mcpServers)),
  ])

  return { allow: [...allow].slice(0, MAX_RULES), mcpServers: [...servers].sort() }
}
