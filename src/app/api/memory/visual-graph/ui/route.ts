import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getVisualGalaxyUiSnapshot } from '@/lib/visual-memory-graph'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const search = request.nextUrl.searchParams
    const mode = search.get('mode') || 'overview'
    const selectedId = search.get('id')
    const limit = Number(search.get('limit') || 360)
    return NextResponse.json(getVisualGalaxyUiSnapshot({ mode, selectedId, limit }))
  } catch (error) {
    logger.error({ err: error }, 'GET /api/memory/visual-graph/ui error')
    return NextResponse.json({ error: 'Failed to load Visual Memory Galaxy UI slice' }, { status: 500 })
  }
}
