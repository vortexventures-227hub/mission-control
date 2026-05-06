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

  if (loading) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-[#07080a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,rgba(7,8,10,0),rgba(7,8,10,0.94))]" />
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <Loader variant="inline" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#07080a] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(94,106,210,0.16),transparent_32%),linear-gradient(180deg,rgba(7,8,10,0),rgba(7,8,10,0.9))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(circle_at_50%_18%,black,transparent_74%)]" />
      <div className="relative z-10 space-y-5 p-4 md:p-6">
        <div className="rounded-[28px] border border-white/10 bg-[#0f1011]/80 p-5 shadow-[0_28px_120px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                {snapshot?.eyebrow || 'Mission Control Surface'}
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[#f7f8f8] md:text-5xl">{snapshot?.title || 'Surface unavailable'}</h1>
              <p className="mt-4 max-w-5xl text-sm leading-6 text-slate-400 md:text-base md:leading-7">{snapshot?.description || 'Evidence Missing: snapshot unavailable.'}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Local MVP demo</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Read-only truth</span>
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-200">No production claim</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatusBadge status={snapshot?.status || 'evidence_missing'} />
              {snapshot?.status !== 'read_only' && <StatusBadge status="read_only" />}
              <Button variant="outline" size="sm" onClick={load} className="border-white/10 bg-white/[0.04] hover:bg-white/[0.08]">Refresh</Button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
          <div className="mt-5 flex flex-wrap gap-2">
            {activeLinks.map(link => (
              <a key={link.id} href={`/${link.id}`} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${link.active ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.14)]' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-100'}`}>{link.label}</a>
            ))}
          </div>
        </div>

        {snapshot && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {Object.entries(snapshot.summary).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
                  <div className="text-2xl font-black tracking-[-0.04em] text-[#f7f8f8]">{valueLabel(value)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{keyLabel(key)}</div>
                </div>
              ))}
            </div>

            <section className="rounded-[24px] border border-amber-300/20 bg-amber-400/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-bold text-amber-100">Safety / truth boundaries</h2>
                <StatusBadge status="approval_required" />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {snapshot.guardrails.map((guardrail) => <div key={guardrail} className="rounded-2xl border border-amber-300/15 bg-black/20 p-3 text-sm leading-5 text-amber-100/90">{guardrail}</div>)}
              </div>
            </section>

            {snapshot.sections.map(section => (
              <section key={section.id} className="rounded-[24px] border border-white/10 bg-[#0f1011]/75 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black tracking-[-0.02em] text-[#f7f8f8]">{section.title}</h2>
                  {section.status && <StatusBadge status={section.status} />}
                </div>
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {section.cards.map(item => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/25 hover:bg-white/[0.055]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                          {item.owner && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-cyan-200/80">Owner: {item.owner}</p>}
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-400">{item.summary}</p>
                      {item.details && item.details.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {item.details.map((detail) => (
                            <div key={`${item.id}-${detail.label}`} className="rounded-xl border border-white/10 bg-black/20 p-2">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{detail.label}</span>
                                {detail.status && <StatusBadge status={detail.status} />}
                              </div>
                              <p className="text-xs leading-5 text-slate-200">{detail.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 text-xs leading-5 text-orange-200">Evidence: {item.evidence}</p>
                      <p className="mt-2 text-xs leading-5 text-cyan-200">Next: {item.nextAction}</p>
                      {item.links && item.links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.links.map(link => <a key={link.href} href={link.href} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-300/40 hover:text-cyan-100">{link.label}</a>)}
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
    </div>
  )
}
