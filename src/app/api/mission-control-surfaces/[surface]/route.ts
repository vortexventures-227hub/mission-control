import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getMissionControlSurfaceIndex, getMissionControlSurfaceSnapshot } from '@/lib/mission-control-surfaces'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ surface: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { surface } = await params
    if (surface === 'index') return NextResponse.json({ surfaces: getMissionControlSurfaceIndex() })
    const snapshot = getMissionControlSurfaceSnapshot(surface)
    if (!snapshot) return NextResponse.json({ error: 'Mission Control surface not found' }, { status: 404 })
    return NextResponse.json(snapshot)
  } catch (error) {
    logger.error({ err: error }, 'GET /api/mission-control-surfaces/[surface] error')
    return NextResponse.json({ error: 'Failed to load Mission Control surface snapshot' }, { status: 500 })
  }
}
