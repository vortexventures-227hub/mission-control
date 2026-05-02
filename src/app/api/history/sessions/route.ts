import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // YYYY-MM-DD
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const agent = searchParams.get('agent')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const db = getDatabase()

    // Build date filter
    let dateFilter = ''
    const params: (string | number)[] = []

    if (dateParam) {
      // Specific date: match sessions that had activity on that date
      dateFilter = `AND (
        (julianday('now') - julianday(datetime(start_time / 1000, 'unixepoch'))) < 1
        AND date(datetime(start_time / 1000, 'unixepoch')) = ?
      )`
      params.push(dateParam)
    } else if (startDate && endDate) {
      dateFilter = `AND date(datetime(start_time / 1000, 'unixepoch')) BETWEEN ? AND ?`
      params.push(startDate, endDate)
    } else {
      // Default: last 7 days
      dateFilter = `AND (julianday('now') - julianday(datetime(start_time / 1000, 'unixepoch'))) <= 7`
    }

    // Build agent filter
    let agentFilter = ''
    if (agent) {
      agentFilter = `AND (agent_name = ? OR session_key LIKE ?)`
      params.push(agent, `%${agent}%`)
    }

    const query = `
      SELECT
        id,
        session_key,
        agent_name,
        kind,
        model,
        start_time,
        last_activity_time,
        end_time,
        status,
        token_count,
        NUM_MESSAGES as message_count,
        (CASE WHEN end_time IS NULL THEN 1 ELSE 0 END) as is_active
      FROM sessions
      WHERE 1=1 ${dateFilter} ${agentFilter}
      ORDER BY last_activity_time DESC
      LIMIT ?
    `

    params.push(limit)

    let rows: Array<Record<string, unknown>> = []
    try {
      rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>
    } catch {
      // Table might not exist yet — return empty
      rows = []
    }

    const sessions = rows.map(row => ({
      id: String(row.id),
      key: String(row.session_key || ''),
      agent: String(row.agent_name || ''),
      kind: String(row.kind || ''),
      model: String(row.model || ''),
      startTime: row.start_time ? Number(row.start_time) : null,
      lastActivity: row.last_activity_time ? Number(row.last_activity_time) : null,
      endTime: row.end_time ? Number(row.end_time) : null,
      status: String(row.status || 'unknown'),
      tokens: Number(row.token_count || 0),
      messages: Number(row.message_count || 0),
      active: Boolean(row.is_active),
    }))

    // Group by date
    const byDate: Record<string, typeof sessions> = {}
    for (const session of sessions) {
      if (session.lastActivity) {
        const date = new Date(session.lastActivity).toISOString().split('T')[0]
        if (!byDate[date]) byDate[date] = []
        byDate[date].push(session)
      }
    }

    return NextResponse.json({
      sessions,
      byDate,
      count: sessions.length,
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/history/sessions error')
    return NextResponse.json({ error: 'Failed to fetch session history', sessions: [], byDate: {} }, { status: 500 })
  }
}
