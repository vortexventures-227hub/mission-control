import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import {
  GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
  canWriteAsGroupChatAgent,
  createGroupChatMessage,
  listGroupChatMessages,
  normalizeGroupChatAgentId,
} from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const roomSlug = searchParams.get('room') || 'blackwire-ops'
    const messages = listGroupChatMessages(roomSlug, auth.user.workspace_id || 1)
    return NextResponse.json({ messages, generatedAt: Date.now() })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/group-chat/messages error')
    return NextResponse.json({ error: 'Failed to load group chat messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json()
    const roomSlug = typeof body.roomSlug === 'string' ? body.roomSlug : 'blackwire-ops'
    const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
    if (!messageBody) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

    const user = auth.user
    const senderType = body.senderType === 'agent' || body.senderType === 'system' ? body.senderType : 'human'
    if (senderType === 'system' && user.role !== 'admin') {
      return NextResponse.json({
        error: 'System messages require admin authority',
        deliveryBoundary: GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
      }, { status: 403 })
    }
    const senderId = typeof body.senderId === 'string' && body.senderId.trim()
      ? (senderType === 'agent'
        ? normalizeGroupChatAgentId(body.senderId)
        : senderType === 'system'
          ? body.senderId.trim().toLowerCase()
          : (user.role === 'admin' ? body.senderId.trim().toLowerCase() : (user.username || 'chris').toLowerCase()))
      : (senderType === 'agent' ? normalizeGroupChatAgentId(user.username || '') : (user.username || 'chris').toLowerCase())
    if (senderType === 'agent' && !canWriteAsGroupChatAgent({
      senderId,
      authAgentName: user.agent_name,
      authUsername: user.username,
    })) {
      return NextResponse.json({
        error: 'Agent messages require an agent-scoped identity matching senderId',
        deliveryBoundary: GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
      }, { status: 403 })
    }

    const result = createGroupChatMessage({
      roomSlug,
      senderType,
      senderId,
      body: messageBody,
      messageType: body.messageType === 'attachment' || body.messageType === 'alert' || body.messageType === 'task_event'
        ? body.messageType
        : 'normal',
      parentMessageId: typeof body.parentMessageId === 'number' ? body.parentMessageId : null,
      workspaceId: user.workspace_id || 1,
    })

    return NextResponse.json({
      ...result,
      deliveryBoundary: GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY,
      externalDelivery: false,
    }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/group-chat/messages error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create message' }, { status: 500 })
  }
}
