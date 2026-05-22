'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'

interface EnvVarInfo {
  redacted: string
  set: boolean
}

interface Integration {
  id: string
  name: string
  category: string
  categoryLabel: string
  envVars: Record<string, EnvVarInfo>
  status: 'connected' | 'partial' | 'not_configured'
  vaultItem: string | null
  testable: boolean
  recommendation?: string | null
}

interface Category {
  id: string
  label: string
}

export function IntegrationsPanel() {
  const t = useTranslations('integrations')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [opAvailable, setOpAvailable] = useState(false)
  const [envPath, setEnvPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('ai')

  // Edits: integration id -> env var key -> new value
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState<string | null>(null) // integration id being tested
  const [pulling, setPulling] = useState<string | null>(null) // integration id being pulled
  const [pullingAll, setPullingAll] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{ integrationId: string; keys: string[] } | null>(null)

  const showFeedback = (ok: boolean, text: string) => {
    setFeedback({ ok, text })
    setTimeout(() => setFeedback(null), 3000)
  }

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations')
      if (res.status === 401 || res.status === 403) {
        setError('Admin access required')
        return
      }
      if (!res.ok) {
        setError('Failed to load integrations')
        return
      }
      const data = await res.json()
      setIntegrations(data.integrations || [])
      setCategories(data.categories || [])
      setOpAvailable(data.opAvailable ?? false)
      setEnvPath(data.envPath ?? null)
      if (data.categories?.[0]) {
        setActiveCategory(prev => {
          // Keep current if valid, otherwise default to first
          const ids = (data.categories as Category[]).map((c: Category) => c.id)
          return ids.includes(prev) ? prev : ids[0]
        })
      }
    } catch {
      setError('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchIntegrations() }, [fetchIntegrations])

  const handleEdit = (envKey: string, value: string) => {
    setEdits(prev => ({ ...prev, [envKey]: value }))
  }

  const cancelEdit = (envKey: string) => {
    setEdits(prev => {
      const next = { ...prev }
      delete next[envKey]
      return next
    })
  }

  const toggleReveal = (envKey: string) => {
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(envKey)) next.delete(envKey)
      else next.add(envKey)
      return next
    })
  }

  const hasChanges = Object.keys(edits).length > 0

  const handleSave = async () => {
    if (!hasChanges) return
    setSaving(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars: edits }),
      })
      const data = await res.json()
      if (res.ok) {
        showFeedback(true, `Saved ${data.count} variable${data.count === 1 ? '' : 's'}`)
        setEdits({})
        setRevealed(new Set())
        fetchIntegrations()
      } else {
        showFeedback(false, data.error || 'Failed to save')
      }
    } catch {
      showFeedback(false, 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setEdits({})
    setRevealed(new Set())
  }

  const handleRemove = async (envKeys: string[]) => {
    try {
      const res = await fetch(`/api/integrations?keys=${encodeURIComponent(envKeys.join(','))}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        showFeedback(true, `Removed ${data.count} variable${data.count === 1 ? '' : 's'}`)
        fetchIntegrations()
      } else {
        showFeedback(false, data.error || 'Failed to remove')
      }
    } catch {
      showFeedback(false, 'Network error')
    }
  }

  const handleTest = async (integrationId: string) => {
    setTesting(integrationId)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', integrationId }),
      })
      const data = await res.json()
      if (data.ok) {
        showFeedback(true, data.detail || 'Connection successful')
      } else {
        showFeedback(false, data.detail || data.error || 'Test failed')
      }
    } catch {
      showFeedback(false, 'Network error')
    } finally {
      setTesting(null)
    }
  }

  const handlePull = async (integrationId: string) => {
    setPulling(integrationId)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', integrationId }),
      })
      const data = await res.json()
      if (data.ok) {
        showFeedback(true, data.detail || 'Pulled from 1Password')
        fetchIntegrations()
      } else {
        showFeedback(false, data.error || 'Pull failed')
      }
    } catch {
      showFeedback(false, 'Network error')
    } finally {
      setPulling(null)
    }
  }

  const handlePullAll = async () => {
    setPullingAll(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull-all', category: activeCategory }),
      })
      const data = await res.json()
      if (data.ok) {
        showFeedback(true, data.detail || 'Pulled from 1Password')
        fetchIntegrations()
      } else {
        showFeedback(false, data.error || 'Pull failed')
      }
    } catch {
      showFeedback(false, 'Network error')
    } finally {
      setPullingAll(false)
    }
  }

  const confirmAndRemove = (integrationId: string, keys: string[]) => {
    setConfirmRemove({ integrationId, keys })
  }

  // Loading state
  if (loading) {
    return (
      <Page title={t('title')} kicker="Blackwire Ops / Integration Vault" subtitle={t('loading')}>
        <HudPanel>
          <div className="flex min-h-48 items-center justify-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--mc-teal)] border-t-transparent" />
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">{t('loading')}</span>
          </div>
        </HudPanel>
      </Page>
    )
  }

  // Error state
  if (error) {
    return (
      <Page title={t('title')} kicker="Blackwire Ops / Integration Vault" subtitle="Admin credential boundary">
        <BoundaryBanner tone="rose" title="Integrations unavailable">
          {error}
        </BoundaryBanner>
      </Page>
    )
  }

  const filteredIntegrations = integrations.filter(i => i.category === activeCategory)
  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const partialCount = integrations.filter(i => i.status === 'partial').length
  const missingCount = integrations.filter(i => i.status === 'not_configured').length

  return (
    <Page
      kicker="Blackwire Ops / Integration Vault"
      title={t('title')}
      subtitle={
        <>
          {t('connectedCount', { connected: connectedCount, total: integrations.length })}
          {envPath && <span className="ml-2 font-mono text-[color:var(--mc-ink-3)]">{envPath}</span>}
        </>
      }
      badges={
        <>
          <Chip tone={opAvailable ? 'teal' : 'dim'}>{opAvailable ? '1Password CLI ready' : '1Password unavailable'}</Chip>
          <Chip tone="amber">credential mutation boundary</Chip>
          {hasChanges && <Chip tone="amber" pulse>{Object.keys(edits).length} unsaved</Chip>}
        </>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {opAvailable && (
            <>
              <Button
                onClick={handlePullAll}
                disabled={pullingAll}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-[color:var(--mc-hairline-2)] font-mono text-[10px] uppercase tracking-[0.12em]"
                title="Pull all vault-backed integrations in this category from 1Password"
              >
                {pullingAll ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v8M5 7l3 3 3-3" />
                    <path d="M3 12v2h10v-2" />
                  </svg>
                )}
                {t('pullAll')}
              </Button>
            </>
          )}
          {hasChanges && (
            <Button
              onClick={handleDiscard}
              variant="outline"
              size="sm"
            >
              {t('discard')}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            variant={hasChanges ? 'default' : 'secondary'}
            size="sm"
            className={`border-[color:var(--mc-hairline-2)] font-mono text-[10px] uppercase tracking-[0.12em] ${!hasChanges ? 'cursor-not-allowed' : ''}`}
          >
            {saving ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Credential boundary">
          Integration values write to local environment state and may unlock external services. Test status is visibility only; credentials stay redacted unless explicitly edited.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Connected" value={connectedCount} sub={`${integrations.length} total`} accent={connectedCount > 0 ? 'teal' : 'dim'} glow={connectedCount > 0} />
          <Stat label="Partial" value={partialCount} sub="needs keys" accent={partialCount > 0 ? 'amber' : 'dim'} />
          <Stat label="Missing" value={missingCount} sub="not configured" accent={missingCount > 0 ? 'rose' : 'teal'} glow={missingCount > 0} />
          <Stat label="Categories" value={categories.length} sub="integration groups" />
        </section>

      {/* Feedback */}
      {feedback && (
        <div className={`border p-3 text-xs font-medium ${
          feedback.ok ? 'border-[color:var(--mc-teal)]/40 bg-[rgba(46,230,214,0.10)] text-[color:var(--mc-teal-soft)]' : 'border-[color:var(--mc-rose)]/40 bg-[rgba(255,85,119,0.10)] text-[color:var(--mc-rose)]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--mc-hairline)] pb-px">
        {categories.map(cat => {
          const catIntegrations = integrations.filter(i => i.category === cat.id)
          const catConnected = catIntegrations.filter(i => i.status === 'connected').length
          return (
            <Button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              variant="ghost"
              size="sm"
              className={`relative whitespace-nowrap rounded-b-none rounded-t-md font-mono text-[10px] uppercase tracking-[0.12em] ${
                activeCategory === cat.id
                  ? 'border border-[color:var(--mc-hairline-2)] border-b-[color:var(--mc-bg-2)] bg-[color:var(--mc-bg-2)] text-[color:var(--mc-ink-0)] -mb-px'
                  : ''
              }`}
            >
              {cat.label}
              {catConnected > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 text-2xs rounded-full bg-green-500/15 text-green-400 px-1">
                  {catConnected}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {filteredIntegrations.map(integration => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            edits={edits}
            revealed={revealed}
            opAvailable={opAvailable}
            testing={testing === integration.id}
            pulling={pulling === integration.id}
            onEdit={handleEdit}
            onCancelEdit={cancelEdit}
            onToggleReveal={toggleReveal}
            onTest={() => handleTest(integration.id)}
            onPull={() => handlePull(integration.id)}
            onRemove={() => {
              const setKeys = Object.entries(integration.envVars)
                .filter(([, v]) => v.set)
                .map(([k]) => k)
              if (setKeys.length > 0) confirmAndRemove(integration.id, setKeys)
            }}
          />
        ))}
        {filteredIntegrations.length === 0 && (
          <HudPanel kicker="standby" title={t('noIntegrationsInCategory')}>
            <div className="py-8 text-center text-sm text-[color:var(--mc-ink-2)]">
              {t('noIntegrationsInCategory')}
            </div>
          </HudPanel>
        )}
      </div>

      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 z-40">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-foreground">
            {Object.keys(edits).length} unsaved change{Object.keys(edits).length === 1 ? '' : 's'}
          </span>
          <Button
            onClick={handleDiscard}
            variant="ghost"
            size="xs"
          >
            {t('discard')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="xs"
          >
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      )}

      {/* Remove confirmation dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl p-5 max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t('removeTitle')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('removeDescription', {
                target: confirmRemove.keys.length === 1 ? confirmRemove.keys[0] : String(confirmRemove.keys.length)
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setConfirmRemove(null)}
                variant="outline"
                size="sm"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => {
                  handleRemove(confirmRemove.keys)
                  setConfirmRemove(null)
                }}
                variant="destructive"
                size="sm"
              >
                {t('remove')}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Page>
  )
}

// ---------------------------------------------------------------------------
// Integration card component
// ---------------------------------------------------------------------------

function IntegrationCard({
  integration,
  edits,
  revealed,
  opAvailable,
  testing,
  pulling,
  onEdit,
  onCancelEdit,
  onToggleReveal,
  onTest,
  onPull,
  onRemove,
}: {
  integration: Integration
  edits: Record<string, string>
  revealed: Set<string>
  opAvailable: boolean
  testing: boolean
  pulling: boolean
  onEdit: (key: string, value: string) => void
  onCancelEdit: (key: string) => void
  onToggleReveal: (key: string) => void
  onTest: () => void
  onPull: () => void
  onRemove: () => void
}) {
  const t = useTranslations('integrations')
  const statusColors = {
    connected: 'bg-green-500',
    partial: 'bg-amber-500',
    not_configured: 'bg-muted-foreground/30',
  }

  const statusTone = {
    connected: 'teal',
    partial: 'amber',
    not_configured: 'dim',
  } as const

  const statusLabels = {
    connected: 'Connected',
    partial: 'Partial',
    not_configured: 'Not configured',
  }

  const hasEdits = Object.keys(integration.envVars).some(k => edits[k] !== undefined)
  const hasSetVars = Object.values(integration.envVars).some(v => v.set)

  return (
    <HudPanel className={hasEdits ? 'mc-bevel-glow' : ''}>
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[integration.status]}`} />
          <span className="font-mono text-sm font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{integration.name}</span>
          <Chip tone={statusTone[integration.status]}>{statusLabels[integration.status]}</Chip>
          {hasEdits && <Chip tone="amber" pulse>edited</Chip>}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Pull from 1Password */}
          {integration.vaultItem && opAvailable && (
            <Button
              onClick={onPull}
              disabled={pulling}
              title="Pull from 1Password"
              variant="outline"
              size="xs"
              className="text-2xs flex items-center gap-1"
            >
              {pulling ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M3 12v2h10v-2" />
                </svg>
              )}
              1P
            </Button>
          )}

          {/* Test connection */}
          {integration.testable && hasSetVars && (
            <Button
              onClick={onTest}
              disabled={testing}
              title="Test connection"
              variant="outline"
              size="xs"
              className="text-2xs flex items-center gap-1"
            >
              {testing ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 3L6 14" />
                  <polyline points="6,3 6,8 1,8" />
                  <polyline points="10,8 15,8 15,13" />
                </svg>
              )}
              Test
            </Button>
          )}

          {/* Remove */}
          {hasSetVars && (
            <Button
              onClick={onRemove}
              title="Remove from .env"
              variant="outline"
              size="xs"
              className="text-2xs hover:text-destructive hover:border-destructive/50"
            >
              {t('remove')}
            </Button>
          )}
        </div>
      </div>

      {/* Env var rows */}
      <div className="space-y-2">
        {Object.entries(integration.envVars).map(([envKey, info]) => {
          const isEditing = edits[envKey] !== undefined
          const isRevealed = revealed.has(envKey)

          return (
            <div key={envKey} className="flex items-center gap-2">
              <span className="text-2xs font-mono text-muted-foreground/70 w-48 truncate shrink-0" title={envKey}>
                {envKey}
              </span>

              <div className="flex-1 flex items-center gap-1.5">
                {isEditing ? (
                  <input
                    type={isRevealed ? 'text' : 'password'}
                    value={edits[envKey]}
                    onChange={e => onEdit(envKey, e.target.value)}
                    placeholder="Enter value..."
                    className="flex-1 px-2 py-1 text-xs bg-background border border-primary/50 rounded focus:border-primary focus:outline-none font-mono"
                    autoComplete="off"
                    data-1p-ignore
                  />
                ) : info.set ? (
                  <span className="text-xs font-mono text-muted-foreground">{info.redacted}</span>
                ) : (
                  <span className="text-xs text-muted-foreground/50 italic">{t('notSet')}</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Reveal toggle (only when editing) */}
                {isEditing && (
                  <Button
                    onClick={() => onToggleReveal(envKey)}
                    title={isRevealed ? 'Hide value' : 'Show value'}
                    variant="ghost"
                    size="icon-xs"
                    className="w-6 h-6"
                  >
                    {isRevealed ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                )}

                {/* Edit button */}
                {!isEditing && (
                  <Button
                    onClick={() => onEdit(envKey, '')}
                    title="Edit value"
                    variant="ghost"
                    size="icon-xs"
                    className="w-6 h-6"
                  >
                    <EditIcon />
                  </Button>
                )}

                {/* Cancel edit */}
                {isEditing && (
                  <Button
                    onClick={() => onCancelEdit(envKey)}
                    title="Cancel edit"
                    variant="ghost"
                    size="icon-xs"
                    className="w-6 h-6 hover:text-destructive"
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {integration.recommendation && (
        <div className="mt-3 rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2">
          <p className="text-2xs text-muted-foreground">{integration.recommendation}</p>
          {integration.id === 'x_twitter' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-2xs">
              <a
                href="https://github.com/0xNyk/xint"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                github.com/0xNyk/xint
              </a>
              <a
                href="https://github.com/0xNyk/xint-rs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                github.com/0xNyk/xint-rs
              </a>
            </div>
          )}
        </div>
      )}
    </HudPanel>
  )
}

// ---------------------------------------------------------------------------
// Inline SVG icons (matching nav-rail pattern: 16x16, stroke-based)
// ---------------------------------------------------------------------------

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l12 12" />
      <path d="M6.5 6.5a2 2 0 002.8 2.8" />
      <path d="M4.2 4.2C2.5 5.5 1 8 1 8s2.5 5 7 5c1.3 0 2.4-.4 3.4-1" />
      <path d="M11.8 11.8C13.5 10.5 15 8 15 8s-2.5-5-7-5c-.7 0-1.4.1-2 .3" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}
