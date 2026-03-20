'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { createClientLogger } from '@/lib/client-logger'
import { getAgentProfile } from '@/lib/agent-roster'

const log = createClientLogger('ResearchIntakePanel')

interface ResearchJob {
  id: string
  url: string
  notes?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  created_at: number
  completed_at?: number
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

      setSuccess(t('successSubmitted'))
      setUrl('')
      setNotes('')
      
      // Add to recent jobs
      if (data.job) {
        setRecentJobs(prev => [data.job, ...prev.slice(0, 4)])
      }
    } catch (err) {
      log.error('Failed to submit research request:', err)
      setError(err instanceof Error ? err.message : t('errorSubmitFailed'))
    } finally {
      setSubmitting(false)
    }
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
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('recentJobs')}</h3>
              <div className="space-y-2">
                {recentJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-3 bg-surface-1 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-muted-foreground truncate flex-1 mr-2">
                        {job.url}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                        job.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    {job.notes && (
                      <p className="text-xs text-muted-foreground truncate">{job.notes}</p>
                    )}
                    {job.result?.title && (
                      <p className="text-sm text-foreground mt-1">{job.result.title}</p>
                    )}
                  </div>
                ))}
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
