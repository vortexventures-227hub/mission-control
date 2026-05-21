'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BoundaryBanner, Btn, Chip, DataTable, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

type SurfaceStatus = 'live' | 'partial' | 'not_instrumented' | 'isolated'
type GateStatus = 'approval_required' | 'not_instrumented' | 'blocked' | 'evidence_missing' | 'read_only'

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
  status: GateStatus
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

function statusTone(status: string): 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim' {
  switch (status) {
    case 'live':
    case 'read_only':
      return 'teal'
    case 'isolated':
    case 'manual':
    case 'alias':
      return 'purple'
    case 'partial':
    case 'approval_required':
    case 'evidence_missing':
      return 'amber'
    case 'blocked':
      return 'rose'
    case 'not_instrumented':
      return 'dim'
    default:
      return 'neutral'
  }
}

function StatusChip({ status, pulse = false }: { status: string; pulse?: boolean }) {
  return <Chip tone={statusTone(status)} pulse={pulse}>{status.replace(/_/g, ' ')}</Chip>
}

function formatReceiptTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function routeTarget(path: string) {
  return path.startsWith('/api/') ? '/command-truth?tab=routes' : path
}

function McLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="mc-btn-glitch inline-flex border border-[color:var(--mc-hairline-2)] bg-white/[0.035] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--mc-ink-1)] transition-colors hover:border-[color:var(--mc-teal)]/55 hover:text-[color:var(--mc-teal-soft)]"
    >
      {children}
    </Link>
  )
}

function EvidenceRows({ title, rows }: { title: string; rows: EvidenceRow[] }) {
  return (
    <HudPanel kicker="EVIDENCE REGISTER" title={title} right={<Chip tone="dim">{rows.length} rows</Chip>}>
      <DataTable
        columns={[
          { key: 'label', label: 'Item', width: '20%' },
          { key: 'status', label: 'State', width: '120px', render: (row) => <StatusChip status={String(row.status)} /> },
          { key: 'evidence', label: 'Evidence' },
          { key: 'sourcePath', label: 'Source', mute: true },
          {
            key: 'lastChecked',
            label: 'Checked',
            width: '120px',
            render: (row) => row.lastChecked ? formatReceiptTime(Number(row.lastChecked)) : 'Not Instrumented Yet',
            mute: true,
          },
        ]}
        rows={rows as unknown as Array<Record<string, unknown>>}
      />
    </HudPanel>
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
  const receiptBacked = useMemo(() => snapshot?.assignments.filter((assignment) => Boolean(assignment.evidence)).length || 0, [snapshot])

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
    return (
      <Page kicker="COMMAND TRUTH" title="INITIALIZING" badges={<Chip tone="teal" pulse>AUTHED LOCAL READ</Chip>}>
        <HudPanel title="Loading mission control proof bus" glow>
          <div className="flex min-h-[220px] items-center justify-center text-[color:var(--mc-ink-1)]">
            <Loader variant="inline" />
          </div>
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="COMMAND TRUTH / SOURCE OF RECORD"
      title="Mission Control MVP Cockpit"
      subtitle="User-visible proof surface for Blackwire flow, canonical roots, queues, approvals, metrics, assets, brainstorms, memory isolation, and new project creation."
      badges={(
        <>
          <StatusChip status="live" pulse />
          <Chip tone="teal">LOCAL AUTHED</Chip>
          <Chip tone="amber">DONE MEANS PROVEN</Chip>
          <Chip tone="rose">NO EXTERNAL EXECUTION</Chip>
        </>
      )}
      actions={(
        <>
          <Btn onClick={load} variant="primary">Refresh</Btn>
          <McLink href="/group-chat">Open Blackwire</McLink>
          <McLink href="/">HQ Overview</McLink>
        </>
      )}
    >
      {error && (
        <div className="mb-4">
          <BoundaryBanner tone="rose" title="Command Truth warning">{error}</BoundaryBanner>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {snapshot && Object.entries(snapshot.metrics).map(([key, value], index) => (
              <Stat
                key={key}
                label={key.replace(/([A-Z])/g, ' $1')}
                value={value}
                sub={index === 0 ? 'mvp pulse' : undefined}
                accent={index % 3 === 0 ? 'teal' : index % 3 === 1 ? 'purple' : 'amber'}
                glow={index === 0}
              />
            ))}
          </div>

          <HudPanel
            kicker="OPERATOR LOOP"
            title="Daily-driver command paths"
            right={<StatusChip status="read_only" />}
            glow
          >
            <p className="mb-3 text-xs leading-5 text-[color:var(--mc-ink-1)]">Fast links for the operator loop: rooms, tasks, agents, approvals, expenses, intake, and proof surfaces.</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['Blackwire room', '/rooms/blackwire-ops'],
                ['Koda tracker', '/tracker?agent=koda'],
                ['Tasks', '/tasks'],
                ['Agents', '/agents'],
                ['Approvals', '/exec-approvals'],
                ['Expenses', '/expenses'],
                ['Knowledge', '/knowledge-intake'],
                ['Security', '/security-command'],
              ].map(([label, href]) => <McLink key={href} href={href}>{label}</McLink>)}
            </div>
          </HudPanel>

          <HudPanel
            kicker="ROUTE CONTRACT"
            title="Blackwire runbook route contract"
            right={<StatusChip status="read_only" />}
          >
            <BoundaryBanner tone="amber" title="Local MVP boundary">
              {routeContract?.localMvpBoundary || 'Commercial-demo candidate only; route contract loading.'}
            </BoundaryBanner>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(routeContract?.routes || []).map((route) => (
                <article key={route.id} className="mc-bevel p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{route.surface}</h3>
                    <StatusChip status={route.status} />
                  </div>
                  <Link className="mt-2 block break-all font-mono text-[11px] font-bold text-[color:var(--mc-teal-soft)] hover:underline" href={routeTarget(route.path)}>{route.path}</Link>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">{route.requirement}</p>
                  <BoundaryBanner tone={route.evidence.toLowerCase().includes('missing') ? 'amber' : 'teal'} title="Evidence">{route.evidence}</BoundaryBanner>
                  <div className="mt-2">
                    <BoundaryBanner tone="rose" title="No fake green">{route.noFakeGreenBoundary}</BoundaryBanner>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-3 break-all font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--mc-ink-2)]">Runbook: {routeContract?.runbook || 'docs/PATCH_S4_BLACKWIRE_DEMO_RUNBOOK_2026-05-02.md'} · API: /api/command-truth/routes</p>
          </HudPanel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <HudPanel kicker="SURFACE STATUS" title="MVP surface readiness" right={<Chip tone="teal">{liveCount}/{snapshot?.surfaces.length || 0} live</Chip>}>
              <div className="grid gap-3 md:grid-cols-2">
                {(snapshot?.surfaces || []).map((surface) => (
                  <article key={surface.id} className="mc-bevel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{surface.label}</h3>
                      <StatusChip status={surface.status} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">{surface.detail}</p>
                    {surface.href && <div className="mt-3"><McLink href={surface.href}>Open surface</McLink></div>}
                  </article>
                ))}
              </div>
            </HudPanel>

            <HudPanel kicker="NO FAKE GREEN" title="Truth gates" right={<StatusChip status="evidence_missing" />} glow>
              <div className="grid gap-3">
                {(snapshot?.truthGates || []).map((gate) => (
                  <article key={gate.id} className="mc-bevel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{gate.label}</h3>
                      <StatusChip status={gate.status} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">{gate.detail}</p>
                    <BoundaryBanner tone="rose" title="Blocked">{gate.blockedAction}</BoundaryBanner>
                    <div className="mt-2">
                      <BoundaryBanner tone="amber" title="Evidence">{gate.evidence}</BoundaryBanner>
                    </div>
                    {gate.href && <div className="mt-3"><McLink href={gate.href}>Open gate</McLink></div>}
                  </article>
                ))}
              </div>
            </HudPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <HudPanel kicker="ALPHA ACTION" title="New project creation" right={<Chip tone="amber">audit gated</Chip>}>
              <div className="flex gap-2">
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" className="h-9 min-w-0 flex-1 border border-[color:var(--mc-hairline-2)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]" />
                <Button onClick={createProject} disabled={!projectName.trim() || creatingProject}>Create</Button>
              </div>
            </HudPanel>

            <HudPanel kicker="CAPTURE" title="Asset library" right={<StatusChip status="not_instrumented" />}>
              <div className="flex gap-2">
                <input value={assetNote} onChange={(event) => setAssetNote(event.target.value)} placeholder="Capture asset/evidence note" className="h-9 min-w-0 flex-1 border border-[color:var(--mc-hairline-2)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]" />
                <Button variant="outline" onClick={sendAssetNoteToBlackwire} disabled={!assetNote.trim()}>Log</Button>
              </div>
            </HudPanel>

            <HudPanel kicker="CAPTURE" title="Brainstorm wall" right={<StatusChip status="isolated" />}>
              <div className="flex gap-2">
                <input value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Capture idea, keep isolated" className="h-9 min-w-0 flex-1 border border-[color:var(--mc-hairline-2)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]" />
                <Button variant="outline" onClick={sendBrainstormToBlackwire} disabled={!idea.trim()}>Post</Button>
              </div>
            </HudPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <EvidenceRows title="Brain / Memory inventory" rows={snapshot?.memoryInventory || []} />
            <EvidenceRows title="Asset Library v0" rows={snapshot?.assetLibrary || []} />
            <EvidenceRows title="Brainstorm wall state" rows={snapshot?.brainstormWall || []} />
            <EvidenceRows title="New project checklist" rows={snapshot?.newProjectChecklist || []} />
          </div>

          <HudPanel kicker="ROOM PROOF" title="Recent Blackwire messages + delivery">
            <div className="grid gap-2 lg:grid-cols-2">
              {(snapshot?.messages || []).slice(-6).map((message) => (
                <article key={message.id} className="mc-bevel p-3 text-xs">
                  <div className="font-mono font-black uppercase tracking-[0.12em] text-[color:var(--mc-ink-0)]">@{message.sender_id}</div>
                  <p className="mt-2 line-clamp-2 text-[color:var(--mc-ink-1)]">{message.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.delivery.map((delivery) => (
                      <span key={`${message.id}-${delivery.recipient_id}`} className="border border-[color:var(--mc-hairline)] bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--mc-ink-2)]">
                        {delivery.recipient_id}: {delivery.state}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </HudPanel>
        </div>

        <aside className="space-y-4">
          <HudPanel kicker="CANONICAL ROOTS" title="Source paths" glow>
            <div className="space-y-2 font-mono text-[11px] uppercase tracking-[0.11em] text-[color:var(--mc-ink-1)]">
              <p><span className="text-[color:var(--mc-ink-3)]">Active:</span> {snapshot?.canonical.activePath}</p>
              <p><span className="text-[color:var(--mc-ink-3)]">Truth:</span> {snapshot?.canonical.sourceOfTruth}</p>
              <p><span className="text-[color:var(--mc-ink-3)]">Rollback:</span> {snapshot?.canonical.legacyRollback}</p>
            </div>
          </HudPanel>

          <HudPanel kicker="FLOW" title="Blackwire integrated proof">
            <ol className="space-y-2 text-xs text-[color:var(--mc-ink-1)]">
              {(snapshot?.blackwireFlow || []).map((step, index) => (
                <li key={step} className="mc-bevel flex gap-2 p-2">
                  <span className="font-mono font-black text-[color:var(--mc-teal)]">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </HudPanel>

          <HudPanel kicker="DONE GATES" title="Blackwire Done gates" right={<StatusChip status="evidence_missing" />}>
            <div className="space-y-2">
              {(snapshot?.blackwireDoneGates || []).map((gate) => (
                <article key={gate.id} className="mc-bevel p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{gate.label}</h3>
                    <StatusChip status={gate.status} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-1)]">{gate.detail}</p>
                  <BoundaryBanner tone="amber" title="Required evidence">{gate.requiredEvidence}</BoundaryBanner>
                  <p className="mt-2 break-all font-mono text-[10px] text-[color:var(--mc-teal-soft)]">Source: {gate.source}</p>
                  {gate.href && <div className="mt-3"><McLink href={gate.href}>Open gate</McLink></div>}
                </article>
              ))}
            </div>
          </HudPanel>

          <HudPanel kicker="AGENTS" title="Agent cards" right={<Chip tone="amber">{receiptBacked} assignments with evidence</Chip>}>
            <div className="space-y-2">
              {(snapshot?.agents || []).slice(0, 8).map((agent) => (
                <div key={agent.agent_id} className="mc-bevel p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{agent.display_name}</span>
                    <StatusChip status={agent.status} />
                  </div>
                  <p className="mt-1 text-[color:var(--mc-ink-1)]">{agent.current_assignment || agent.last_proof || 'No proof yet.'}</p>
                </div>
              ))}
            </div>
          </HudPanel>

          <HudPanel kicker="APPROVALS" title="Approvals / queues">
            <div className="space-y-2 text-xs">
              {(snapshot?.receipts || []).slice(0, 4).map((receipt) => (
                <div key={receipt.id} className="mc-bevel p-2">
                  <div className="font-mono font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{receipt.decision}</div>
                  <div className="mt-1 text-[color:var(--mc-ink-2)]">{receipt.approval_tier} · {receipt.approved_by} · {formatReceiptTime(receipt.created_at)}</div>
                </div>
              ))}
              {(snapshot?.queuedAlerts || []).slice(0, 4).map((alert) => (
                <div key={alert.id} className="mc-bevel p-2">
                  <div className="font-mono font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">@{alert.target_agent_id} queued</div>
                  <div className="mt-1 text-[color:var(--mc-ink-2)]">{alert.reason}</div>
                </div>
              ))}
            </div>
          </HudPanel>
        </aside>
      </div>
    </Page>
  )
}
