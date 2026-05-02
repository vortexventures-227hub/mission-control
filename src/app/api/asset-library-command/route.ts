import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getAssetLibrarySnapshot } from '@/lib/asset-library-command'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getAssetLibrarySnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/asset-library-command error')
    return NextResponse.json({ error: 'Failed to load Asset Library snapshot' }, { status: 500 })
  }
}
