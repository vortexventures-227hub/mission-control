"use client"

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

type MarketingStatus = 'live' | 'planned' | 'not_instrumented' | 'approval_required' | 'blocked' | string

interface MarketingSnapshot {
  status: string
  summary: Record<string, number | boolean>
  principles: Array<{ id: string; title: string; category: string; status: MarketingStatus; guidance: string; ethicalBoundary: string }>
  playbooks: Array<{ id: string; channel: string; status: MarketingStatus; goal: string; guardrail: string; nextAction: string }>
  tools: Array<{ id: string; name: string; category: string; status: string; safetyNote: string }>
  templates: Array<{ id: string; title: string; kind: string; status: MarketingStatus; useCase: string }>
  experiments: Array<{ id: string; project: string; hypothesis: string; channel: string; status: MarketingStatus; successMetric: string; evidence: string; approvalRequired: boolean }>
  projectProfiles: Array<{ id: string; project: string; offer: string; audience: string; status: MarketingStatus; analyticsStatus: string; approvalsRequired: string[]; nextAction: string }>
  externalActionGuardrails: string[]
}

const badgeClass: Record<string, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  not_instrumented: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  approval_required: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
  installed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  staged: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  researched: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  not_adopted: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  unsafe: 'border-red-500/30 bg-red-500/10 text-red-300',
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass[status] || badgeClass.planned}`}>{status.replace(/_/g, ' ')}</span>
}

function PanelCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="inline" /></div>

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Marketing Command Center</div>
            <h1 className="mt-1 text-2xl font-black text-foreground">Vortex marketing operating system</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Global psychology, persuasion, funnel, channel, tool, template, campaign, and per-project marketing surface. External sends/posts/spend remain approval-gated; missing analytics stays labeled Not Instrumented Yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={snapshot?.status || 'planned'} />
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {snapshot && Object.entries(snapshot.summary).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-black text-foreground">{typeof value === 'boolean' ? (value ? 'YES' : 'NO') : value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</div>
          </div>
        ))}
      </div>

      <PanelCard title="External action guardrails" action={<StatusBadge status="approval_required" />}>
        <div className="grid gap-2 md:grid-cols-2">
          {(snapshot?.externalActionGuardrails || []).map((guardrail) => <div key={guardrail} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">{guardrail}</div>)}
        </div>
      </PanelCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PanelCard title="Psychology & persuasion library">
          <div className="grid gap-3 md:grid-cols-2">
            {(snapshot?.principles || []).map((principle) => (
              <article key={principle.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{principle.title}</h3><StatusBadge status={principle.status} /></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{principle.guidance}</p>
                <p className="mt-2 text-[11px] leading-5 text-amber-200">Boundary: {principle.ethicalBoundary}</p>
              </article>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Funnel & channel playbooks">
          <div className="space-y-3">
            {(snapshot?.playbooks || []).map((playbook) => (
              <article key={playbook.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{playbook.channel}</h3><StatusBadge status={playbook.status} /></div>
                <p className="mt-2 text-xs text-muted-foreground">Goal: {playbook.goal}</p>
                <p className="mt-1 text-xs text-amber-200">Guardrail: {playbook.guardrail}</p>
                <p className="mt-1 text-xs text-primary">Next: {playbook.nextAction}</p>
              </article>
            ))}
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PanelCard title="Tools / skills / plugins inventory">
          <div className="space-y-2">{(snapshot?.tools || []).map((tool) => <div key={tool.id} className="rounded-lg border border-border bg-background p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{tool.name}</span><StatusBadge status={tool.status} /></div><p className="mt-1 text-muted-foreground">{tool.category} · {tool.safetyNote}</p></div>)}</div>
        </PanelCard>

        <PanelCard title="Templates / swipe library">
          <div className="space-y-2">{(snapshot?.templates || []).map((template) => <div key={template.id} className="rounded-lg border border-border bg-background p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{template.title}</span><StatusBadge status={template.status} /></div><p className="mt-1 text-muted-foreground">{template.kind} · {template.useCase}</p></div>)}</div>
        </PanelCard>

        <PanelCard title="Campaign / experiment board">
          <div className="space-y-2">{(snapshot?.experiments || []).map((experiment) => <div key={experiment.id} className="rounded-lg border border-border bg-background p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{experiment.project}</span><StatusBadge status={experiment.status} /></div><p className="mt-1 text-muted-foreground">{experiment.hypothesis}</p><p className="mt-1 text-primary">Metric: {experiment.successMetric}</p><p className="mt-1 text-amber-200">{experiment.evidence}</p></div>)}</div>
        </PanelCard>
      </div>

      <PanelCard title="Per-project Marketing tabs">
        <div className="grid gap-3 lg:grid-cols-3">
          {(snapshot?.projectProfiles || []).map((profile) => (
            <article key={profile.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{profile.project}</h3><StatusBadge status={profile.status} /></div>
              <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Offer:</span> {profile.offer}</p>
              <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Audience:</span> {profile.audience}</p>
              <p className="mt-1 text-xs text-zinc-300">Analytics: {profile.analyticsStatus}</p>
              <p className="mt-1 text-xs text-amber-200">Approvals: {profile.approvalsRequired.join(', ') || 'None'}</p>
              <p className="mt-1 text-xs text-primary">Next: {profile.nextAction}</p>
            </article>
          ))}
        </div>
      </PanelCard>
    </div>
  )
}
