'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BoundaryBanner, Btn, Chip, DataTable, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Loader } from '@/components/ui/loader'

type Posture = 'green' | 'watch' | 'blocked' | 'not_instrumented'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type FindingStatus = 'new' | 'triage' | 'accepted_risk' | 'fixing' | 'needs_verification' | 'resolved' | 'superseded'

interface SecurityDetail {
  label: string
  value: string
  status?: string
}

interface SecurityAuditHook {
  id: string
  title: string
  status: string
  cadence: string
  trigger: string
  evidence: string
  nextAction: string
  details: SecurityDetail[]
}

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
  details: SecurityDetail[]
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
  details: SecurityDetail[]
}

interface SecuritySnapshot {
  generatedAt: number
  posture: {
    label: Posture
    systems: number
    openFindings: number
    severityCounts: Record<string, number>
    statusCounts: Record<string, number>
    hookCounts?: Record<string, number>
    auditHooks: number
    notInstrumentedHooks: number
    evidenceMissingHooks: number
    approvalRequiredHooks: number
  }
  guardrails: string[]
  auditHooks: SecurityAuditHook[]
  systems: SecuritySystem[]
  findings: SecurityFinding[]
}

function toneFor(value: string): 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim' {
  if (['green', 'resolved', 'low', 'info'].includes(value)) return 'teal'
  if (['critical', 'high', 'blocked'].includes(value)) return 'rose'
  if (['watch', 'medium', 'needs_verification', 'fixing', 'triage'].includes(value)) return 'amber'
  if (['accepted_risk'].includes(value)) return 'purple'
  return 'dim'
}

function Badge({ value, pulse = false }: { value: string; pulse?: boolean }) {
  return <Chip tone={toneFor(value)} pulse={pulse}>{value.replace(/_/g, ' ')}</Chip>
}

function stamp(value: number | null) {
  if (!value) return 'Not Instrumented Yet'
  return new Date(value * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function DetailGrid({ details }: { details: SecurityDetail[] }) {
  if (!details.length) return null
  return (
    <div className="mt-3 grid gap-1.5">
      {details.map((detail) => (
        <div key={detail.label} className="border border-[color:var(--mc-hairline)] bg-black/20 px-2 py-1 font-mono text-[10px] text-[color:var(--mc-ink-2)]">
          <span className="text-[color:var(--mc-ink-0)]">{detail.label}:</span> {detail.value}
        </div>
      ))}
    </div>
  )
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
  const statusCounts = snapshot?.posture.statusCounts || {}

  if (loading) {
    return (
      <Page title="Security Center" kicker="Blackwire Ops / Proof Gates" subtitle="Loading local posture, hooks, findings, and evidence paths.">
        <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="inline" /></div>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Proof Gates"
      title="Security Center"
      subtitle="Local security posture, unresolved findings, missing instrumentation, accountable owners, and evidence paths. No system is promoted to green without receipts."
      badges={
        <>
          {snapshot && <Badge value={snapshot.posture.label} pulse={snapshot.posture.label !== 'green'} />}
          <Chip tone="amber">local only</Chip>
          <Chip tone="dim">writes require audit</Chip>
        </>
      }
      actions={
        <>
          <Btn onClick={load}>Refresh</Btn>
          <Link href="/command-truth"><Btn as="span">Command Truth</Btn></Link>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <BoundaryBanner tone="rose" title="Security snapshot load failed">
            {error}
          </BoundaryBanner>
        )}

        <BoundaryBanner tone="amber" title="No fake green">
          Missing hooks stay Not Instrumented Yet, unresolved findings stay open, and resolved status is rejected unless an evidence path exists.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <Stat label="Systems" value={snapshot?.posture.systems || 0} sub="tracked surfaces" />
          <Stat label="Open Findings" value={snapshot?.posture.openFindings || 0} sub="needs owner proof" accent={(snapshot?.posture.openFindings || 0) > 0 ? 'amber' : 'teal'} glow={(snapshot?.posture.openFindings || 0) > 0} />
          <Stat label="Audit Hooks" value={snapshot?.posture.auditHooks || 0} sub="daily + periodic" />
          <Stat label="Not Instrumented" value={snapshot?.posture.notInstrumentedHooks || 0} sub="cannot be green" accent={(snapshot?.posture.notInstrumentedHooks || 0) > 0 ? 'rose' : 'teal'} glow={(snapshot?.posture.notInstrumentedHooks || 0) > 0} />
          <Stat label="Critical" value={openBySeverity.critical || 0} sub="severity gate" accent={(openBySeverity.critical || 0) > 0 ? 'rose' : 'teal'} glow={(openBySeverity.critical || 0) > 0} />
          <Stat label="High" value={openBySeverity.high || 0} sub="launch blocker" accent={(openBySeverity.high || 0) > 0 ? 'rose' : 'teal'} glow={(openBySeverity.high || 0) > 0} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <HudPanel
            kicker="posture matrix"
            title="System accountability"
            right={<Chip tone="dim">{snapshot?.systems.length || 0} rows</Chip>}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {(snapshot?.systems || []).map((system) => (
                <article key={system.id} className="mc-bevel relative overflow-hidden p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-mono text-sm font-black uppercase tracking-[0.12em] text-[color:var(--mc-ink-0)]">{system.label}</h3>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">@{system.owner_agent_id} accountable</p>
                    </div>
                    <Badge value={system.posture} pulse={system.posture === 'blocked' || system.posture === 'not_instrumented'} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-[color:var(--mc-ink-2)]">
                    <p><span className="text-[color:var(--mc-ink-0)]">Audit:</span> {stamp(system.last_audit_at)}</p>
                    <p><span className="text-[color:var(--mc-ink-0)]">Deps:</span> {stamp(system.last_dependency_scan_at)}</p>
                    <p><span className="text-[color:var(--mc-ink-0)]">Secrets:</span> {stamp(system.last_secret_scan_at)}</p>
                    <p><span className="text-[color:var(--mc-ink-0)]">Auth:</span> {stamp(system.last_auth_review_at)}</p>
                    <p className="col-span-2"><span className="text-[color:var(--mc-ink-0)]">Path drift:</span> {stamp(system.last_path_drift_check_at)}</p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[color:var(--mc-ink-1)]">{system.next_action}</p>
                  {system.evidence_path && <p className="mt-2 break-all font-mono text-[10px] text-[color:var(--mc-teal)]">{system.evidence_path}</p>}
                  <DetailGrid details={system.details} />
                </article>
              ))}
            </div>
          </HudPanel>

          <aside className="space-y-4">
            <HudPanel kicker="guardrails" title="Evidence policy" glow>
              <div className="space-y-2">
                {(snapshot?.guardrails || []).map((guardrail) => (
                  <div key={guardrail} className="border border-[color:var(--mc-hairline)] bg-black/20 px-3 py-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">{guardrail}</div>
                ))}
              </div>
            </HudPanel>

            <HudPanel kicker="status gates" title="Finding states">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="border border-[color:var(--mc-hairline)] bg-black/20 px-2 py-2">
                    <div className="font-mono text-lg font-black text-[color:var(--mc-ink-0)]">{count}</div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--mc-ink-2)]">{status.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[color:var(--mc-ink-1)]">Resolved and verified states require an evidence path. Accepted risk stays visible, not greenwashed.</p>
            </HudPanel>
          </aside>
        </section>

        <HudPanel
          kicker="audit hooks"
          title="Daily / periodic instrumentation"
          right={<Chip tone={(snapshot?.posture.notInstrumentedHooks || 0) > 0 ? 'rose' : 'teal'}>{snapshot?.posture.notInstrumentedHooks || 0} not instrumented</Chip>}
        >
          <div className="grid gap-3 xl:grid-cols-3">
            {(snapshot?.auditHooks || []).map((hook) => (
              <article key={hook.id} className="mc-bevel relative overflow-hidden p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={hook.status} pulse={hook.status !== 'green'} />
                  <Chip tone="dim">{hook.cadence.replace(/_/g, ' ')}</Chip>
                </div>
                <h3 className="mt-3 font-mono text-sm font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{hook.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">Trigger: {hook.trigger}</p>
                <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">{hook.evidence}</p>
                <p className="mt-2 font-mono text-[10px] text-[color:var(--mc-teal)]">{hook.nextAction}</p>
                <DetailGrid details={hook.details} />
              </article>
            ))}
          </div>
        </HudPanel>

        <HudPanel
          kicker="findings board"
          title="Open evidence lanes"
          right={<Chip tone={(snapshot?.findings.length || 0) > 0 ? 'amber' : 'teal'}>{snapshot?.findings.length || 0} findings</Chip>}
          padded={false}
        >
          <DataTable
            rows={(snapshot?.findings || []) as unknown as Array<Record<string, unknown>>}
            columns={[
              {
                key: 'severity',
                label: 'Severity',
                width: '120px',
                render: (finding) => <Badge value={String(finding.severity)} pulse={['critical', 'high'].includes(String(finding.severity))} />,
              },
              { key: 'status', label: 'Status', width: '160px', render: (finding) => <Badge value={String(finding.status)} /> },
              { key: 'system_key', label: 'System', width: '150px', mute: true },
              {
                key: 'title',
                label: 'Finding',
                render: (finding) => (
                  <div>
                    <div className="text-[color:var(--mc-ink-0)]">{String(finding.title)}</div>
                    <div className="mt-1 text-[color:var(--mc-ink-2)]">{String(finding.next_action)}</div>
                  </div>
                ),
              },
              { key: 'owner_agent_id', label: 'Owner', width: '110px', render: (finding) => `@${String(finding.owner_agent_id)}` },
              {
                key: 'evidence_path',
                label: 'Evidence',
                width: '260px',
                render: (finding) => {
                  const path = String(finding.evidence_path || '')
                  return path ? <span className="break-all text-[color:var(--mc-teal)]">{path}</span> : <Chip tone="rose">needs evidence</Chip>
                },
              },
            ]}
          />
        </HudPanel>
      </div>
    </Page>
  )
}
