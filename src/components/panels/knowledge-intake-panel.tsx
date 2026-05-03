'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

type SourceType = 'youtube' | 'x' | 'article' | 'pdf' | 'paste' | 'file' | 'folder'
type SourceStatus =
  | 'captured'
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
    case 'article': return 'Article'
    case 'pdf': return 'PDF'
    case 'file': return 'File'
    case 'folder': return 'Folder'
    default: return 'Paste'
  }
}

function statusClass(status: string) {
  if (status === 'ready_for_review' || status === 'summarized') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'credentials_needed' || status === 'blocked') return 'border-amber-400/30 bg-amber-500/10 text-amber-100'
  if (status === 'error') return 'border-red-400/30 bg-red-500/10 text-red-100'
  return 'border-sky-400/30 bg-sky-500/10 text-sky-100'
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => <li key={`${title}-${index}`} className="leading-relaxed">- {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing extracted yet.</p>
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

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mission Control</p>
            <h1 className="mt-1 text-2xl font-semibold">Knowledge Intake</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Capture URLs, pasted notes, and source material into a review queue before anything becomes durable memory.
            </p>
          </div>
          <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Durable writes are approval-gated.
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-4">
          <form onSubmit={submitSource} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Capture Source</h2>
                <p className="text-sm text-muted-foreground">Paste text for full MVP extraction. URLs are captured honestly when adapters need credentials.</p>
              </div>
              <span className={`rounded-md border px-3 py-1 text-xs font-medium ${statusClass('captured')}`}>
                Detected: {sourceBadge(detected)}
              </span>
            </div>

            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              rows={9}
              className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              placeholder="Paste a YouTube/X/article URL, source notes, transcript text, or implementation idea..."
            />

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
              <input
                value={contextNote}
                onChange={event => setContextNote(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Context note: why this matters, who asked, where it belongs"
              />
              <select
                value={projectScope}
                onChange={event => setProjectScope(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option>Mission Control</option>
                <option>Blackwire Ops</option>
                <option>Material Solutions / David</option>
                <option>Marketing</option>
                <option>Research Command</option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting || !content.trim()}>
                {submitting ? 'Capturing...' : 'Capture and Review'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setContent(sampleText)}>
                Use Sample Paste
              </Button>
              <Button type="button" variant="ghost" onClick={() => setContent('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}>
                Try URL Scaffold
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </form>

          {snapshot?.source && extraction ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Review Card</p>
                    <h2 className="mt-1 text-xl font-semibold">{snapshot.source.title}</h2>
                  </div>
                  <span className={`rounded-md border px-3 py-1 text-xs font-medium ${statusClass(snapshot.source.status)}`}>
                    {snapshot.detection?.label} · {snapshot.source.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{extraction.summary}</p>
                <div className="mt-4 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                  <p><span className="text-foreground">Raw path:</span> {snapshot.source.raw_path}</p>
                  {snapshot.source.extracted_text_path && <p className="mt-1"><span className="text-foreground">Extracted path:</span> {snapshot.source.extracted_text_path}</p>}
                  {snapshot.source.error && <p className="mt-2 text-amber-200">{snapshot.source.error}</p>}
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <SectionList title="Key Ideas" items={extraction.key_ideas} />
                <SectionList title="Tools / Tech Mentioned" items={extraction.tools_mentioned} />
                <SectionList title="Implementation Steps" items={extraction.implementation_steps} />
                <SectionList title="Claims To Verify" items={extraction.claims_to_verify} />
              </div>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">Recommended Destinations</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {extraction.recommended_destinations.map(destination => (
                    <Button key={destination} type="button" variant="outline" size="sm" onClick={() => requestAction(destination)}>
                      Request approval: {destination}
                    </Button>
                  ))}
                </div>
                {actionMessage && <p className="mt-3 text-sm text-amber-100">{actionMessage}</p>}
              </section>
            </div>
          ) : (
            <section className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
              <h2 className="text-lg font-semibold">No source selected yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Capture pasted source text for full review-card output, or capture a URL as an honest scaffold.</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Guardrails</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              {(snapshot?.guardrails || []).map(item => <li key={item}>- {item}</li>)}
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Action Gates</h2>
            <div className="mt-3 space-y-2">
              {(snapshot?.gates || []).map(gate => (
                <div key={gate.action} className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{gate.action}</p>
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${gate.status === 'available' ? 'bg-emerald-500/15 text-emerald-200' : gate.status === 'approval_required' ? 'bg-amber-500/15 text-amber-100' : 'bg-red-500/15 text-red-100'}`}>
                      {gate.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{gate.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Recent Sources</h2>
            <div className="mt-3 space-y-3">
              {recent.length > 0 ? recent.map(source => (
                <div key={source.id} className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{source.title}</p>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${statusClass(source.status)}`}>{sourceBadge(source.source_type)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTime(source.captured_at)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{source.raw_path}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">No captured sources yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
