import { getDatabase } from './db'

export type SecurityPosture = 'green' | 'watch' | 'blocked' | 'not_instrumented'
export type SecurityFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type SecurityFindingStatus = 'new' | 'triage' | 'accepted_risk' | 'fixing' | 'needs_verification' | 'resolved' | 'superseded'

export interface SecuritySystem {
  id: number
  workspace_id: number
  system_key: string
  label: string
  posture: SecurityPosture
  owner_agent_id: string
  last_audit_at: number | null
  last_dependency_scan_at: number | null
  last_secret_scan_at: number | null
  last_auth_review_at: number | null
  last_path_drift_check_at: number | null
  evidence_path: string | null
  next_action: string
  open_findings: number
  critical_findings: number
  high_findings: number
}

export interface SecurityFinding {
  id: number
  workspace_id: number
  system_key: string
  title: string
  severity: SecurityFindingSeverity
  status: SecurityFindingStatus
  owner_agent_id: string
  evidence_path: string | null
  next_action: string
  created_at: number
  updated_at: number
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listSecuritySystems(workspaceId = 1): SecuritySystem[] {
  const db = getDatabase()
  const systems = db.prepare(`
    SELECT * FROM mission_control_security_systems
    WHERE workspace_id = ?
    ORDER BY
      CASE posture
        WHEN 'blocked' THEN 0
        WHEN 'watch' THEN 1
        WHEN 'not_instrumented' THEN 2
        ELSE 3
      END,
      label
  `).all(workspaceId) as Array<Omit<SecuritySystem, 'open_findings' | 'critical_findings' | 'high_findings'>>

  return systems.map((system) => ({
    ...system,
    open_findings: countBy(
      `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND status NOT IN ('resolved', 'superseded')`,
      workspaceId,
      system.system_key
    ),
    critical_findings: countBy(
      `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND severity = 'critical' AND status NOT IN ('resolved', 'superseded')`,
      workspaceId,
      system.system_key
    ),
    high_findings: countBy(
      `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND severity = 'high' AND status NOT IN ('resolved', 'superseded')`,
      workspaceId,
      system.system_key
    ),
  }))
}

export function listSecurityFindings(workspaceId = 1): SecurityFinding[] {
  return getDatabase().prepare(`
    SELECT * FROM mission_control_security_findings
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'new' THEN 0
        WHEN 'triage' THEN 1
        WHEN 'fixing' THEN 2
        WHEN 'needs_verification' THEN 3
        WHEN 'accepted_risk' THEN 4
        WHEN 'resolved' THEN 5
        ELSE 6
      END,
      CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END,
      updated_at DESC
  `).all(workspaceId) as SecurityFinding[]
}

export function getSecurityCommandSnapshot(workspaceId = 1) {
  const systems = listSecuritySystems(workspaceId)
  const findings = listSecurityFindings(workspaceId)
  const openFindings = findings.filter((finding) => !['resolved', 'superseded'].includes(finding.status))
  const severityCounts = findings.reduce<Record<string, number>>((acc, finding) => {
    if (!['resolved', 'superseded'].includes(finding.status)) {
      acc[finding.severity] = (acc[finding.severity] || 0) + 1
    }
    return acc
  }, {})
  const statusCounts = findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.status] = (acc[finding.status] || 0) + 1
    return acc
  }, {})

  return {
    generatedAt: Date.now(),
    posture: {
      label: systems.some((system) => system.posture === 'blocked') ? 'blocked' : systems.some((system) => system.posture === 'watch') ? 'watch' : 'green',
      systems: systems.length,
      openFindings: openFindings.length,
      severityCounts,
      statusCounts,
    },
    guardrails: [
      'Resolved/green requires evidence_path.',
      'Missing hooks must say Not Instrumented Yet.',
      'No secrets appear in findings, receipts, logs, or UI.',
      'Port/process takeover requires owner approval when outside the approved path family.',
    ],
    systems,
    findings,
  }
}

export function updateSecurityFindingStatus(input: {
  id: number
  workspaceId?: number
  status: SecurityFindingStatus
  evidencePath?: string
}) {
  const workspaceId = input.workspaceId || 1
  if (input.status === 'resolved' && !input.evidencePath?.trim()) {
    throw new Error('Security findings cannot be resolved without evidence_path.')
  }
  const result = getDatabase().prepare(`
    UPDATE mission_control_security_findings
    SET status = ?, evidence_path = COALESCE(NULLIF(?, ''), evidence_path), updated_at = unixepoch()
    WHERE workspace_id = ? AND id = ?
  `).run(input.status, input.evidencePath || '', workspaceId, input.id)

  if (result.changes === 0) throw new Error('Security finding not found.')
}
