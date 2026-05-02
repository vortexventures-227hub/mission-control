import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getSecurityCommandSnapshot, updateSecurityFindingStatus } from '@/lib/security-command-center'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    return NextResponse.json(getSecurityCommandSnapshot())
  } catch (error) {
    logger.error({ err: error }, 'GET /api/security-command-center error')
    return NextResponse.json({ error: 'Failed to load Security Command Center snapshot' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const id = Number(body?.id)
    const status = String(body?.status || '')
    const evidencePath = typeof body?.evidencePath === 'string' ? body.evidencePath : undefined

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Finding id is required' }, { status: 400 })
    }
    if (!['new', 'triage', 'accepted_risk', 'fixing', 'needs_verification', 'resolved', 'superseded'].includes(status)) {
      return NextResponse.json({ error: 'Valid finding status is required' }, { status: 400 })
    }

    updateSecurityFindingStatus({ id, status: status as any, evidencePath })
    return NextResponse.json({ ok: true, snapshot: getSecurityCommandSnapshot() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update security finding'
    logger.error({ err: error }, 'PATCH /api/security-command-center error')
    return NextResponse.json({ error: message }, { status: message.includes('evidence_path') ? 400 : 500 })
  }
}
