import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { requestKnowledgeLearningAction } from '@/lib/knowledge-intake'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const sourceId = String(body.source_id || '')
    const destination = String(body.destination || '')
    if (!sourceId || !destination) {
      return NextResponse.json({ error: 'source_id and destination are required' }, { status: 400 })
    }

    const receipt = requestKnowledgeLearningAction(sourceId, destination)
    return NextResponse.json({ receipt, approval_required: true }, { status: 202 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/knowledge-intake/actions error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to stage approval request' }, { status: 400 })
  }
}
