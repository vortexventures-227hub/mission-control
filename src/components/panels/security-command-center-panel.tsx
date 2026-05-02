'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

type Posture = 'green' | 'watch' | 'blocked' | 'not_instrumented'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type FindingStatus = 'new' | 'triage' | 'accepted_risk' | 'fixing' | 'needs_verification' | 'resolved' | 'superseded'

interface SecuritySystem {
  id: number
  system_key: string
  label: string
  posture: Posture
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

interface SecurityFinding {
  id: number
  system_key: string
  title: string
  severity: Severity
  status: FindingStatus
  owner_agent_id: string
  evidence_path: string | null
  next_action: string
  updated_at: number
}

interface SecuritySnapshot {
  generatedAt: number
  posture: {
    label: Posture
    systems: number
    openFindings: number
    severityCounts: Record<string, number>
    statusCounts: Record<string, number>
  }
  guardrails: string[]
  systems: SecuritySystem[]
  findings: SecurityFinding[]
}

const postureClass: Record<string, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  watch: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
  not_instrumented: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
}

const severityClass: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/15 text-red-200',
  high: 'border-orange-500/40 bg-orange-500/15 text-orange-200',
  medium: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  low: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  info: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-200',
}

function Badge({ value, kind = 'posture' }: { value: string; kind?: 'posture' | 'severity' }) {
  const cls = kind === 'severity' ? severityClass[value] : postureClass[value]
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls || postureClass.watch}`}>{value.replace(/_/g, ' ')}</span>
}

function stamp(value: number | null) {
  if (!value) return 'Not Instrumented Yet'
  return new Date(value * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function SecurityCommandCenterPanel() {
  const [snapshot, setSnapshot] = useState<SecuritySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/mission-control-mvp/security')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load security command center')
      setSnapshot(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openBySeverity = useMemo(() => snapshot?.posture.severityCounts || {}, [snapshot])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="inline" /></div>

  return (
    <div className="space-y-4 p-4 md:p-6">
      <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Security Command Center</div>
            <h1 className="mt-1 text-2xl font-black text-foreground">Posture, findings, proof gates</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Mission Control security visibility for project posture, open findings, missing hooks, accountable owners, evidence paths, and next actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot && <Badge value={snapshot.posture.label} />}
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
            <Link href="/command-truth" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-secondary">Command Truth</Link>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-2xl font-black text-foreground">{snapshot?.posture.systems || 0}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Systems</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-2xl font-black text-foreground">{snapshot?.posture.openFindings || 0}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Open Findings</div>
        </div>
        {(['critical', 'high', 'medium'] as const).map((severity) => (
          <div key={severity} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-black text-foreground">{openBySeverity[severity] || 0}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{severity}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold text-foreground">System posture</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(snapshot?.systems || []).map((system) => (
              <article key={system.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{system.label}</h3>
                    <p className="text-xs text-muted-foreground">@{system.owner_agent_id} accountable</p>
                  </div>
                  <Badge value={system.posture} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <p><span className="text-foreground">Audit:</span> {stamp(system.last_audit_at)}</p>
                  <p><span className="text-foreground">Deps:</span> {stamp(system.last_dependency_scan_at)}</p>
                  <p><span className="text-foreground">Secrets:</span> {stamp(system.last_secret_scan_at)}</p>
                  <p><span className="text-foreground">Auth:</span> {stamp(system.last_auth_review_at)}</p>
                  <p className="col-span-2"><span className="text-foreground">Path drift:</span> {stamp(system.last_path_drift_check_at)}</p>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">{system.next_action}</p>
                {system.evidence_path && <p className="mt-2 break-all text-[11px] text-primary">{system.evidence_path}</p>}
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-bold text-foreground">Evidence guardrails</h2>
            <div className="mt-3 space-y-2">
              {(snapshot?.guardrails || []).map((guardrail) => (
                <div key={guardrail} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">{guardrail}</div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-bold text-foreground">Status gates</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Findings can move through New, Triage, Accepted Risk, Fixing, Needs Verification, Resolved, or Superseded. Resolved rejects without evidence.
            </p>
          </section>
        </aside>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold text-foreground">Findings board</h2>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {(snapshot?.findings || []).map((finding) => (
            <article key={finding.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={finding.severity} kind="severity" />
                <Badge value={finding.status} />
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{finding.system_key}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{finding.title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{finding.next_action}</p>
              <div className="mt-3 text-[11px] text-muted-foreground">Owner: @{finding.owner_agent_id}</div>
              {finding.evidence_path && <p className="mt-2 break-all text-[11px] text-primary">{finding.evidence_path}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
