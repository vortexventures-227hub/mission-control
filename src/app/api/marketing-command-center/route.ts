import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getMarketingCommandCenterSnapshot } from '@/lib/marketing-command-center'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getMarketingCommandCenterSnapshot(auth.user.workspace_id || 1))
  } catch (error) {
    logger.error({ err: error }, 'GET /api/marketing-command-center error')
    return NextResponse.json({ error: 'Failed to load Marketing Command Center snapshot' }, { status: 500 })
  }
}
