import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { getGroupChatRoomBySlug, listGroupChatAssignments, updateGroupChatAssignmentStatus } from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const roomSlug = searchParams.get('room') || 'blackwire-ops'
    const workspaceId = auth.user.workspace_id || 1
    const room = getGroupChatRoomBySlug(roomSlug, workspaceId)
    const assignments = room ? listGroupChatAssignments(room.id, workspaceId) : []
    return NextResponse.json({ assignments, selectedRoom: room, generatedAt: Date.now() })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/group-chat/assignments error')
    return NextResponse.json({ error: 'Failed to load group chat assignments' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json()
    if (typeof body.assignmentId !== 'number') {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
    }
    if (!['created', 'accepted', 'working', 'blocked', 'done'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be created, accepted, working, blocked, or done' }, { status: 400 })
    }
    const evidence = typeof body.evidence === 'string' ? body.evidence.trim() : ''
    if (body.status === 'done' && !evidence) {
      return NextResponse.json({ error: 'Evidence is required before an assignment can move to Done' }, { status: 400 })
    }

    const assignment = updateGroupChatAssignmentStatus({
      assignmentId: body.assignmentId,
      status: body.status,
      evidence: evidence || undefined,
      workspaceId: auth.user.workspace_id || 1,
    })

    return NextResponse.json({ assignment })
  } catch (error) {
    logger.error({ err: error }, 'PATCH /api/group-chat/assignments error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update assignment' }, { status: 500 })
  }
}
