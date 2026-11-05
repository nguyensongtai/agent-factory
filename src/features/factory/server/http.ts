import 'server-only'

import { MissionInputError } from './missions-store'

// The server only listens on localhost, but any page the user opens could still post to it.
// Requiring JSON forces a CORS preflight (which we never approve) and the Origin check stops the rest.
// request.url is normalised by Next (127.0.0.1 may come back as localhost), so compare with the Host header.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!isSameOrigin(request)) throw new MissionInputError('Sai nguồn gửi yêu cầu')
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new MissionInputError('Cần gửi JSON')
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MissionInputError('Dữ liệu không hợp lệ')

  return body as Record<string, unknown>
}

export function errorResponse(error: unknown, context: string): Response {
  if (error instanceof MissionInputError) return Response.json({ error: error.message }, { status: 400 })
  console.error(`[missions] ${context} failed`, error)

  return Response.json({ error: 'Không lưu được nhiệm vụ' }, { status: 500 })
}
