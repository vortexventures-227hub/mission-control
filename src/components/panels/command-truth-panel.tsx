'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

type SurfaceStatus = 'live' | 'partial' | 'not_instrumented' | 'isolated'

interface Surface {
  id: string
  label: string
  status: SurfaceStatus
  detail: string
  href?: string
}

interface EvidenceRow {
  id: string
  label: string
  status: SurfaceStatus | 'manual' | 'evidence_missing'
  sourcePath: string
  lastChecked: number | null
  evidence: string
}

interface TruthGate {
  id: string
  label: string
  status: 'approval_required' | 'not_instrumented' | 'blocked' | 'evidence_missing' | 'read_only'
  detail: string
  blockedAction: string
  evidence: string
  href?: string
}

interface BlackwireDoneGate {
  id: string
  label: string
  status: 'read_only' | 'approval_required' | 'evidence_missing' | 'blocked'
  detail: string
  requiredEvidence: string
  source: string
  href?: string
}

interface CommandTruthRouteEntry {
  id: string
  path: string
  surface: string
  status: 'live' | 'read_only' | 'alias' | 'evidence_missing'
  requirement: string
  evidence: string
  noFakeGreenBoundary: string
}

interface CommandTruthRouteContract {
  generatedAt: number
  canonicalPath: string
  runbook: string
  localMvpBoundary: string
  routes: CommandTruthRouteEntry[]
}

interface MvpSnapshot {
  generatedAt: number
  canonical: {
    activePath: string
    legacyRollback: string
    sourceOfTruth: string
  }
  metrics: Record<string, number>
  blackwireFlow: string[]
  surfaces: Surface[]
  blackwireDoneGates: BlackwireDoneGate[]
  agents: Array<{ agent_id: string; display_name: string; status: string; current_assignment: string | null; last_proof: string | null }>
  assignments: Array<{ id: number; title: string; status: string; priority: string; assignee_agent_id: string | null; evidence: string | null }>
  receipts: Array<{ id: number; decision: string; approval_tier: string; approved_by: string; evidence: string | null; created_at: number }>
  queuedAlerts: Array<{ id: number; target_agent_id: string; reason: string; alert_state: string }>
  messages: Array<{ id: number; sender_id: string; body: string; delivery: Array<{ state: string; recipient_id: string; evidence: string | null }> }>
  truthGates: TruthGate[]
  memoryInventory: EvidenceRow[]
  assetLibrary: EvidenceRow[]
  brainstormWall: EvidenceRow[]
  newProjectChecklist: EvidenceRow[]
}

const badgeClass: Record<SurfaceStatus | string, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  not_instrumented: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  isolated: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  manual: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  evidence_missing: 'border-red-500/30 bg-red-500/10 text-red-300',
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass[status] || badgeClass.partial}`}>{status.replace(/_/g, ' ')}</span>
}

function formatReceiptTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function EvidenceRows({ title, rows }: { title: string; rows: EvidenceRow[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{row.label}</h3>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.evidence}</p>
            <p className="mt-2 break-all text-[11px] text-primary">{row.sourcePath}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Last checked: {row.lastChecked ? formatReceiptTime(row.lastChecked) : 'Not Instrumented Yet'}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function CommandTruthPanel() {
  const [snapshot, setSnapshot] = useState<MvpSnapshot | null>(null)
  const [routeContract, setRouteContract] = useState<CommandTruthRouteContract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [idea, setIdea] = useState('')
  const [assetNote, setAssetNote] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [snapshotRes, routeRes] = await Promise.all([
        fetch('/api/mission-control-mvp'),
        fetch('/api/command-truth/routes'),
      ])
      const json = await snapshotRes.json()
      const routeJson = await routeRes.json()
      if (!snapshotRes.ok) throw new Error(json.error || 'Failed to load Command Truth')
      if (!routeRes.ok) throw new Error(routeJson.error || 'Failed to load Command Truth route contract')
      setSnapshot(json)
      setRouteContract(routeJson)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const liveCount = useMemo(() => snapshot?.surfaces.filter((surface) => surface.status === 'live').length || 0, [snapshot])

  async function createProject() {
    const name = projectName.trim()
    if (!name) return
    setCreatingProject(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: 'Created from Command Truth MVP quick-create.', ticketPrefix: name.slice(0, 5) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Project creation failed')
      setProjectName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreatingProject(false)
    }
  }

  async function sendBrainstormToBlackwire() {
    const trimmed = idea.trim()
    if (!trimmed) return
    await fetch('/api/group-chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomSlug: 'blackwire-ops', senderId: 'chris', senderType: 'human', body: `Brainstorm wall capture (isolated): ${trimmed}` }),
    })
    setIdea('')
    await load()
  }

  async function sendAssetNoteToBlackwire() {
    const trimmed = assetNote.trim()
    if (!trimmed) return
    await fetch('/api/group-chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomSlug: 'blackwire-ops', senderId: 'chris', senderType: 'human', body: `Asset library placeholder (not instrumented): ${trimmed}` }),
    })
    setAssetNote('')
    await load()
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="inline" /></div>
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Command Truth</div>
            <h1 className="mt-1 text-2xl font-black text-foreground">Mission Control MVP cockpit</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              User-visible proof surface for Blackwire flow, canonical roots, queues, approvals, metrics, assets, brainstorms, memory isolation, and new project creation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="live" />
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
            <Link href="/group-chat" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-secondary">Open Blackwire</Link>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {snapshot && Object.entries(snapshot.metrics).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-black text-foreground">{value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-cyan-500/20 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-foreground">Blackwire runbook route contract</h2>
            <p className="mt-1 text-xs text-muted-foreground">{routeContract?.localMvpBoundary || 'Commercial-demo candidate only; route contract loading.'}</p>
          </div>
          <StatusBadge status="read_only" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(routeContract?.routes || []).map((route) => (
            <article key={route.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{route.surface}</h3>
                <StatusBadge status={route.status} />
              </div>
              <Link className="mt-2 block break-all text-xs font-semibold text-primary hover:underline" href={route.path.startsWith('/api/') ? '/command-truth?tab=routes' : route.path}>{route.path}</Link>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{route.requirement}</p>
              <p className="mt-2 text-xs leading-5 text-orange-200">Evidence: {route.evidence}</p>
              <p className="mt-2 text-xs leading-5 text-red-200">Boundary: {route.noFakeGreenBoundary}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 break-all text-[11px] text-muted-foreground">Runbook: {routeContract?.runbook || 'docs/PATCH_S4_BLACKWIRE_DEMO_RUNBOOK_2026-05-02.md'} · API: /api/command-truth/routes</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-foreground">MVP surface readiness</h2>
              <p className="text-xs text-muted-foreground">{liveCount}/{snapshot?.surfaces.length || 0} live; empty integrations show honest not-instrumented/isolation status.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(snapshot?.surfaces || []).map((surface) => (
              <article key={surface.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{surface.label}</h3>
                  <StatusBadge status={surface.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{surface.detail}</p>
                {surface.href && <Link className="mt-2 inline-block text-xs font-semibold text-primary hover:underline" href={surface.href}>Open surface →</Link>}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-red-500/20 bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-foreground">No-fake-green truth gates</h2>
              <p className="text-xs text-muted-foreground">Approval-required, Not Instrumented Yet, Evidence Missing, and blocked actions stay visible before any surface can claim Done.</p>
            </div>
            <StatusBadge status="evidence_missing" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(snapshot?.truthGates || []).map((gate) => (
              <article key={gate.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{gate.label}</h3>
                  <StatusBadge status={gate.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{gate.detail}</p>
                <p className="mt-2 text-xs leading-5 text-red-200">Blocked: {gate.blockedAction}</p>
                <p className="mt-2 text-xs leading-5 text-orange-200">Evidence: {gate.evidence}</p>
                {gate.href && <Link className="mt-2 inline-block text-xs font-semibold text-primary hover:underline" href={gate.href}>Open gate surface →</Link>}
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-bold text-foreground">Blackwire integrated proof</h2>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
              {(snapshot?.blackwireFlow || []).map((step, index) => (
                <li key={step} className="flex gap-2"><span className="font-black text-primary">{index + 1}.</span><span>{step}</span></li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-red-500/20 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-foreground">Blackwire Done gates</h2>
                <p className="mt-1 text-xs text-muted-foreground">Group chat, board, approvals, receipts, and delivery proof must be visible before Done is treated as real.</p>
              </div>
              <StatusBadge status="evidence_missing" />
            </div>
            <div className="mt-3 space-y-2">
              {(snapshot?.blackwireDoneGates || []).map((gate) => (
                <article key={gate.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{gate.label}</h3>
                    <StatusBadge status={gate.status} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{gate.detail}</p>
                  <p className="mt-2 text-xs leading-5 text-orange-200">Required evidence: {gate.requiredEvidence}</p>
                  <p className="mt-2 break-all text-[11px] text-primary">Source: {gate.source}</p>
                  {gate.href && <Link className="mt-2 inline-block text-xs font-semibold text-primary hover:underline" href={gate.href}>Open gate →</Link>}
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-bold text-foreground">Canonical roots</h2>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">Active:</span> {snapshot?.canonical.activePath}</p>
              <p><span className="font-semibold text-foreground">Truth:</span> {snapshot?.canonical.sourceOfTruth}</p>
              <p><span className="font-semibold text-foreground">Rollback:</span> {snapshot?.canonical.legacyRollback}</p>
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold text-foreground">New project creation</h2>
          <div className="mt-3 flex gap-2">
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
            <Button onClick={createProject} disabled={!projectName.trim() || creatingProject}>Create</Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold text-foreground">Asset library</h2><StatusBadge status="not_instrumented" /></div>
          <div className="mt-3 flex gap-2">
            <input value={assetNote} onChange={(event) => setAssetNote(event.target.value)} placeholder="Capture asset/evidence note" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
            <Button variant="outline" onClick={sendAssetNoteToBlackwire} disabled={!assetNote.trim()}>Log</Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold text-foreground">Brainstorm wall</h2><StatusBadge status="isolated" /></div>
          <div className="mt-3 flex gap-2">
            <input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Capture idea, keep isolated" className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
            <Button variant="outline" onClick={sendBrainstormToBlackwire} disabled={!idea.trim()}>Post</Button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EvidenceRows title="Brain / Memory inventory" rows={snapshot?.memoryInventory || []} />
        <EvidenceRows title="Asset Library v0" rows={snapshot?.assetLibrary || []} />
        <EvidenceRows title="Brainstorm wall state" rows={snapshot?.brainstormWall || []} />
        <EvidenceRows title="New project checklist" rows={snapshot?.newProjectChecklist || []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <section className="rounded-2xl border border-border bg-card p-4 xl:col-span-2">
          <h2 className="font-bold text-foreground">Recent Blackwire messages + delivery</h2>
          <div className="mt-3 space-y-2">
            {(snapshot?.messages || []).slice(-5).map((message) => (
              <div key={message.id} className="rounded-lg border border-border bg-background p-3 text-xs">
                <div className="font-semibold text-foreground">@{message.sender_id}</div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{message.body}</p>
                <div className="mt-2 flex flex-wrap gap-1">{message.delivery.map((delivery) => <span key={`${message.id}-${delivery.recipient_id}`} className="rounded bg-card px-2 py-1 text-[10px] text-muted-foreground">{delivery.recipient_id}: {delivery.state}</span>)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold text-foreground">Agent cards</h2>
          <div className="mt-3 space-y-2">{(snapshot?.agents || []).slice(0, 6).map((agent) => <div key={agent.agent_id} className="rounded-lg bg-background p-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{agent.display_name}</span><StatusBadge status={agent.status} /></div><p className="mt-1 text-muted-foreground">{agent.current_assignment || agent.last_proof || 'No proof yet.'}</p></div>)}</div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold text-foreground">Approvals / queues</h2>
          <div className="mt-3 space-y-2 text-xs">
            {(snapshot?.receipts || []).slice(0, 3).map((receipt) => <div key={receipt.id} className="rounded-lg bg-background p-2"><div className="font-semibold text-foreground">{receipt.decision}</div><div className="mt-1 text-muted-foreground">{receipt.approval_tier} · {receipt.approved_by} · {formatReceiptTime(receipt.created_at)}</div></div>)}
            {(snapshot?.queuedAlerts || []).slice(0, 3).map((alert) => <div key={alert.id} className="rounded-lg bg-background p-2"><div className="font-semibold text-foreground">@{alert.target_agent_id} queued</div><div className="mt-1 text-muted-foreground">{alert.reason}</div></div>)}
          </div>
        </section>
      </div>
    </div>
  )
}
