import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'
import { getDatabase } from '@/lib/db'
import { logger } from '@/lib/logger'
import path from 'node:path'

interface ExecApprovalRow {
  id: string | number
  session_id?: string | null
  agent_name?: string | null
  tool_name?: string | null
  tool_args?: string | null
  command?: string | null
  cwd?: string | null
  host?: string | null
  resolved_path?: string | null
  risk?: string | null
  created_at?: number | null
  expires_at?: number | null
  status?: string | null
}

function gatewayUrl(p: string): string {
  return `http://${config.gatewayHost}:${config.gatewayPort}${p}`
}

function execApprovalsPath(): string {
  return path.join(config.openclawHome, 'exec-approvals.json')
}

function computeHash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

function tableExists(tableName: string): boolean {
  try {
    const db = getDatabase()
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName) as { name?: string } | undefined
    return Boolean(row?.name)
  } catch {
    return false
  }
}

function parseJsonObject(raw?: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return { raw }
  }
}

function normalizeRisk(risk?: string | null): 'low' | 'medium' | 'high' | 'critical' {
  return risk === 'low' || risk === 'medium' || risk === 'high' || risk === 'critical' ? risk : 'medium'
}

function normalizeStatus(status?: string | null): 'pending' | 'approved' | 'denied' | 'expired' {
  if (status === 'approved' || status === 'denied' || status === 'expired') return status
  return 'pending'
}

function getLocalApprovalReceipts(): any[] {
  if (!tableExists('exec_approval_requests')) return []
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT * FROM exec_approval_requests
    ORDER BY created_at DESC
    LIMIT 200
  `).all() as ExecApprovalRow[]
  return rows.map((row) => ({
    id: String(row.id),
    sessionId: row.session_id || 'local-db',
    agentName: row.agent_name || 'local receipt',
    toolName: row.tool_name || 'approval_required_action',
    toolArgs: parseJsonObject(row.tool_args),
    command: row.command || undefined,
    cwd: row.cwd || undefined,
    host: row.host || undefined,
    resolvedPath: row.resolved_path || undefined,
    risk: normalizeRisk(row.risk),
    createdAt: row.created_at ? Number(row.created_at) * 1000 : Date.now(),
    expiresAt: row.expires_at ? Number(row.expires_at) * 1000 : undefined,
    status: normalizeStatus(row.status),
  }))
}

/**
 * GET /api/exec-approvals - Fetch pending execution approval requests
 * GET /api/exec-approvals?action=allowlist - Fetch per-agent allowlists
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const action = request.nextUrl.searchParams.get('action')

  if (action === 'allowlist') {
    return getAllowlist()
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(gatewayUrl('/api/exec-approvals'), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Gateway exec-approvals endpoint returned error')
      return NextResponse.json({ approvals: getLocalApprovalReceipts(), source: 'local-read-only' })
    }

    const data = await res.json()
    return NextResponse.json({ ...data, source: 'gateway' })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      logger.warn('Gateway exec-approvals request timed out')
    } else {
      logger.warn({ err }, 'Gateway exec-approvals unreachable')
    }
    return NextResponse.json({ approvals: getLocalApprovalReceipts(), source: 'local-read-only' })
  }
}

async function getAllowlist(): Promise<NextResponse> {
  const filePath = execApprovalsPath()
  try {
    const { readFile } = require('fs/promises')
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const agents: Record<string, { pattern: string }[]> = {}
    if (parsed?.agents && typeof parsed.agents === 'object') {
      for (const [agentId, agentConfig] of Object.entries(parsed.agents)) {
        const cfg = agentConfig as any
        if (Array.isArray(cfg?.allowlist)) {
          agents[agentId] = cfg.allowlist.map((e: any) => ({ pattern: String(e?.pattern ?? '') }))
        } else {
          agents[agentId] = []
        }
      }
    }
    return NextResponse.json({ agents, hash: computeHash(raw) })
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({ agents: {}, hash: computeHash('') })
    }
    logger.warn({ err }, 'Failed to read exec-approvals config')
    return NextResponse.json({ error: `Failed to read config: ${err.message}` }, { status: 500 })
  }
}

/**
 * PUT /api/exec-approvals - Save allowlist changes
 * Body: { agents: Record<string, { pattern: string }[]>, hash?: string }
 */
export async function PUT(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { agents: Record<string, { pattern: string }[]>; hash?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.agents || typeof body.agents !== 'object') {
    return NextResponse.json({ error: 'Missing required field: agents' }, { status: 400 })
  }

  const filePath = execApprovalsPath()
  try {
    const { readFile, writeFile, mkdir } = require('fs/promises')
    const { existsSync } = require('fs')

    let parsed: any = { version: 1, agents: {} }
    try {
      const raw = await readFile(filePath, 'utf-8')
      parsed = JSON.parse(raw)

      if (body.hash) {
        const serverHash = computeHash(raw)
        if (body.hash !== serverHash) {
          return NextResponse.json(
            { error: 'Config has been modified. Please reload and try again.', code: 'CONFLICT' },
            { status: 409 },
          )
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err
    }

    if (!parsed.agents) parsed.agents = {}

    for (const [agentId, patterns] of Object.entries(body.agents)) {
      if (!parsed.agents[agentId]) parsed.agents[agentId] = {}
      if (patterns.length === 0) {
        delete parsed.agents[agentId].allowlist
      } else {
        parsed.agents[agentId].allowlist = patterns.map((p: { pattern: string }) => ({
          pattern: String(p.pattern ?? ''),
        }))
      }
    }

    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const newRaw = JSON.stringify(parsed, null, 2) + '\n'
    await writeFile(filePath, newRaw, { mode: 0o600 })

    return NextResponse.json({ ok: true, hash: computeHash(newRaw) })
  } catch (err: any) {
    logger.error({ err }, 'Failed to save exec-approvals config')
    return NextResponse.json({ error: `Failed to save: ${err.message}` }, { status: 500 })
  }
}

/**
 * POST /api/exec-approvals - Respond to an execution approval request
 * Body: { id: string, action: 'approve' | 'deny' | 'always_allow', reason?: string }
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { id: string; action: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
  }

  const validActions = ['approve', 'deny', 'always_allow']
  if (!validActions.includes(body.action)) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(gatewayUrl('/api/exec-approvals/respond'), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: body.id,
        action: body.action,
        reason: body.reason,
      }),
    })
    clearTimeout(timeout)

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      logger.error('Gateway exec-approvals respond request timed out')
      return NextResponse.json({ error: 'Gateway request timed out' }, { status: 504 })
    }
    logger.error({ err }, 'Gateway exec-approvals respond failed')
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 502 })
  }
}
