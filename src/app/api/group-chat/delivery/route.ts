import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import {
  GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
  canWriteAsGroupChatAgent,
  updateGroupChatDeliveryState,
} from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json()
    if (typeof body.messageId !== 'number') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }
    if (!['sent', 'delivered', 'seen'].includes(body.state)) {
      return NextResponse.json({ error: 'state must be sent, delivered, or seen' }, { status: 400 })
    }
    if (!['human', 'agent', 'room'].includes(body.recipientType)) {
      return NextResponse.json({ error: 'recipientType must be human, agent, or room' }, { status: 400 })
    }
    if (typeof body.recipientId !== 'string' || !body.recipientId.trim()) {
      return NextResponse.json({ error: 'recipientId is required' }, { status: 400 })
    }
    const recipientId = body.recipientId.trim().toLowerCase()
    if (body.recipientType === 'agent' && auth.user.role !== 'admin' && !canWriteAsGroupChatAgent({
      senderId: recipientId,
      authAgentName: auth.user.agent_name,
      authUsername: auth.user.username,
    })) {
      return NextResponse.json({
        error: 'Agent read-state updates require the same agent identity or admin authority',
        deliveryBoundary: GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
      }, { status: 403 })
    }

    const delivery = updateGroupChatDeliveryState({
      messageId: body.messageId,
      recipientType: body.recipientType,
      recipientId,
      state: body.state,
      evidence: typeof body.evidence === 'string' ? body.evidence : GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
      workspaceId: auth.user.workspace_id || 1,
    })

    return NextResponse.json({ delivery, deliveryBoundary: GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY, externalDelivery: false })
  } catch (error) {
    logger.error({ err: error }, 'PATCH /api/group-chat/delivery error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update delivery' }, { status: 500 })
  }
}
