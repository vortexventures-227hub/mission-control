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
  const { amount, currency, category, description, vendor, expense_date, is_recurring, recurrence } = body
  db.prepare(`UPDATE expenses SET amount=COALESCE(?,amount), currency=COALESCE(?,currency), category=COALESCE(?,category), description=COALESCE(?,description), vendor=COALESCE(?,vendor), expense_date=COALESCE(?,expense_date), is_recurring=COALESCE(?,is_recurring), recurrence=COALESCE(?,recurrence) WHERE id=? AND workspace_id=1`)
    .run(amount, currency, category, description, vendor, expense_date, is_recurring, recurrence, params.id)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authResult = requireRole(req, 'operator')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  const params = await context.params
  const db = getDatabase()
  db.prepare(`DELETE FROM expenses WHERE id = ? AND workspace_id = 1`).run(params.id)
  return NextResponse.json({ success: true })
}
