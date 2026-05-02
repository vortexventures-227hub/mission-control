import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getSecurityCommandSnapshot, updateSecurityFindingStatus } from '@/lib/security-command-center'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getSecurityCommandSnapshot(auth.user.workspace_id || 1))
  } catch (error) {
    logger.error({ err: error }, 'GET /api/mission-control-mvp/security error')
    return NextResponse.json({ error: 'Failed to load security command snapshot' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    updateSecurityFindingStatus({
      id: Number(body.id),
      workspaceId: auth.user.workspace_id || 1,
      status: body.status,
      evidencePath: body.evidencePath,
    })
    return NextResponse.json(getSecurityCommandSnapshot(auth.user.workspace_id || 1))
  } catch (error) {
    logger.error({ err: error }, 'PATCH /api/mission-control-mvp/security error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update security finding' }, { status: 400 })
  }
}
