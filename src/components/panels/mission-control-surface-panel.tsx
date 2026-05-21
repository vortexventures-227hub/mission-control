"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BoundaryBanner, Btn, Chip, DataTable, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Loader } from '@/components/ui/loader'

type SurfaceStatus = 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'planned' | 'blocked' | string

interface SurfaceCard {
  id: string
  title: string
  status: SurfaceStatus
  owner?: string
  summary: string
  evidence: string
  nextAction: string
  details?: Array<{ label: string; value: string; status?: SurfaceStatus }>
  links?: Array<{ label: string; href: string }>
}

interface SurfaceSection {
  id: string
  title: string
  status?: SurfaceStatus
  cards: SurfaceCard[]
}

interface SurfaceSnapshot {
  id: string
  title: string
  eyebrow: string
  status: SurfaceStatus
  safetyMode: 'read_only'
  description: string
  generatedAt: number
  guardrails: string[]
  summary: Record<string, number | boolean | string>
  sections: SurfaceSection[]
}

const surfaceLinks = [
  { id: 'mission-control', label: 'MVP Home' },
  { id: 'research-command', label: 'Research' },
  { id: 'automation-command', label: 'Automation' },
  { id: 'trading', label: 'Trading' },
  { id: 'design', label: 'Design' },
  { id: 'brain-memory', label: 'Brain/Memory' },
  { id: 'asset-library', label: 'Assets' },
  { id: 'think-tank', label: 'Think Tank' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'security-command', label: 'Security Center' },
  { id: 'security', label: 'Security Audit' },
]

function statusTone(status: SurfaceStatus): 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim' {
  switch (status) {
    case 'read_only':
      return 'teal'
    case 'approval_required':
    case 'evidence_missing':
      return 'amber'
    case 'blocked':
      return 'rose'
    case 'not_instrumented':
      return 'dim'
    case 'planned':
      return 'purple'
    default:
      return 'neutral'
  }
}

function StatusChip({ status, pulse = false }: { status: SurfaceStatus; pulse?: boolean }) {
  return <Chip tone={statusTone(status)} pulse={pulse}>{status.replace(/_/g, ' ')}</Chip>
}

function valueLabel(value: number | boolean | string) {
  if (typeof value === 'boolean') return value ? 'YES' : 'NO'
  return value
}

function keyLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
}

function RouteLink({ href, children, active = false }: { href: string; children: string; active?: boolean }) {
  return (
    <a
      href={href}
      className={`mc-btn-glitch inline-flex border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
        active
          ? 'border-[color:var(--mc-teal)]/65 bg-[rgba(46,230,214,0.13)] text-[color:var(--mc-teal-soft)] shadow-[0_0_18px_rgba(46,230,214,0.12)]'
          : 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-2)] hover:border-[color:var(--mc-teal)]/45 hover:text-[color:var(--mc-teal-soft)]'
      }`}
    >
      {children}
    </a>
  )
}

export function MissionControlSurfacePanel({ surfaceId }: { surfaceId: string }) {
  const [snapshot, setSnapshot] = useState<SurfaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/mission-control-surfaces/${encodeURIComponent(surfaceId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load Mission Control surface')
      setSnapshot(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [surfaceId])

  useEffect(() => { load() }, [load])

  const activeLinks = useMemo(() => surfaceLinks.map(link => ({ ...link, active: link.id === surfaceId })), [surfaceId])

  if (loading) {
    return (
      <Page
        kicker="MISSION CONTROL / SURFACE LOAD"
        title="INITIALIZING"
        badges={<Chip tone="teal" pulse>LOCAL READ</Chip>}
      >
        <HudPanel title="Snapshot bus" glow>
          <div className="flex min-h-[220px] items-center justify-center text-[color:var(--mc-ink-1)]">
            <Loader variant="inline" />
          </div>
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker={snapshot?.eyebrow || 'MISSION CONTROL / SURFACE'}
      title={snapshot?.title || 'Surface unavailable'}
      subtitle={snapshot?.description || 'Evidence Missing: snapshot unavailable.'}
      badges={(
        <>
          <StatusChip status={snapshot?.status || 'evidence_missing'} pulse={snapshot?.status === 'read_only'} />
          <Chip tone="teal">LOCAL ONLY</Chip>
          <Chip tone="amber">NO FAKE GREEN</Chip>
          <Chip tone="dim">READ MODEL: {snapshot?.safetyMode || 'read_only'}</Chip>
        </>
      )}
      actions={<Btn onClick={load} variant="primary">Refresh</Btn>}
    >
      {error && (
        <div className="mb-4">
          <BoundaryBanner tone="rose" title="Surface load warning">{error}</BoundaryBanner>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {snapshot && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                {Object.entries(snapshot.summary).map(([key, value], index) => (
                  <Stat
                    key={key}
                    label={keyLabel(key)}
                    value={String(valueLabel(value))}
                    sub={index === 0 ? 'surface truth' : undefined}
                    accent={index % 3 === 0 ? 'teal' : index % 3 === 1 ? 'purple' : 'amber'}
                    glow={index === 0}
                  />
                ))}
              </div>

              <HudPanel
                kicker="ROUTE MATRIX"
                title="Command links"
                right={<Chip tone="dim">{activeLinks.length} routes</Chip>}
              >
                <div className="flex flex-wrap gap-2">
                  {activeLinks.map(link => (
                    <RouteLink key={link.id} href={`/${link.id}`} active={link.active}>{link.label}</RouteLink>
                  ))}
                </div>
              </HudPanel>

              <HudPanel
                kicker="TRUTH CONTRACT"
                title="Safety / boundary gates"
                right={<StatusChip status="approval_required" />}
                glow
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {snapshot.guardrails.map((guardrail) => (
                    <BoundaryBanner key={guardrail} tone={guardrail.includes('No ') || guardrail.includes('Do not') ? 'rose' : 'amber'} title="Boundary">
                      {guardrail}
                    </BoundaryBanner>
                  ))}
                </div>
              </HudPanel>

              {snapshot.sections.map(section => (
                <HudPanel
                  key={section.id}
                  kicker={section.id}
                  title={section.title}
                  right={section.status ? <StatusChip status={section.status} /> : <Chip tone="dim">{section.cards.length} lanes</Chip>}
                >
                  <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {section.cards.map(item => (
                      <article
                        key={item.id}
                        className="mc-bevel relative min-h-[250px] overflow-hidden p-3 transition-colors hover:border-[color:var(--mc-teal-dim)] hover:bg-[rgba(46,230,214,0.035)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--mc-ink-3)]">{item.id}</div>
                            <h3 className="mt-1 font-mono text-sm font-black uppercase tracking-[0.08em] text-[color:var(--mc-ink-0)]">{item.title}</h3>
                            {item.owner && <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--mc-teal-soft)]">Owner: {item.owner}</p>}
                          </div>
                          <StatusChip status={item.status} />
                        </div>

                        <p className="mt-3 text-xs leading-5 text-[color:var(--mc-ink-1)]">{item.summary}</p>

                        {item.details && item.details.length > 0 && (
                          <div className="mt-3">
                            <DataTable
                              columns={[
                                { key: 'label', label: 'Gate', width: '28%' },
                                { key: 'value', label: 'Evidence' },
                                {
                                  key: 'status',
                                  label: 'State',
                                  width: '96px',
                                  render: (row) => row.status ? <StatusChip status={String(row.status)} /> : <Chip tone="dim">n/a</Chip>,
                                },
                              ]}
                              rows={item.details as Array<Record<string, unknown>>}
                            />
                          </div>
                        )}

                        <div className="mt-3 grid gap-2">
                          <BoundaryBanner tone={item.evidence.toLowerCase().includes('missing') ? 'amber' : 'teal'} title="Evidence">
                            {item.evidence}
                          </BoundaryBanner>
                          <BoundaryBanner tone={item.nextAction.toLowerCase().includes('approval') || item.nextAction.toLowerCase().includes('do not') ? 'amber' : 'teal'} title="Next action">
                            {item.nextAction}
                          </BoundaryBanner>
                        </div>

                        {item.links && item.links.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.links.map(link => <RouteLink key={link.href} href={link.href}>{link.label}</RouteLink>)}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </HudPanel>
              ))}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <HudPanel kicker="LOCAL PROOF" title="Surface contract" glow>
            <div className="space-y-2 font-mono text-[11px] uppercase tracking-[0.11em] text-[color:var(--mc-ink-1)]">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mc-hairline)] pb-2">
                <span>Generated</span>
                <span className="text-right text-[color:var(--mc-teal-soft)]">{snapshot ? new Date(snapshot.generatedAt).toLocaleString() : 'n/a'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mc-hairline)] pb-2">
                <span>External sends</span>
                <StatusChip status="blocked" />
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--mc-hairline)] pb-2">
                <span>Memory writes</span>
                <StatusChip status="blocked" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Done claims</span>
                <Chip tone="amber">Receipt gated</Chip>
              </div>
            </div>
          </HudPanel>

          <HudPanel kicker="LEGEND" title="States">
            <div className="grid gap-2">
              <StatusChip status="read_only" />
              <StatusChip status="approval_required" />
              <StatusChip status="evidence_missing" />
              <StatusChip status="not_instrumented" />
              <StatusChip status="blocked" />
              <StatusChip status="planned" />
            </div>
          </HudPanel>
        </aside>
      </div>
    </Page>
  )
}
