import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'research-intake-api' })

export async function POST(req: NextRequest) {
  const auth = requireRole(req, 'viewer')
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const { url, notes, assigned_to = 'mrblanc' } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Create a task for Mr. Blanc
    const now = Math.floor(Date.now() / 1000)
    const jobId = `research-${now}-${Math.random().toString(36).slice(2, 8)}`
    const db = getDatabase()

    // Insert as a task in the tasks table
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, created_at, updated_at, metadata)
      VALUES (?, ?, 'pending', 'normal', ?, 'system', ?, ?, ?)
    `)

    const result = stmt.run(
      `Research: ${url}`,
      notes ? `Notes: ${notes}\n\nURL: ${url}` : `Process and summarize content from: ${url}`,
      assigned_to,
      now,
      now,
      JSON.stringify({
        type: 'research_intake',
        job_id: jobId,
        url,
        notes: notes || null,
        source: 'mission_control'
      })
    )

    log.info(`Research intake task created: ${result.lastInsertRowid}`)

    return NextResponse.json({
      success: true,
      job: {
        id: jobId,
        task_id: result.lastInsertRowid,
        url,
        notes,
        status: 'pending',
        created_at: now,
        assigned_to
      }
    })
  } catch (error) {
    log.error('Failed to create research intake task')
    return NextResponse.json(
      { error: 'Failed to create research request' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const auth = requireRole(req, 'viewer')
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const db = getDatabase()

    // Get recent research tasks
    const stmt = db.prepare(`
      SELECT * FROM tasks 
      WHERE metadata LIKE '%"type":"research_intake"%'
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const tasks = stmt.all(limit) as any[]

    const jobs = tasks.map((task) => {
      const metadata = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata
      return {
        id: metadata.job_id || task.id,
        task_id: task.id,
        url: metadata.url,
        notes: metadata.notes,
        status: task.status,
        created_at: task.created_at,
        completed_at: task.completed_at,
        result: task.result ? (typeof task.result === 'string' ? JSON.parse(task.result) : task.result) : null
      }
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    log.error('Failed to fetch research jobs')
    return NextResponse.json(
      { error: 'Failed to fetch research jobs' },
      { status: 500 }
    )
  }
}
