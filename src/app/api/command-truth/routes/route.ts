import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { getCommandTruthRouteContract } from '@/lib/command-truth-route-contract'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const workspaceId = auth.user.workspace_id || 1
  return NextResponse.json(getCommandTruthRouteContract(workspaceId))
}
