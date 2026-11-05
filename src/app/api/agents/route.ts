import { connection } from 'next/server'

import { getFactorySnapshot } from '@/features/factory/server/tracker'

export async function GET() {
  // Transcripts change every second: never prerender this handler.
  await connection()
  try {
    return Response.json(await getFactorySnapshot(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[agents] snapshot failed', error)

    return Response.json({ error: 'Không đọc được transcript Claude Code' }, { status: 500 })
  }
}
