import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { createGroupChatMessage } from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

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
    const senderId = typeof body.senderId === 'string' && body.senderId.trim()
      ? body.senderId.trim().toLowerCase()
      : (user.username || 'chris').toLowerCase()

    const result = createGroupChatMessage({
      roomSlug,
      senderType: body.senderType === 'agent' || body.senderType === 'system' ? body.senderType : 'human',
      senderId,
      body: messageBody,
      messageType: body.messageType === 'attachment' || body.messageType === 'alert' || body.messageType === 'task_event'
        ? body.messageType
        : 'normal',
      parentMessageId: typeof body.parentMessageId === 'number' ? body.parentMessageId : null,
      workspaceId: user.workspace_id || 1,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/group-chat/messages error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create message' }, { status: 500 })
  }
}
