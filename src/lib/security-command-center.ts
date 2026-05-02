import { getDatabase } from './db'

export type SecurityPosture = 'green' | 'watch' | 'blocked' | 'not_instrumented'
export type SecurityFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type SecurityFindingStatus = 'new' | 'triage' | 'accepted_risk' | 'fixing' | 'needs_verification' | 'resolved' | 'superseded'
export type SecurityHookStatus = 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'blocked'

export interface SecurityDetail {
  label: string
  value: string
  status: SecurityHookStatus
}

export interface SecurityAuditHook {
  id: string
  title: string
  status: SecurityHookStatus
  cadence: 'daily' | 'weekly' | 'event_driven'
  trigger: string
  evidence: string
  nextAction: string
  details: SecurityDetail[]
}

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
  details: SecurityDetail[]
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
  details: SecurityDetail[]
}

function securitySystemDetails(system: Omit<SecuritySystem, 'open_findings' | 'critical_findings' | 'high_findings' | 'details'>, counts: { open: number; critical: number; high: number }): SecurityDetail[] {
  return [
    {
      label: 'Daily audit gate',
      value: system.last_audit_at ? `Last audit receipt timestamp is present; evidence path: ${system.evidence_path || 'Evidence Missing'}.` : 'Not Instrumented Yet: no daily audit receipt timestamp is linked.',
      status: system.last_audit_at && system.evidence_path ? 'read_only' : 'not_instrumented',
    },
    {
      label: 'Secret/dependency scan gate',
      value: system.last_secret_scan_at && system.last_dependency_scan_at ? 'Secret and dependency scan timestamps are present.' : 'Evidence Missing: secret/dependency scan receipts are not both attached.',
      status: system.last_secret_scan_at && system.last_dependency_scan_at ? 'read_only' : 'evidence_missing',
    },
    {
      label: 'Auth/path drift gate',
      value: system.last_auth_review_at && system.last_path_drift_check_at ? 'Auth boundary and canonical path drift checks have timestamps.' : 'Not Instrumented Yet: auth boundary or path drift proof is incomplete.',
      status: system.last_auth_review_at && system.last_path_drift_check_at ? 'read_only' : 'not_instrumented',
    },
    {
      label: 'Finding pressure',
      value: `${counts.open} open finding(s), including ${counts.critical} critical and ${counts.high} high.`,
      status: counts.critical > 0 || counts.high > 0 ? 'blocked' : counts.open > 0 ? 'evidence_missing' : 'read_only',
    },
  ]
}

function securityFindingDetails(finding: Omit<SecurityFinding, 'details'>): SecurityDetail[] {
  return [
    {
      label: 'Evidence requirement',
      value: finding.evidence_path ? `Receipt attached: ${finding.evidence_path}` : 'Evidence Missing: finding cannot resolve or support a green claim without a receipt.',
      status: finding.evidence_path ? 'read_only' : 'evidence_missing',
    },
    {
      label: 'Approval / remediation gate',
      value: finding.severity === 'critical' || finding.severity === 'high' ? 'High-risk remediation may require Chris approval when it touches prod, env, credentials, deploys, or destructive cleanup.' : 'Safe local investigation/remediation can proceed; side effects remain approval-gated.',
      status: finding.severity === 'critical' || finding.severity === 'high' ? 'approval_required' : 'read_only',
    },
    {
      label: 'False-green boundary',
      value: finding.status === 'resolved' ? 'Resolved status is only allowed with evidence_path.' : 'Not green: unresolved findings stay visible on the board until verification evidence is attached.',
      status: finding.status === 'resolved' ? 'read_only' : 'evidence_missing',
    },
  ]
}

export const securityAuditHooks: SecurityAuditHook[] = [
  {
    id: 'secret-scan',
    title: 'Secret scan hook',
    status: 'evidence_missing',
    cadence: 'daily',
    trigger: 'new code change / daily audit',
    evidence: 'Evidence Missing: no redacted secret-scan receipt is linked in Mission Control yet.',
    nextAction: 'Attach a redacted scan receipt before any security green claim.',
    details: [
      { label: 'Secret boundary', value: 'Never print raw secrets, .env values, cookies, private certs, or API keys in UI/receipts.', status: 'blocked' },
      { label: 'Result gate', value: 'Tracked secret-like material creates a Critical finding and rotation recommendation.', status: 'approval_required' },
    ],
  },
  {
    id: 'dependency-vulnerability',
    title: 'Dependency vulnerability hook',
    status: 'not_instrumented',
    cadence: 'daily',
    trigger: 'new dependency / daily audit',
    evidence: 'Not Instrumented Yet: pnpm/npm/pip audit receipts are not connected to this surface.',
    nextAction: 'Wire redacted dependency receipts and create actionable finding cards for real issues.',
    details: [
      { label: 'Scope', value: 'Node and Python scanners may report baseline/pre-existing findings separately from new regressions.', status: 'not_instrumented' },
    ],
  },
  {
    id: 'auth-approval-boundary',
    title: 'Auth and approval bypass hook',
    status: 'not_instrumented',
    cadence: 'daily',
    trigger: 'protected API / Tier 2 action',
    evidence: 'Not Instrumented Yet: protected route and approval-bypass probes are not attached here.',
    nextAction: 'Spot-check approvals, group chat mutation, assignments, receipts, and security findings before green.',
    details: [
      { label: 'Tier 2 boundary', value: 'Deploys/env/customer email/David restart/production mutation remain blocked without approval object.', status: 'approval_required' },
    ],
  },
  {
    id: 'public-endpoint-smoke',
    title: 'Public endpoint smoke hook',
    status: 'not_instrumented',
    cadence: 'daily',
    trigger: 'deployment/live proof',
    evidence: 'Not Instrumented Yet: no public smoke receipt is linked.',
    nextAction: 'Attach safe responses and no-secret/no-stack-trace evidence before public green.',
    details: [
      { label: 'Dangerous methods', value: 'Dangerous methods must reject unless authorized.', status: 'blocked' },
    ],
  },
  {
    id: 'repo-path-drift',
    title: 'Repo/path drift hook',
    status: 'read_only',
    cadence: 'daily',
    trigger: 'new worktree / before Done claim',
    evidence: 'Canonical repo path is checked by cron before this slice; drift creates a blocker finding.',
    nextAction: 'Keep Mission Control work in the canonical VVMissionControlOps/mission-control repo.',
    details: [
      { label: 'Canonical root', value: '/Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps/mission-control', status: 'read_only' },
    ],
  },
  {
    id: 'false-green-security-status',
    title: 'False-green security status hook',
    status: 'evidence_missing',
    cadence: 'event_driven',
    trigger: 'agent says Done/security green',
    evidence: 'Evidence Missing unless scan/auth/path/approval receipts are attached to the claim.',
    nextAction: 'Downgrade unsupported green claims to Needs Verification.',
    details: [
      { label: 'Done boundary', value: 'Green requires concrete receipt-backed scan evidence; screenshots/button-clicks alone are not enough.', status: 'blocked' },
    ],
  },
]

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

  return systems.map((system) => {
    const counts = {
      open: countBy(
        `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND status NOT IN ('resolved', 'superseded')`,
        workspaceId,
        system.system_key
      ),
      critical: countBy(
        `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND severity = 'critical' AND status NOT IN ('resolved', 'superseded')`,
        workspaceId,
        system.system_key
      ),
      high: countBy(
        `SELECT COUNT(*) as count FROM mission_control_security_findings WHERE workspace_id = ? AND system_key = ? AND severity = 'high' AND status NOT IN ('resolved', 'superseded')`,
        workspaceId,
        system.system_key
      ),
    }
    return {
      ...system,
      open_findings: counts.open,
      critical_findings: counts.critical,
      high_findings: counts.high,
      details: securitySystemDetails(system, counts),
    }
  })
}

export function listSecurityFindings(workspaceId = 1): SecurityFinding[] {
  const findings = getDatabase().prepare(`
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
  `).all(workspaceId) as Array<Omit<SecurityFinding, 'details'>>

  return findings.map((finding) => ({
    ...finding,
    details: securityFindingDetails(finding),
  })) as SecurityFinding[]
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
  const hookCounts = securityAuditHooks.reduce<Record<string, number>>((acc, hook) => {
    acc[hook.status] = (acc[hook.status] || 0) + 1
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
      hookCounts,
      auditHooks: securityAuditHooks.length,
      notInstrumentedHooks: hookCounts.not_instrumented || 0,
      evidenceMissingHooks: hookCounts.evidence_missing || 0,
      approvalRequiredHooks: hookCounts.approval_required || 0,
    },
    guardrails: [
      'Resolved/green requires evidence_path.',
      'Missing hooks must say Not Instrumented Yet.',
      'No secrets appear in findings, receipts, logs, or UI.',
      'Port/process takeover requires owner approval when outside the approved path family.',
    ],
    auditHooks: securityAuditHooks,
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
