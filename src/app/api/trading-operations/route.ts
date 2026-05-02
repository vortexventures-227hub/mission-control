import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getTradingOperationsSnapshot } from '@/lib/trading-operations-command'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getTradingOperationsSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/trading-operations error')
    return NextResponse.json({ error: 'Failed to load Trading Operations snapshot' }, { status: 500 })
  }
}
