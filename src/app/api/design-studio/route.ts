import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getDesignStudioSnapshot } from '@/lib/design-studio-command'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getDesignStudioSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/design-studio error')
    return NextResponse.json({ error: 'Failed to load Design Studio snapshot' }, { status: 500 })
  }
}
