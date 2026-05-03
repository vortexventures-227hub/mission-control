import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createKnowledgeSource, getKnowledgeIntakeHomeSnapshot } from '@/lib/knowledge-intake'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getKnowledgeIntakeHomeSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/knowledge-intake error')
    return NextResponse.json({ error: 'Failed to load Knowledge Intake' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const snapshot = createKnowledgeSource({
      content: String(body.content || ''),
      context_note: typeof body.context_note === 'string' ? body.context_note : undefined,
      project_scope: typeof body.project_scope === 'string' ? body.project_scope : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
      workspace_id: auth.user.workspace_id || 1,
    })
    return NextResponse.json(snapshot, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/knowledge-intake error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to capture source' }, { status: 400 })
  }
}
