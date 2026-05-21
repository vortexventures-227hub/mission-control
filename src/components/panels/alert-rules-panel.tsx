'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'

interface AlertRule {
  id: number
  name: string
  description: string | null
  enabled: number
  entity_type: string
  condition_field: string
  condition_operator: string
  condition_value: string
  action_type: string
  action_config: string
  cooldown_minutes: number
  last_triggered_at: number | null
  trigger_count: number
  created_by: string
  created_at: number
  updated_at: number
}

interface EvalResult {
  rule_id: number
  rule_name: string
  triggered: boolean
  reason?: string
}

const ENTITY_FIELDS: Record<string, string[]> = {
  agent: ['status', 'role', 'name', 'last_seen', 'last_activity'],
  task: ['status', 'priority', 'assigned_to', 'title'],
  session: ['status'],
  activity: ['type', 'actor', 'entity_type'],
}

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '!=' },
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'contains', label: 'contains' },
  { value: 'count_above', label: 'count >' },
  { value: 'count_below', label: 'count <' },
  { value: 'age_minutes_above', label: 'age (min) >' },
]

const ENTITY_TONES: Record<string, 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim'> = {
  agent: 'purple',
  task: 'teal',
  session: 'teal',
  activity: 'amber',
}

export function AlertRulesPanel() {
  const t = useTranslations('alertRules')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts')
      const data = await res.json()
      setRules(data.rules || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const toggleRule = async (rule: AlertRule) => {
    await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, enabled: rule.enabled ? 0 : 1 }),
    })
    fetchRules()
  }

  const deleteRule = async (id: number) => {
    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchRules()
  }

  const evaluateAll = async () => {
    setEvaluating(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate' }),
      })
      const data = await res.json()
      setEvalResults(data.results || [])
    } catch { /* ignore */ }
    setEvaluating(false)
    fetchRules() // refresh trigger counts
  }

  const enabledCount = rules.filter(r => r.enabled).length
  const totalTriggers = rules.reduce((sum, r) => sum + r.trigger_count, 0)

  return (
    <Page
      kicker="Blackwire Ops / Alert Rules"
      title={t('title')}
      subtitle={t('description')}
      badges={
        <>
          <Chip tone="amber">local notification rules</Chip>
          <Chip tone="dim">operator controlled</Chip>
          {enabledCount > 0 && <Chip tone="teal" pulse>{enabledCount} active</Chip>}
        </>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={evaluateAll}
            disabled={evaluating || rules.length === 0}
            variant="secondary"
            size="sm"
            className="flex items-center gap-1.5 border-[color:var(--mc-hairline-2)] font-mono text-[10px] uppercase tracking-[0.12em]"
          >
            {evaluating ? (
              <>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                {t('evaluating')}
              </>
            ) : (
              <>
                <PlayIcon />
                {t('evaluateNow')}
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowCreate(!showCreate)}
            size="sm"
            className="border-[color:var(--mc-hairline-2)] font-mono text-[10px] uppercase tracking-[0.12em]"
          >
            {t('newRule')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Alert boundary">
          Rules evaluate local Mission Control entities and create internal notifications. External sends stay blocked unless a separate approved integration handles them.
        </BoundaryBanner>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t('statTotalRules')} value={rules.length} sub="configured" />
        <Stat label={t('statActive')} value={enabledCount} sub="enabled now" accent={enabledCount > 0 ? 'teal' : 'dim'} glow={enabledCount > 0} />
        <Stat label={t('statTotalTriggers')} value={totalTriggers} sub="lifetime triggers" accent={totalTriggers > 0 ? 'amber' : 'dim'} />
      </div>

      {/* Eval Results */}
      {evalResults && (
        <HudPanel kicker="manual evaluation" title={t('evalResultsTitle')}>
          <div className="flex items-center justify-between mb-3">
            <Button onClick={() => setEvalResults(null)} variant="ghost" size="xs">
              {t('dismiss')}
            </Button>
          </div>
          <div className="space-y-1.5">
            {evalResults.map(r => (
              <div key={r.rule_id} className={`flex items-center justify-between border px-3 py-1.5 font-mono text-[11px] ${
                r.triggered ? 'border-[color:var(--mc-rose)]/40 bg-[rgba(255,85,119,0.10)]' : 'border-[color:var(--mc-hairline)] bg-black/20'
              }`}>
                <span className="font-medium text-[color:var(--mc-ink-0)]">{r.rule_name}</span>
                <span className={r.triggered ? 'font-medium text-[color:var(--mc-rose)]' : 'text-[color:var(--mc-ink-2)]'}>
                  {r.triggered ? t('triggered') : r.reason}
                </span>
              </div>
            ))}
            {evalResults.length === 0 && (
              <div className="py-2 text-center text-xs text-[color:var(--mc-ink-2)]">{t('noRulesToEvaluate')}</div>
            )}
          </div>
        </HudPanel>
      )}

      {/* Create Form */}
      {showCreate && (
        <CreateRuleForm onCreated={() => { fetchRules(); setShowCreate(false) }} onCancel={() => setShowCreate(false)} />
      )}

      {/* Rules List */}
      {loading ? (
        <HudPanel><div className="py-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">{t('loadingRules')}</div></HudPanel>
      ) : rules.length === 0 ? (
        <HudPanel kicker="standby" title={t('noRulesConfigured')}>
          <div className="py-8 text-center">
            <div className="mb-2 text-3xl opacity-40">&#9888;</div>
            <p className="text-sm text-[color:var(--mc-ink-1)]">{t('noRulesConfigured')}</p>
            <p className="mt-1 text-xs text-[color:var(--mc-ink-2)]">{t('createRuleHint')}</p>
          </div>
        </HudPanel>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onToggle={() => toggleRule(rule)} onDelete={() => deleteRule(rule.id)} />
          ))}
        </div>
      )}
      </div>
    </Page>
  )
}

function RuleCard({ rule, onToggle, onDelete }: { rule: AlertRule; onToggle: () => void; onDelete: () => void }) {
  const t = useTranslations('alertRules')
  const operator = OPERATORS.find(o => o.value === rule.condition_operator)
  const lastTriggered = rule.last_triggered_at
    ? new Date(rule.last_triggered_at * 1000).toLocaleString()
    : t('never')

  return (
    <HudPanel className={rule.enabled ? '' : 'opacity-60'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Chip tone={ENTITY_TONES[rule.entity_type] || 'neutral'}>{rule.entity_type}</Chip>
            <Chip tone={rule.enabled ? 'teal' : 'dim'}>{rule.enabled ? 'enabled' : 'disabled'}</Chip>
            <h3 className="truncate font-mono text-sm font-black uppercase tracking-[0.1em] text-[color:var(--mc-ink-0)]">{rule.name}</h3>
          </div>
          {rule.description && (
            <p className="mt-2 truncate text-xs text-[color:var(--mc-ink-1)]">{rule.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] text-[color:var(--mc-ink-2)]">
            <span className="border border-[color:var(--mc-hairline)] bg-black/20 px-1.5 py-0.5">
              {rule.condition_field} {operator?.label || rule.condition_operator} {rule.condition_value}
            </span>
            <span>{t('cooldown', { minutes: rule.cooldown_minutes })}</span>
            <span>{t('triggerCount', { count: rule.trigger_count })}</span>
            <span>{t('lastTriggered', { time: lastTriggered })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggle}
            className={`w-10 h-5 rounded-full transition-smooth relative ${
              rule.enabled ? 'bg-green-500' : 'bg-muted'
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              rule.enabled ? 'left-5.5 right-0.5' : 'left-0.5'
            }`} style={{ left: rule.enabled ? '22px' : '2px' }} />
          </button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            title={t('deleteRule')}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 4h10M6 4V3h4v1M5 4v8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4" />
            </svg>
          </Button>
        </div>
      </div>
    </HudPanel>
  )
}

function CreateRuleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const t = useTranslations('alertRules')
  const [form, setForm] = useState({
    name: '',
    description: '',
    entity_type: 'agent',
    condition_field: 'status',
    condition_operator: 'equals',
    condition_value: '',
    cooldown_minutes: 60,
    recipient: 'system',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fields = ENTITY_FIELDS[form.entity_type] || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          entity_type: form.entity_type,
          condition_field: form.condition_field,
          condition_operator: form.condition_operator,
          condition_value: form.condition_value,
          cooldown_minutes: form.cooldown_minutes,
          action_type: 'notification',
          action_config: { recipient: form.recipient },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('failedToCreate'))
        return
      }
      onCreated()
    } catch {
      setError(t('networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HudPanel kicker="rule builder" title={t('newRuleTitle')} glow>
      <form onSubmit={handleSubmit} className="space-y-3">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('ruleName')}</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder={t('ruleNamePlaceholder')}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('ruleDescription')}</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={t('optionalDescription')}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('entity')}</label>
          <select
            value={form.entity_type}
            onChange={e => setForm({ ...form, entity_type: e.target.value, condition_field: ENTITY_FIELDS[e.target.value]?.[0] || 'status' })}
            className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="agent">{t('entityAgent')}</option>
            <option value="task">{t('entityTask')}</option>
            <option value="session">{t('entitySession')}</option>
            <option value="activity">{t('entityActivity')}</option>
          </select>
        </div>
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('field')}</label>
          <select
            value={form.condition_field}
            onChange={e => setForm({ ...form, condition_field: e.target.value })}
            className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('operator')}</label>
          <select
            value={form.condition_operator}
            onChange={e => setForm({ ...form, condition_operator: e.target.value })}
            className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('value')}</label>
          <input
            type="text"
            value={form.condition_value}
            onChange={e => setForm({ ...form, condition_value: e.target.value })}
            placeholder={t('valuePlaceholder')}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('cooldownMinutes')}</label>
          <input
            type="number"
            value={form.cooldown_minutes}
            onChange={e => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 60 })}
            min={1}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-2xs text-muted-foreground mb-1">{t('notifyRecipient')}</label>
          <input
            type="text"
            value={form.recipient}
            onChange={e => setForm({ ...form, recipient: e.target.value })}
            placeholder="system"
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={saving}
          size="sm"
        >
          {saving ? t('creating') : t('createRule')}
        </Button>
      </div>
      </form>
    </HudPanel>
  )
}

function PlayIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2l10 6-10 6V2z" />
    </svg>
  )
}
