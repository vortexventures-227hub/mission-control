import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, 'viewer')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  const db = getDatabase()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'active'

  const subs = db.prepare(`SELECT * FROM subscriptions WHERE workspace_id = 1 ${status !== 'all' ? 'AND status = ?' : ''} ORDER BY amount DESC`)
    .all(...(status !== 'all' ? [status] : []))

  const monthlyTotal = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN billing_cycle='monthly' THEN amount WHEN billing_cycle='annual' THEN amount/12.0 ELSE 0 END), 0) as total FROM subscriptions WHERE workspace_id = 1 AND status = 'active'`).get() as any)?.total || 0
  const annualTotal = (db.prepare(`SELECT COALESCE(SUM(CASE WHEN billing_cycle='annual' THEN amount WHEN billing_cycle='monthly' THEN amount*12 ELSE 0 END), 0) as total FROM subscriptions WHERE workspace_id = 1 AND status = 'active'`).get() as any)?.total || 0

  return NextResponse.json({ subscriptions: subs, monthlyTotal, annualTotal })
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, 'operator')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  const db = getDatabase()
  const body = await req.json()
  const { name, vendor, amount, currency = 'USD', billing_cycle, category, status = 'active', next_billing_date, notes } = body

  if (!name || !vendor || !amount || !billing_cycle || !category) {
    return NextResponse.json({ error: 'name, vendor, amount, billing_cycle, category required' }, { status: 400 })
  }

  const now = Date.now()
  const result = db.prepare(`
    INSERT INTO subscriptions (workspace_id, name, vendor, amount, currency, billing_cycle, category, status, next_billing_date, notes, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, vendor, amount, currency, billing_cycle, category, status, next_billing_date || null, notes || null, now, now)

  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}
