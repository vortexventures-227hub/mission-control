import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getVisualMemoryGraphSnapshot } from '@/lib/visual-memory-graph'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getVisualMemoryGraphSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/memory/visual-graph error')
    return NextResponse.json({ error: 'Failed to load Visual Memory Graph snapshot' }, { status: 500 })
  }
}
