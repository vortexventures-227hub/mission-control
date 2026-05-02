import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  getGroupChatRoomBySlug,
  listGroupChatAgentProfiles,
  listGroupChatAssignments,
  listGroupChatDecisionReceipts,
  listGroupChatMessages,
  listGroupChatQueuedAlerts,
  listGroupChatRooms,
} from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const workspaceId = auth.user.workspace_id || 1
    const { searchParams } = new URL(request.url)
    const selectedSlug = searchParams.get('room') || 'blackwire-ops'
    const rooms = listGroupChatRooms(workspaceId)
    const selectedRoom = getGroupChatRoomBySlug(selectedSlug, workspaceId) || rooms[0] || null
    const messages = selectedRoom ? listGroupChatMessages(selectedRoom.slug, workspaceId) : []
    const assignments = selectedRoom ? listGroupChatAssignments(selectedRoom.id, workspaceId) : []
    const receipts = selectedRoom ? listGroupChatDecisionReceipts(selectedRoom.id, workspaceId) : []
    const queuedAlerts = selectedRoom ? listGroupChatQueuedAlerts(selectedRoom.id, workspaceId) : []
    const agentProfiles = listGroupChatAgentProfiles(workspaceId)

    return NextResponse.json({
      rooms,
      selectedRoom,
      messages,
      assignments,
      receipts,
      queuedAlerts,
      agentProfiles,
      generatedAt: Date.now(),
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/group-chat/rooms error')
    return NextResponse.json({ error: 'Failed to load group chat rooms' }, { status: 500 })
  }
}
