'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

type SourceType = 'youtube' | 'x' | 'reddit' | 'article' | 'pdf' | 'paste' | 'file' | 'folder'
type SourceStatus =
  | 'captured'
  | 'extracted'
  | 'extracting'
  | 'summarized'
  | 'ready_for_review'
  | 'learned'
  | 'blocked'
  | 'error'
  | 'credentials_needed'
  | 'manual_paste_needed'

interface KnowledgeExtraction {
  source_id: string
  summary: string
  key_ideas: string[]
  tools_mentioned: string[]
  mcp_servers: string[]
  plugins_mentioned: string[]
  implementation_steps: string[]
  claims_to_verify: string[]
  recommended_destinations: string[]
  citations: Array<{ label: string; url?: string; path?: string }>
}

interface KnowledgeSource {
  id: string
  source_type: SourceType
  source_url: string | null
  title: string
  captured_at: number
  raw_path: string
  extracted_text_path: string | null
  status: SourceStatus
  error: string | null
  tags: string[]
  project_scope: string
  context_note: string | null
  extraction?: KnowledgeExtraction
}

interface KnowledgeSnapshot {
  guardrails: string[]
  detection?: {
    source_type: SourceType
    label: string
    extraction_status: SourceStatus
    extraction_note: string
  }
  source?: KnowledgeSource
  extraction?: KnowledgeExtraction
  recent_sources: KnowledgeSource[]
  gates: Array<{ action: string; status: 'available' | 'approval_required' | 'blocked'; detail: string }>
}

const sampleText = `Mission Control Knowledge Intake should capture useful source material without silently writing to durable memory.
Graphify and Brain writes require approval, citations, and a receipt.
Operators need a review card with summary, key ideas, tools mentioned, implementation steps, claims to verify, and recommended destinations.`

function detectLocal(input: string): SourceType {
  const value = input.trim()
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) return 'x'
    if (host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'redd.it' || host.endsWith('.redd.it')) return 'reddit'
    if (url.pathname.toLowerCase().endsWith('.pdf')) return 'pdf'
    return 'article'
  } catch {
    return 'paste'
  }
}

function sourceBadge(type: SourceType) {
  switch (type) {
    case 'youtube': return 'YouTube'
    case 'x': return 'X / Twitter'
    case 'reddit': return 'Reddit'
    case 'article': return 'Article'
    case 'pdf': return 'PDF'
    case 'file': return 'File'
    case 'folder': return 'Folder'
    default: return 'Paste'
  }
}

function statusClass(status: string) {
  if (status === 'ready_for_review' || status === 'summarized' || status === 'extracted') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'credentials_needed' || status === 'blocked' || status === 'manual_paste_needed') return 'border-amber-400/30 bg-amber-500/10 text-amber-100'
  if (status === 'error') return 'border-red-400/30 bg-red-500/10 text-red-100'
  return 'border-sky-400/30 bg-sky-500/10 text-sky-100'
}

function gateClass(status: 'available' | 'approval_required' | 'blocked') {
  if (status === 'available') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
  if (status === 'blocked') return 'border-red-400/25 bg-red-500/10 text-red-100'
  return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function isBlockedStatus(status: SourceStatus) {
  return ['blocked', 'error', 'credentials_needed', 'manual_paste_needed'].includes(status)
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
      <h3 className="text-sm font-black tracking-[-0.01em] text-slate-100">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          {items.map((item, index) => <li key={`${title}-${index}`} className="leading-relaxed"><span className="mr-2 text-cyan-300">•</span>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Nothing extracted yet.</p>
      )}
    </section>
  )
}

export function KnowledgeIntakePanel() {
  const [content, setContent] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [projectScope, setProjectScope] = useState('Mission Control')
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const detected = useMemo(() => detectLocal(content), [content])

  useEffect(() => {
    fetch('/api/knowledge-intake')
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setSnapshot(data) })
      .catch(() => {})
  }, [])

  async function submitSource(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setActionMessage(null)
    try {
      const response = await fetch('/api/knowledge-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          context_note: contextNote,
          project_scope: projectScope,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Capture failed')
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function requestAction(destination: string) {
    const sourceId = snapshot?.source?.id
    if (!sourceId) return
    setActionMessage(null)
    const response = await fetch('/api/knowledge-intake/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, destination }),
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      setActionMessage(data.receipt?.reason || 'Approval required before durable write.')
    } else {
      setActionMessage(data.error || 'Could not stage approval request.')
    }
  }

  const extraction = snapshot?.extraction
  const recent = snapshot?.recent_sources || []
  const gateCounts = snapshot?.gates.reduce((acc, gate) => {
    acc[gate.status] += 1
    return acc
  }, { available: 0, approval_required: 0, blocked: 0 } as Record<'available' | 'approval_required' | 'blocked', number>) || { available: 0, approval_required: 0, blocked: 0 }
  const readySources = recent.filter(source => ['ready_for_review', 'summarized', 'extracted'].includes(source.status))
  const blockedSources = recent.filter(source => isBlockedStatus(source.status))
  const citationCount = recent.reduce((total, source) => total + (source.extraction?.citations?.length || 0), 0)
  const nextOperatorMove = readySources.length > 0
    ? 'Review latest extraction card and stage destination approval only when citations look clean.'
    : blockedSources.length > 0
      ? 'Resolve blocked sources with pasted text, credentials, or a fresh public source before asking Memory to learn.'
      : 'Capture a source to create the first review card.'

  return (
    <div className="relative min-h-full overflow-hidden bg-[#07080a] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_4%,rgba(34,211,238,0.20),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(94,106,210,0.18),transparent_32%),linear-gradient(180deg,rgba(7,8,10,0),rgba(7,8,10,0.94))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(circle_at_50%_18%,black,transparent_74%)]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        <section className="rounded-[30px] border border-white/10 bg-[#0f1011]/80 p-5 shadow-[0_28px_120px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl md:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                Mission Control · Source-to-Wiki MVP
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-[#f7f8f8] md:text-5xl">Knowledge Intake Command Deck</h1>
              <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-400 md:text-base md:leading-7">
                Capture links, transcripts, notes, and research into a review queue with citations, approval gates, and visible proof before anything touches durable memory.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Local MVP demo</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Human review required</span>
                <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-200">No live Graphify/gBrain writes</span>
              </div>
            </div>
            <div className="grid min-w-[260px] grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
                <div className="text-2xl font-black text-slate-100">{recent.length}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Sources</div>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-3 text-center">
                <div className="text-2xl font-black text-amber-100">{blockedSources.length}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-200/70">Needs Input</div>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-3 text-center">
                <div className="text-2xl font-black text-emerald-100">{readySources.length}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200/70">Review Ready</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_400px]">
          <div className="space-y-5">
            <form onSubmit={submitSource} className="rounded-[26px] border border-white/10 bg-[#0f1011]/78 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/80">Capture Source</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-slate-100">Drop raw material into review</h2>
                  <p className="mt-1 text-sm text-slate-400">Pasted text, public articles, and available YouTube transcripts produce review cards. X and blocked sources stay honest.</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusClass('captured')}`}>
                  Detected: {sourceBadge(detected)}
                </span>
              </div>

              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                rows={9}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/24 p-4 text-sm leading-6 text-slate-100 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
                placeholder="Paste a YouTube/X/article URL, source notes, transcript text, or implementation idea..."
              />

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                <input
                  value={contextNote}
                  onChange={event => setContextNote(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/24 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
                  placeholder="Context note: why this matters, who asked, where it belongs"
                />
                <select
                  value={projectScope}
                  onChange={event => setProjectScope(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/24 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
                >
                  <option>Mission Control</option>
                  <option>Client workspace</option>
                  <option>Revenue operations</option>
                  <option>Marketing</option>
                  <option>Research Command</option>
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" disabled={submitting || !content.trim()} className="rounded-full bg-cyan-300 px-5 font-bold text-slate-950 hover:bg-cyan-200">
                  {submitting ? 'Capturing...' : 'Capture and Review'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setContent(sampleText)} className="rounded-full border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]">
                  Use Sample Paste
                </Button>
                <Button type="button" variant="ghost" onClick={() => setContent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')} className="rounded-full text-slate-400 hover:bg-white/[0.06] hover:text-slate-100">
                  Try URL Scaffold
                </Button>
              </div>
              {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            </form>

            {snapshot?.source && extraction ? (
              <div className="space-y-5">
                <section className="rounded-[26px] border border-white/10 bg-[#0f1011]/78 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.20em] text-cyan-200/75">Review Card</p>
                      <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-100">{snapshot.source.title}</h2>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(snapshot.source.status)}`}>
                      {snapshot.detection?.label} · {snapshot.source.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{extraction.summary}</p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/24 p-3 text-xs leading-5 text-slate-400">
                    <p><span className="font-semibold text-slate-200">Raw path:</span> {snapshot.source.raw_path}</p>
                    {snapshot.source.extracted_text_path && <p className="mt-1"><span className="font-semibold text-slate-200">Extracted path:</span> {snapshot.source.extracted_text_path}</p>}
                    {snapshot.source.error && <p className="mt-2 text-amber-200">{snapshot.source.error}</p>}
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
                  <SectionList title="Key Ideas" items={extraction.key_ideas} />
                  <SectionList title="Tools / Tech Mentioned" items={extraction.tools_mentioned} />
                  <SectionList title="MCP Servers" items={extraction.mcp_servers || []} />
                  <SectionList title="Plugins / Integrations" items={extraction.plugins_mentioned || []} />
                  <SectionList title="Implementation Steps" items={extraction.implementation_steps} />
                  <SectionList title="Claims To Verify" items={extraction.claims_to_verify} />
                </div>

                <section className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
                  <h3 className="text-sm font-black tracking-[-0.01em] text-slate-100">Recommended Destinations</h3>
                  <p className="mt-1 text-xs text-slate-500">Buttons stage approval requests only; they do not perform durable writes.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {extraction.recommended_destinations.map(destination => (
                      <Button key={destination} type="button" variant="outline" size="sm" onClick={() => requestAction(destination)} className="rounded-full border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15">
                        Request approval: {destination}
                      </Button>
                    ))}
                  </div>
                  {actionMessage && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{actionMessage}</p>}
                </section>
              </div>
            ) : (
              <section className="rounded-[26px] border border-dashed border-white/15 bg-white/[0.035] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">KI</div>
                <h2 className="mt-4 text-xl font-black tracking-[-0.02em] text-slate-100">No source selected yet</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">Capture pasted source text, public articles, or available YouTube transcripts for review-card output. Blocked URLs preserve the source and explain what is missing.</p>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-white/10 bg-[#0f1011]/76 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-100">Review Queue</h2>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">Operator triage</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                {[
                  ['Review-ready', readySources.length],
                  ['Needs input', blockedSources.length],
                  ['Citations', citationCount],
                  ['Approval gates', gateCounts.approval_required],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="text-xl font-black text-slate-100">{value}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/80">Next operator move</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{nextOperatorMove}</p>
              </div>
            </section>

            <section className="rounded-[24px] border border-amber-300/20 bg-amber-400/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-amber-100">Truth Guardrails</h2>
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">Commercial-safe</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-amber-100/85">
                {(snapshot?.guardrails || []).map(item => <li key={item}>• {item}</li>)}
                {!snapshot && <li>• Local MVP demo: approval-gated, no production or live Graphify/gBrain claim.</li>}
              </ul>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0f1011]/76 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <h2 className="text-sm font-black text-slate-100">Action Gates</h2>
              <div className="mt-3 space-y-2">
                {(snapshot?.gates || []).map(gate => (
                  <div key={gate.action} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{gate.action}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${gateClass(gate.status)}`}>
                        {gate.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{gate.detail}</p>
                  </div>
                ))}
                {!snapshot?.gates.length && <p className="text-sm text-slate-500">Gate state loads from the local API.</p>}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0f1011]/76 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <h2 className="text-sm font-black text-slate-100">Recent Sources</h2>
              <div className="mt-3 space-y-3">
                {recent.length > 0 ? recent.map(source => (
                  <div key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-100">{source.title}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(source.status)}`}>{sourceBadge(source.source_type)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{formatTime(source.captured_at)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{source.raw_path}</p>
                  </div>
                )) : <p className="text-sm text-slate-500">No captured sources yet.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
