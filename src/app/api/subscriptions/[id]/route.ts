import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = requireRole(req, 'operator')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  const params = await context.params
  const db = getDatabase()
  const body = await req.json()
  const now = Date.now()
  const { name, vendor, amount, currency, billing_cycle, category, status, next_billing_date, notes } = body
  db.prepare(`UPDATE subscriptions SET name=COALESCE(?,name), vendor=COALESCE(?,vendor), amount=COALESCE(?,amount), currency=COALESCE(?,currency), billing_cycle=COALESCE(?,billing_cycle), category=COALESCE(?,category), status=COALESCE(?,status), next_billing_date=COALESCE(?,next_billing_date), notes=COALESCE(?,notes), updated_at=? WHERE id=? AND workspace_id=1`)
    .run(name, vendor, amount, currency, billing_cycle, category, status, next_billing_date, notes, now, params.id)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = requireRole(req, 'operator')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  const params = await context.params
  const db = getDatabase()
  db.prepare(`DELETE FROM subscriptions WHERE id = ? AND workspace_id = 1`).run(params.id)
  return NextResponse.json({ success: true })
}
