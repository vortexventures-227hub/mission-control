import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getBrainstormSnapshot } from '@/lib/brainstorm-command'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getBrainstormSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/brainstorm-command error')
    return NextResponse.json({ error: 'Failed to load Brainstorm Wall snapshot' }, { status: 500 })
  }
}
