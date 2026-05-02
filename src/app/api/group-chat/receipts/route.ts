import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { createGroupChatDecisionReceipt } from '@/lib/group-chat'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json()
    const decision = typeof body.decision === 'string' ? body.decision.trim() : ''
    if (!decision) return NextResponse.json({ error: 'decision is required' }, { status: 400 })
    if (!['none', 'mission_control', 'chris_explicit'].includes(body.approvalTier)) {
      return NextResponse.json({ error: 'approvalTier must be none, mission_control, or chris_explicit' }, { status: 400 })
    }

    const receipt = createGroupChatDecisionReceipt({
      roomSlug: typeof body.roomSlug === 'string' ? body.roomSlug : 'blackwire-ops',
      sourceMessageId: typeof body.sourceMessageId === 'number' ? body.sourceMessageId : null,
      decision,
      approvedBy: typeof body.approvedBy === 'string' && body.approvedBy.trim()
        ? body.approvedBy.trim()
        : auth.user.display_name || auth.user.username || 'operator',
      approvalTier: body.approvalTier,
      evidence: typeof body.evidence === 'string' ? body.evidence : undefined,
      workspaceId: auth.user.workspace_id || 1,
    })

    return NextResponse.json({ receipt }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/group-chat/receipts error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create decision receipt' }, { status: 500 })
  }
}
