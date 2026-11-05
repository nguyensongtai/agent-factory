import { connection } from 'next/server'

import { errorResponse, readJsonBody } from '@/features/factory/server/http'
import { createMission, listMissions } from '@/features/factory/server/missions-store'

export async function GET() {
  await connection()
  try {
    return Response.json(await listMissions(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error, 'list')
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createMission(await readJsonBody(request)), { status: 201 })
  } catch (error) {
    return errorResponse(error, 'create')
  }
}
