import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = requireRole(req, 'viewer')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  const db = getDatabase()
  const { searchParams } = new URL(req.url)
  const workspaceId = 1
  const category = searchParams.get('category')
  const days = parseInt(searchParams.get('days') || '30', 10)
  const since = Date.now() - days * 24 * 60 * 60 * 1000

  // Summary mode
  if (searchParams.get('action') === 'summary') {
    const total = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE workspace_id = ? AND expense_date >= ?`).get(workspaceId, since) as any)?.total || 0
    const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE workspace_id = ? AND expense_date >= ? GROUP BY category`).all(workspaceId, since) as any[]
    const recurring = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE workspace_id = ? AND is_recurring = 1`).get(workspaceId) as any)?.total || 0
    const subTotal = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE workspace_id = ? AND status = 'active'`).get(workspaceId) as any)?.total || 0
    return NextResponse.json({ total, byCategory, recurring, monthlySubscriptions: subTotal })
  }

  let query = `SELECT * FROM expenses WHERE workspace_id = ?`
  const params: any[] = [workspaceId]
  if (category) { query += ` AND category = ?`; params.push(category) }
  query += ` ORDER BY expense_date DESC LIMIT 200`

  const expenses = db.prepare(query).all(...params)
  return NextResponse.json({ expenses })
}

export async function POST(req: NextRequest) {
  const authResult = requireRole(req, 'operator')
  if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: authResult.status })

  const db = getDatabase()
  const body = await req.json()
  const { amount, currency = 'USD', category, description, vendor, source = 'manual', agent_id, expense_date, is_recurring = 0, recurrence } = body

  if (!amount || !category || !description) {
    return NextResponse.json({ error: 'amount, category, description required' }, { status: 400 })
  }

  const result = db.prepare(`
    INSERT INTO expenses (workspace_id, amount, currency, category, description, vendor, source, agent_id, expense_date, is_recurring, recurrence)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(amount, currency, category, description, vendor || null, source, agent_id || null, expense_date || Date.now(), is_recurring, recurrence || null)

  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}
