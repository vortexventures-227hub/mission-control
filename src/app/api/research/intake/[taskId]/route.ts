import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'research-intake-task-api' })

interface RouteParams {
  params: Promise<{ taskId: string }>
}

// GET single task status
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, 'viewer')
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { taskId } = await params
    const db = getDatabase()

    const stmt = db.prepare(`SELECT * FROM tasks WHERE id = ?`)
    const task = stmt.get(taskId) as any

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const metadata = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata
    
    if (metadata.type !== 'research_intake') {
      return NextResponse.json({ error: 'Not a research task' }, { status: 400 })
    }

    return NextResponse.json({
      id: metadata.job_id || task.id,
      task_id: task.id,
      url: metadata.url,
      notes: metadata.notes,
      status: task.status,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at,
      result: task.result ? (typeof task.result === 'string' ? JSON.parse(task.result) : task.result) : null,
      notification_error: metadata.notification_error
    })
  } catch (error) {
    log.error("Failed to fetch research task")
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    )
  }
}

// PATCH to update task status/result (for agents to report back)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = requireRole(req, 'viewer')
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { taskId } = await params
    const body = await req.json()
    const { status, result } = body

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Build update query
    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (status && ['pending', 'processing', 'completed', 'error'].includes(status)) {
      updates.push('status = ?')
      values.push(status)
      
      if (status === 'completed' || status === 'error') {
        updates.push('completed_at = ?')
        values.push(now)
      }
    }

    if (result) {
      updates.push('result = ?')
      values.push(JSON.stringify(result))
    }

    values.push(taskId)

    const stmt = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`)
    const updateResult = stmt.run(...values)

    if (updateResult.changes === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    log.info(`Research task ${taskId} updated: status=${status}`)

    return NextResponse.json({ success: true, updated: updateResult.changes })
  } catch (error) {
    log.error("Failed to update research task")
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}
