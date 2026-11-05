import { errorResponse, isSameOrigin, readJsonBody } from '@/features/factory/server/http'
import { deleteMission, updateMission } from '@/features/factory/server/missions-store'

export async function PATCH(request: Request, ctx: RouteContext<'/api/missions/[id]'>) {
  try {
    const { id } = await ctx.params
    const mission = await updateMission(id, await readJsonBody(request))

    return mission ? Response.json(mission) : Response.json({ error: 'Không tìm thấy nhiệm vụ' }, { status: 404 })
  } catch (error) {
    return errorResponse(error, 'update')
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/missions/[id]'>) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Sai nguồn gửi yêu cầu' }, { status: 403 })
    const { id } = await ctx.params

    return (await deleteMission(id))
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'Không tìm thấy nhiệm vụ' }, { status: 404 })
  } catch (error) {
    return errorResponse(error, 'delete')
  }
}
