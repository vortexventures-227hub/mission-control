"use client"

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'

type MarketingStatus = 'live' | 'planned' | 'not_instrumented' | 'approval_required' | 'blocked' | string

interface MarketingSnapshot {
  status: string
  summary: Record<string, number | boolean>
  principles: Array<{ id: string; title: string; category: string; status: MarketingStatus; guidance: string; ethicalBoundary: string }>
  playbooks: Array<{ id: string; channel: string; status: MarketingStatus; goal: string; guardrail: string; nextAction: string }>
  tools: Array<{ id: string; name: string; category: string; status: string; safetyNote: string }>
  templates: Array<{ id: string; title: string; kind: string; status: MarketingStatus; useCase: string }>
  experiments: Array<{ id: string; project: string; hypothesis: string; channel: string; status: MarketingStatus; successMetric: string; evidence: string; approvalRequired: boolean }>
  projectProfiles: Array<{ id: string; project: string; offer: string; audience: string; status: MarketingStatus; analyticsStatus: string; approvalsRequired: string[]; nextAction: string; proofStatus: string; safeDraftsReady: number; tabs: Array<{ id: string; label: string; status: MarketingStatus; detail: string; evidence: string }> }>
  launchSecurityGate: { id: string; title: string; status: MarketingStatus; reason: string; evidence: string; nextAction: string; requiredApproval: string; securityPosture: string; openFindings: number; criticalFindings: number; highFindings: number }
  externalActionGuardrails: string[]
}

const statusTone: Record<string, 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim'> = {
  live: 'teal',
  planned: 'neutral',
  not_instrumented: 'dim',
  approval_required: 'amber',
  blocked: 'rose',
  evidence_missing: 'amber',
  installed: 'teal',
  staged: 'purple',
  researched: 'neutral',
  approved: 'teal',
  not_adopted: 'dim',
  unsafe: 'rose',
}

function StatusBadge({ status }: { status: string }) {
  return <Chip tone={statusTone[status] || 'neutral'}>{status.replace(/_/g, ' ')}</Chip>
}

function summaryNumber(snapshot: MarketingSnapshot | null, key: string) {
  const value = snapshot?.summary[key]
  return typeof value === 'number' ? value : 0
}

function summaryBoolean(snapshot: MarketingSnapshot | null, key: string) {
  return snapshot?.summary[key] === true
}

function PanelCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <HudPanel title={title} right={action}>
      {children}
    </HudPanel>
  )
}

function SurfacePane({ children }: { children: ReactNode }) {
  return <div className="border border-[color:var(--mc-hairline)] bg-black/20 p-3">{children}</div>
}

const actionButtonClass = 'mc-btn-glitch border border-[color:var(--mc-hairline-2)] bg-white/[0.04] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--mc-ink-1)] transition-colors hover:border-[color:var(--mc-teal)]/55 hover:text-[color:var(--mc-teal-soft)]'

export function MarketingCommandCenterPanel() {
  const [snapshot, setSnapshot] = useState<MarketingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/marketing-command-center')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load Marketing Command Center')
      setSnapshot(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <Page
        kicker="Blackwire Ops / Marketing"
        title="Marketing"
        subtitle="Loading draft-only marketing command data."
        badges={<Chip tone="amber" pulse>loading</Chip>}
      >
        <HudPanel title="Loading Marketing Command Center" glow>
          <div className="h-40 animate-pulse border border-[color:var(--mc-hairline)] bg-black/20" />
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Marketing"
      title="Marketing"
      subtitle="Vortex marketing operating system for psychology, funnels, channels, tools, templates, campaigns, and per-project draft readiness. External sends, posts, spend, and public launches remain approval-gated."
      badges={
        <>
          <StatusBadge status={snapshot?.status || 'planned'} />
          <Chip tone="amber">draft-only</Chip>
          <Chip tone="rose">external sends blocked</Chip>
          <Chip tone="purple">viewer-auth</Chip>
        </>
      }
      actions={<button type="button" className={actionButtonClass} onClick={load}>refresh</button>}
    >
      <div className="space-y-4">
        <BoundaryBanner tone="rose" title="Marketing execution boundary">
          This page is a planning and draft command surface. Email, SMS, social posting, marketplace changes, ads, campaign settings, public launch, and spend are blocked until scoped human approval exists.
        </BoundaryBanner>

        {error && (
          <BoundaryBanner tone="rose" title="Marketing snapshot failed">
            {error}
          </BoundaryBanner>
        )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {snapshot && Object.entries(snapshot.summary).map(([key, value]) => (
          <Stat key={key} label={key.replace(/([A-Z])/g, ' $1')} value={typeof value === 'boolean' ? (value ? 'YES' : 'NO') : value} accent={typeof value === 'boolean' ? (value ? 'teal' : 'amber') : 'neutral'} />
        ))}
      </div>

      <PanelCard title="Daily marketing triage" action={<StatusBadge status={summaryBoolean(snapshot, 'publicLaunchBlocked') ? 'blocked' : 'approval_required'} />}>
        <div className="grid gap-3 lg:grid-cols-2">
          <SurfacePane>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">Draft readiness</h3>
              <StatusBadge status={summaryNumber(snapshot, 'projectsWithEvidenceMissing') > 0 ? 'evidence_missing' : 'planned'} />
            </div>
            <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">
              {summaryNumber(snapshot, 'safeDraftsReady')} safe internal drafts across {summaryNumber(snapshot, 'projectProfiles')} project profiles; {summaryNumber(snapshot, 'projectsWithEvidenceMissing')} projects still need proof or instrumentation.
            </p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--mc-amber)]">
              Analytics live is not implied by draft readiness. Missing analytics must remain Not Instrumented Yet.
            </p>
          </SurfacePane>
          <SurfacePane>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">External action boundary</h3>
              <StatusBadge status="approval_required" />
            </div>
            <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">
              Email, SMS, social, marketplace, ads, campaign settings, public launch, and spend all require scoped approval before execution.
            </p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--mc-teal-soft)]">
              Next: create an approval packet with channel, audience, spend/send/post scope, blast radius, proof plan, and rollback/stop plan.
            </p>
          </SurfacePane>
        </div>
      </PanelCard>

      <PanelCard title="External action guardrails" action={<StatusBadge status="approval_required" />}>
        <div className="grid gap-2 md:grid-cols-2">
          {(snapshot?.externalActionGuardrails || []).map((guardrail) => <div key={guardrail} className="border border-[color:var(--mc-amber)]/35 bg-[rgba(245,165,36,0.08)] p-3 text-sm leading-5 text-[color:var(--mc-amber)]">{guardrail}</div>)}
        </div>
      </PanelCard>

      {snapshot?.launchSecurityGate && (
        <PanelCard title="Security Command Center launch gate" action={<StatusBadge status={snapshot.launchSecurityGate.status} />}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <SurfacePane>
              <h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">{snapshot.launchSecurityGate.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">{snapshot.launchSecurityGate.reason}</p>
              <p className="mt-2 text-xs leading-5 text-[color:var(--mc-amber)]">Evidence: {snapshot.launchSecurityGate.evidence}</p>
              <p className="mt-2 text-xs leading-5 text-[color:var(--mc-teal-soft)]">Next: {snapshot.launchSecurityGate.nextAction}</p>
              <p className="mt-2 text-[11px] leading-5 text-[color:var(--mc-ink-2)]">Approval: {snapshot.launchSecurityGate.requiredApproval}</p>
            </SurfacePane>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              <Stat label="Security posture" value={<span className="text-base">{snapshot.launchSecurityGate.securityPosture.replace(/_/g, ' ')}</span>} accent="amber" />
              <Stat label="Open findings" value={snapshot.launchSecurityGate.openFindings} accent={snapshot.launchSecurityGate.openFindings > 0 ? 'amber' : 'teal'} />
              <Stat label="Critical / high" value={`${snapshot.launchSecurityGate.criticalFindings}/${snapshot.launchSecurityGate.highFindings}`} accent={snapshot.launchSecurityGate.criticalFindings > 0 ? 'rose' : 'amber'} />
            </div>
          </div>
        </PanelCard>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PanelCard title="Psychology & persuasion library">
          <div className="grid gap-3 md:grid-cols-2">
            {(snapshot?.principles || []).map((principle) => (
              <article key={principle.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">{principle.title}</h3><StatusBadge status={principle.status} /></div>
                <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">{principle.guidance}</p>
                <p className="mt-2 text-[11px] leading-5 text-[color:var(--mc-amber)]">Boundary: {principle.ethicalBoundary}</p>
              </article>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Funnel & channel playbooks">
          <div className="space-y-3">
            {(snapshot?.playbooks || []).map((playbook) => (
              <article key={playbook.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">{playbook.channel}</h3><StatusBadge status={playbook.status} /></div>
                <p className="mt-2 text-xs text-[color:var(--mc-ink-2)]">Goal: {playbook.goal}</p>
                <p className="mt-1 text-xs text-[color:var(--mc-amber)]">Guardrail: {playbook.guardrail}</p>
                <p className="mt-1 text-xs text-[color:var(--mc-teal-soft)]">Next: {playbook.nextAction}</p>
              </article>
            ))}
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PanelCard title="Tools / skills / plugins inventory">
          <div className="space-y-2">{(snapshot?.tools || []).map((tool) => <div key={tool.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-[color:var(--mc-ink-0)]">{tool.name}</span><StatusBadge status={tool.status} /></div><p className="mt-1 text-[color:var(--mc-ink-2)]">{tool.category} / {tool.safetyNote}</p></div>)}</div>
        </PanelCard>

        <PanelCard title="Templates / swipe library">
          <div className="space-y-2">{(snapshot?.templates || []).map((template) => <div key={template.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-[color:var(--mc-ink-0)]">{template.title}</span><StatusBadge status={template.status} /></div><p className="mt-1 text-[color:var(--mc-ink-2)]">{template.kind} / {template.useCase}</p></div>)}</div>
        </PanelCard>

        <PanelCard title="Campaign / experiment board">
          <div className="space-y-2">{(snapshot?.experiments || []).map((experiment) => <div key={experiment.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-[color:var(--mc-ink-0)]">{experiment.project}</span><StatusBadge status={experiment.status} /></div><p className="mt-1 text-[color:var(--mc-ink-2)]">{experiment.hypothesis}</p><p className="mt-1 text-[color:var(--mc-teal-soft)]">Metric: {experiment.successMetric}</p><p className="mt-1 text-[color:var(--mc-amber)]">{experiment.evidence}</p></div>)}</div>
        </PanelCard>
      </div>

      <PanelCard title="Per-project Marketing tabs">
        <div className="grid gap-3 lg:grid-cols-3">
          {(snapshot?.projectProfiles || []).map((profile) => (
            <article key={profile.id} className="border border-[color:var(--mc-hairline)] bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-[color:var(--mc-ink-0)]">{profile.project}</h3><StatusBadge status={profile.status} /></div>
              <p className="mt-2 text-xs text-[color:var(--mc-ink-2)]"><span className="font-semibold text-[color:var(--mc-ink-0)]">Offer:</span> {profile.offer}</p>
              <p className="mt-1 text-xs text-[color:var(--mc-ink-2)]"><span className="font-semibold text-[color:var(--mc-ink-0)]">Audience:</span> {profile.audience}</p>
              <p className="mt-1 text-xs text-[color:var(--mc-ink-2)]">Analytics: {profile.analyticsStatus} / Proof: {profile.proofStatus} / Safe drafts: {profile.safeDraftsReady}</p>
              <p className="mt-1 text-xs text-[color:var(--mc-amber)]">Approvals: {profile.approvalsRequired.join(', ') || 'None'}</p>
              <p className="mt-1 text-xs text-[color:var(--mc-teal-soft)]">Next: {profile.nextAction}</p>
              <div className="mt-3 space-y-2">
                {profile.tabs.map((tab) => (
                  <div key={tab.id} className="border border-[color:var(--mc-hairline)] bg-white/[0.03] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--mc-ink-0)]">{tab.label}</div>
                      <StatusBadge status={tab.status} />
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[color:var(--mc-ink-2)]">{tab.detail}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[color:var(--mc-amber)]">{tab.evidence}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </PanelCard>
      </div>
    </Page>
  )
}
