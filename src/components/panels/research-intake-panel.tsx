'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { createClientLogger } from '@/lib/client-logger'
import { getAgentProfile } from '@/lib/agent-roster'

const log = createClientLogger('ResearchIntakePanel')

interface ResearchJob {
  id: string
  task_id: number
  url: string
  notes?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  created_at: number
  completed_at?: number
  notification_error?: string
  result?: {
    title?: string
    summary?: string
    key_points?: string[]
    error?: string
  }
}

export function ResearchIntakePanel() {
  const t = useTranslations('researchIntake')
  const mrBlancProfile = getAgentProfile('mrblanc')
  
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<ResearchJob[]>([])
  const [isPolling, setIsPolling] = useState(false)

  // Fetch recent jobs on mount and poll for updates
  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/research/intake?limit=10')
      if (response.ok) {
        const data = await response.json()
        setRecentJobs(data.jobs || [])
      }
    } catch (err) {
      log.error('Failed to fetch jobs:', err)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll for updates when there are processing jobs
  useEffect(() => {
    const hasProcessingJobs = recentJobs.some(j => j.status === 'pending' || j.status === 'processing')
    
    if (hasProcessingJobs && !isPolling) {
      setIsPolling(true)
      const interval = setInterval(fetchJobs, 5000) // Poll every 5 seconds
      return () => {
        clearInterval(interval)
        setIsPolling(false)
      }
    }
  }, [recentJobs, isPolling, fetchJobs])

  // URL validation
  const isValidUrl = (str: string) => {
    try {
      const parsed = new URL(str.trim())
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  // Detect content type from URL
  const getUrlType = (urlStr: string): 'youtube' | 'x' | 'generic' => {
    try {
      const parsed = new URL(urlStr.trim())
      const host = parsed.hostname.toLowerCase()
      if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
      if (host.includes('twitter.com') || host.includes('x.com')) return 'x'
      return 'generic'
    } catch {
      return 'generic'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError(t('errorUrlRequired'))
      return
    }
    
    if (!isValidUrl(trimmedUrl)) {
      setError(t('errorInvalidUrl'))
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/research/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          notes: notes.trim() || undefined,
          assigned_to: 'mrblanc'
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || t('errorSubmitFailed'))
      }

      if (data.job?.notified === false) {
        setSuccess(t('successSubmittedNoNotify'))
      } else {
        setSuccess(t('successSubmitted'))
      }
      setUrl('')
      setNotes('')
      
      // Refresh jobs list
      fetchJobs()
    } catch (err) {
      log.error('Failed to submit research request:', err)
      setError(err instanceof Error ? err.message : t('errorSubmitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusTone = (job: ResearchJob): 'teal' | 'amber' | 'rose' | 'dim' => {
    if (job.notification_error) return 'amber'

    switch (job.status) {
      case 'completed':
        return 'teal'
      case 'processing':
        return 'amber'
      case 'error':
        return 'rose'
      default:
        return 'dim'
    }
  }

  const getStatusLabel = (job: ResearchJob) => {
    if (job.notification_error) return 'notify failed'
    return job.status
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const urlType = url ? getUrlType(url) : null
  const pendingCount = recentJobs.filter(job => job.status === 'pending').length
  const processingCount = recentJobs.filter(job => job.status === 'processing').length
  const completedCount = recentJobs.filter(job => job.status === 'completed').length
  const errorCount = recentJobs.filter(job => job.status === 'error').length
  const notificationIssues = recentJobs.filter(job => Boolean(job.notification_error)).length

  return (
    <Page
      kicker="Blackwire Ops / Research Intake"
      title={t('title')}
      subtitle={t('subtitle', { agent: mrBlancProfile.displayName })}
      badges={
        <>
          <Chip tone="teal">local queue</Chip>
          <Chip tone={isPolling ? 'teal' : 'dim'} pulse={isPolling}>{isPolling ? 'polling' : 'standby'}</Chip>
          <Chip tone="amber">human review</Chip>
          {notificationIssues > 0 && <Chip tone="amber">notify caveat {notificationIssues}</Chip>}
        </>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Research intake boundary">
          This route stages source research for local review and Mr. Blanc assignment. It does not publish, send customer messages, or write durable memory.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat label="recent requests" value={recentJobs.length} sub="last queue pull" glow />
          <Stat label="pending" value={pendingCount} sub="awaiting worker" accent={pendingCount > 0 ? 'amber' : 'dim'} />
          <Stat label="processing" value={processingCount} sub={isPolling ? 'live polling' : 'idle'} accent={processingCount > 0 ? 'amber' : 'dim'} />
          <Stat label="completed" value={completedCount} sub="ready to review" accent="teal" />
          <Stat label="issues" value={errorCount + notificationIssues} sub="errors / notify" accent={errorCount + notificationIssues > 0 ? 'rose' : 'dim'} />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <HudPanel
            kicker="source request"
            title="Capture Research Request"
            right={<Chip tone="purple">Mr. Blanc</Chip>}
            glow
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-1)]">
                  {t('urlLabel')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(null) }}
                    placeholder={t('urlPlaceholder')}
                    className="w-full border border-[color:var(--mc-hairline-2)] bg-black/30 px-4 py-3 pr-28 font-mono text-sm text-[color:var(--mc-ink-0)] outline-none transition-colors placeholder:text-[color:var(--mc-ink-3)] focus:border-[color:var(--mc-teal)]/70 focus:shadow-[0_0_18px_rgba(46,230,214,0.10)]"
                  />
                  {urlType && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Chip tone={urlType === 'youtube' ? 'rose' : urlType === 'x' ? 'teal' : 'neutral'}>{urlType === 'generic' ? 'url' : urlType}</Chip>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                  {t('urlHint')}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-1)]">
                  {t('notesLabel')} <span className="text-[color:var(--mc-ink-3)]">({t('optional')})</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notesPlaceholder')}
                  rows={5}
                  className="w-full resize-y border border-[color:var(--mc-hairline-2)] bg-black/30 px-4 py-3 text-sm leading-6 text-[color:var(--mc-ink-0)] outline-none transition-colors placeholder:text-[color:var(--mc-ink-3)] focus:border-[color:var(--mc-teal)]/70 focus:shadow-[0_0_18px_rgba(46,230,214,0.10)]"
                />
              </div>

              {error && (
                <BoundaryBanner tone="rose" title="Submission blocked">
                  {error}
                </BoundaryBanner>
              )}
              {success && (
                <BoundaryBanner tone="teal" title="Request staged">
                  {success}
                </BoundaryBanner>
              )}

              <button
                type="submit"
                disabled={submitting || !url.trim()}
                className="mc-btn-glitch inline-flex w-full items-center justify-center border border-[color:var(--mc-teal)]/60 bg-[rgba(46,230,214,0.14)] px-3 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mc-teal-soft)] shadow-[0_0_18px_rgba(46,230,214,0.12)] transition-colors hover:border-[color:var(--mc-teal)] disabled:cursor-not-allowed disabled:border-[color:var(--mc-hairline)] disabled:bg-white/[0.035] disabled:text-[color:var(--mc-ink-3)] disabled:shadow-none"
              >
                {submitting ? t('submitting') : t('submitButton', { agent: mrBlancProfile.displayName })}
              </button>
            </form>
          </HudPanel>

          <div className="space-y-4">
            <HudPanel
              kicker="queue"
              title={t('recentJobs')}
              right={
                <button
                  type="button"
                  onClick={fetchJobs}
                  className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)] transition-colors hover:text-[color:var(--mc-teal-soft)]"
                >
                  refresh
                </button>
              }
            >
              {recentJobs.length === 0 ? (
                <div className="border border-dashed border-[color:var(--mc-hairline-2)] bg-black/20 p-4 text-sm text-[color:var(--mc-ink-2)]">
                  No research requests are staged in the local queue.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentJobs.map(job => (
                    <div
                      key={job.id}
                      className="border border-[color:var(--mc-hairline)] bg-black/20 p-3 transition-colors hover:border-[color:var(--mc-hairline-2)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-[color:var(--mc-ink-0)]">{job.url}</div>
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-3)]">
                            task #{job.task_id} / {formatTimeAgo(job.created_at)}
                          </div>
                        </div>
                        <Chip tone={getStatusTone(job)} pulse={job.status === 'processing'}>
                          {getStatusLabel(job)}
                        </Chip>
                      </div>

                      {job.notes && (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">{job.notes}</p>
                      )}
                      {job.notification_error && (
                        <p className="mt-2 text-xs leading-5 text-[color:var(--mc-amber)]">
                          Could not notify Axis: {job.notification_error.slice(0, 80)}...
                        </p>
                      )}
                      {job.result?.title && (
                        <div className="mt-3 border-t border-[color:var(--mc-hairline)] pt-3">
                          <p className="text-sm font-semibold text-[color:var(--mc-ink-0)]">{job.result.title}</p>
                          {job.result.summary && (
                            <p className="mt-1 line-clamp-3 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                              {job.result.summary}
                            </p>
                          )}
                          {job.result.key_points && job.result.key_points.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                              {job.result.key_points.slice(0, 3).map((point, i) => (
                                <li key={i}>- {point}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {job.result?.error && (
                        <p className="mt-2 text-xs leading-5 text-[color:var(--mc-rose)]">
                          Error: {job.result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </HudPanel>

            <HudPanel kicker="workflow" title={t('howItWorks')}>
              <ol className="space-y-2 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                <li><span className="font-mono text-[color:var(--mc-teal)]">01</span> {t('step1')}</li>
                <li><span className="font-mono text-[color:var(--mc-teal)]">02</span> {t('step2', { agent: mrBlancProfile.displayName })}</li>
                <li><span className="font-mono text-[color:var(--mc-teal)]">03</span> Results stay review-bound before memory or downstream use.</li>
              </ol>
            </HudPanel>
          </div>
        </div>
      </div>
    </Page>
  )
}
