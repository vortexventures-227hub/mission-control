import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getMissionControlMvpSnapshot } from '@/lib/mission-control-mvp'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getMissionControlMvpSnapshot(auth.user.workspace_id || 1))
  } catch (error) {
    logger.error({ err: error }, 'GET /api/mission-control-mvp error')
    return NextResponse.json({ error: 'Failed to load Mission Control MVP snapshot' }, { status: 500 })
  }
}
