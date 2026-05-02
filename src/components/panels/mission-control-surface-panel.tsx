"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
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

const badgeClass: Record<string, string> = {
  read_only: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  planned: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  not_instrumented: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  approval_required: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  evidence_missing: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const surfaceLinks = [
  { id: 'mission-control', label: 'MVP Home' },
  { id: 'research-command', label: 'Research' },
  { id: 'trading', label: 'Trading' },
  { id: 'design', label: 'Design' },
  { id: 'brain-memory', label: 'Brain/Memory' },
  { id: 'asset-library', label: 'Assets' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'security-command', label: 'Security Center' },
  { id: 'security', label: 'Security Audit' },
]

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass[status] || badgeClass.planned}`}>{status.replace(/_/g, ' ')}</span>
}

function valueLabel(value: number | boolean | string) {
  if (typeof value === 'boolean') return value ? 'YES' : 'NO'
  return value
}

function keyLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="inline" /></div>

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">{snapshot?.eyebrow || 'Mission Control Surface'}</div>
            <h1 className="mt-1 text-2xl font-black text-foreground">{snapshot?.title || 'Surface unavailable'}</h1>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-muted-foreground">{snapshot?.description || 'Evidence Missing: snapshot unavailable.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={snapshot?.status || 'evidence_missing'} />
            <StatusBadge status="read_only" />
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          {activeLinks.map(link => (
            <a key={link.id} href={`/${link.id}`} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${link.active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}>{link.label}</a>
          ))}
        </div>
      </div>

      {snapshot && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {Object.entries(snapshot.summary).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border bg-card p-3">
                <div className="text-xl font-black text-foreground">{valueLabel(value)}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{keyLabel(key)}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold text-amber-100">Safety / truth boundaries</h2>
              <StatusBadge status="approval_required" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {snapshot.guardrails.map((guardrail) => <div key={guardrail} className="rounded-xl border border-amber-500/20 bg-background/60 p-3 text-sm leading-5 text-amber-100">{guardrail}</div>)}
            </div>
          </section>

          {snapshot.sections.map(section => (
            <section key={section.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-bold text-foreground">{section.title}</h2>
                {section.status && <StatusBadge status={section.status} />}
              </div>
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {section.cards.map(item => (
                  <article key={item.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        {item.owner && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-primary">Owner: {item.owner}</p>}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    <p className="mt-2 text-xs leading-5 text-orange-200">Evidence: {item.evidence}</p>
                    <p className="mt-2 text-xs leading-5 text-primary">Next: {item.nextAction}</p>
                    {item.links && item.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.links.map(link => <a key={link.href} href={link.href} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground hover:border-primary/50 hover:text-primary">{link.label}</a>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
