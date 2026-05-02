import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getResearchCommandSnapshot } from '@/lib/research-command'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getResearchCommandSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/research-command error')
    return NextResponse.json({ error: 'Failed to load Research Command snapshot' }, { status: 500 })
  }
}
