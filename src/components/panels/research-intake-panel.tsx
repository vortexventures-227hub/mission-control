'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
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

  const getStatusDisplay = (job: ResearchJob) => {
    if (job.notification_error) {
      return {
        className: 'bg-orange-500/20 text-orange-400',
        label: 'Notification Failed',
        icon: '⚠️'
      }
    }
    
    switch (job.status) {
      case 'completed':
        return { className: 'bg-green-500/20 text-green-400', label: 'Completed', icon: '✓' }
      case 'processing':
        return { className: 'bg-yellow-500/20 text-yellow-400', label: 'Processing', icon: '⟳' }
      case 'error':
        return { className: 'bg-red-500/20 text-red-400', label: 'Error', icon: '✗' }
      default:
        return { className: 'bg-gray-500/20 text-gray-400', label: 'Pending', icon: '…' }
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const urlType = url ? getUrlType(url) : null

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${mrBlancProfile.color}20` }}
          >
            {mrBlancProfile.emoji}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('subtitle', { agent: mrBlancProfile.displayName })}
            </p>
          </div>
        </div>
        {isPolling && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="animate-pulse">●</span> Live
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Intake Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('urlLabel')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(null) }}
                  placeholder={t('urlPlaceholder')}
                  className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
                />
                {urlType && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {urlType === 'youtube' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400 font-medium">
                        YouTube
                      </span>
                    )}
                    {urlType === 'x' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-sky-500/20 text-sky-400 font-medium">
                        X/Twitter
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('urlHint')}
              </p>
            </div>

            {/* Notes Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('notesLabel')} <span className="text-muted-foreground font-normal">({t('optional')})</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={3}
                className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors resize-y"
              />
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
                <span>✓</span> {success}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || !url.trim()}
              className="w-full py-3"
              style={{ 
                backgroundColor: submitting ? undefined : mrBlancProfile.color,
                opacity: submitting || !url.trim() ? 0.5 : 1
              }}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span>
                  {t('submitting')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{mrBlancProfile.emoji}</span>
                  {t('submitButton', { agent: mrBlancProfile.displayName })}
                </span>
              )}
            </Button>
          </form>

          {/* Recent Jobs */}
          {recentJobs.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{t('recentJobs')}</h3>
                <button
                  onClick={fetchJobs}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2">
                {recentJobs.map(job => {
                  const statusDisplay = getStatusDisplay(job)
                  return (
                    <div
                      key={job.id}
                      className="p-3 bg-surface-1 rounded-lg border border-border hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-muted-foreground truncate flex-1 mr-2">
                          {job.url}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(job.created_at)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${statusDisplay.className}`}>
                            {job.status === 'processing' && (
                              <span className="animate-spin">{statusDisplay.icon}</span>
                            )}
                            {job.status !== 'processing' && statusDisplay.icon}
                            {statusDisplay.label}
                          </span>
                        </div>
                      </div>
                      {job.notes && (
                        <p className="text-xs text-muted-foreground truncate">{job.notes}</p>
                      )}
                      {job.notification_error && (
                        <p className="text-xs text-orange-400 mt-1">
                          ⚠️ Could not notify Axis: {job.notification_error.slice(0, 50)}...
                        </p>
                      )}
                      {job.result?.title && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-sm font-medium text-foreground">{job.result.title}</p>
                          {job.result.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                              {job.result.summary}
                            </p>
                          )}
                          {job.result.key_points && job.result.key_points.length > 0 && (
                            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                              {job.result.key_points.slice(0, 3).map((point, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-primary">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {job.result?.error && (
                        <p className="text-xs text-red-400 mt-1">
                          Error: {job.result.error}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="mt-6 p-4 bg-surface-1/50 rounded-lg border border-border/50">
            <h4 className="text-sm font-semibold text-foreground mb-2">{t('howItWorks')}</h4>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>{t('step1')}</li>
              <li>{t('step2', { agent: mrBlancProfile.displayName })}</li>
              <li>{t('step3')}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
