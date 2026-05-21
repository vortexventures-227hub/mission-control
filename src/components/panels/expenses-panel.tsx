'use client'

import { useState, useEffect, useCallback } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: number
  amount: number
  currency: string
  category: string
  description: string
  vendor: string | null
  source: string
  agent_id: string | null
  expense_date: number
  is_recurring: number
  recurrence: string | null
}

interface Subscription {
  id: number
  name: string
  vendor: string
  amount: number
  currency: string
  billing_cycle: string
  category: string
  status: string
  next_billing_date: number | null
  notes: string | null
}

interface Summary {
  total: number
  oneOffTotal: number
  byCategory: { category: string; total: number }[]
  recurring: number
  monthlySubscriptions: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

function relDate(ms: number) {
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(ms: number | null) {
  if (!ms) return null
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(ms)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000)
}

function renewalTone(days: number | null): 'ok' | 'soon' | 'due' | 'missing' {
  if (days === null) return 'missing'
  if (days < 0) return 'due'
  if (days <= 7) return 'due'
  if (days <= 30) return 'soon'
  return 'ok'
}

function renewalLabel(days: number | null) {
  if (days === null) return 'Billing date missing'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}

function monthlyEquivalent(sub: Subscription) {
  if (sub.billing_cycle === 'annual') return sub.amount / 12
  return sub.amount
}

const CATEGORY_COLORS: Record<string, string> = {
  ai_api: 'text-violet-400',
  api: 'text-violet-400',
  subscription: 'text-blue-400',
  saas: 'text-blue-400',
  tool: 'text-cyan-400',
  infrastructure: 'text-orange-400',
  other: 'text-muted-foreground',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const RENEWAL_COLORS: Record<ReturnType<typeof renewalTone>, string> = {
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  soon: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  due: 'bg-red-500/10 text-red-400 border-red-500/25',
  missing: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25',
}

// ─── Add Expense Form ─────────────────────────────────────────────────────────

function AddExpenseForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ amount: '', category: 'api', description: '', vendor: '', expense_date: new Date().toISOString().split('T')[0], is_recurring: false, recurrence: 'monthly' })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), expense_date: new Date(form.expense_date).getTime(), is_recurring: form.is_recurring ? 1 : 0 }),
    })
    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={submit} className="p-4 bg-card border border-border rounded-lg space-y-3">
      <h3 className="font-semibold text-sm text-foreground">Add Expense</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Amount (USD)</label>
          <input type="number" step="0.01" required value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
            <option value="api">API</option>
            <option value="subscription">Subscription</option>
            <option value="tool">Tool</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Description</label>
        <input type="text" required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="e.g. Anthropic API usage" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vendor</label>
          <input type="text" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="Anthropic" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Date</label>
          <input type="date" required value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))} className="rounded" />
        <label htmlFor="recurring" className="text-xs text-muted-foreground">Recurring</label>
        {form.is_recurring && (
          <select value={form.recurrence} onChange={e => setForm(p => ({ ...p, recurrence: e.target.value }))}
            className="ml-2 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="weekly">Weekly</option>
          </select>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs">{saving ? <Loader variant="inline" /> : 'Save'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">Cancel</Button>
      </div>
    </form>
  )
}

// ─── Add Subscription Form ────────────────────────────────────────────────────

function AddSubscriptionForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', vendor: '', amount: '', billing_cycle: 'monthly', category: 'ai_api', status: 'active', next_billing_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), next_billing_date: form.next_billing_date ? new Date(form.next_billing_date).getTime() : null }),
    })
    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={submit} className="p-4 bg-card border border-border rounded-lg space-y-3">
      <h3 className="font-semibold text-sm text-foreground">Add Subscription</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name</label>
          <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="Anthropic Max" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vendor</label>
          <input type="text" required value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="Anthropic" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
          <input type="number" step="0.01" required value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Billing Cycle</label>
          <select value={form.billing_cycle} onChange={e => setForm(p => ({ ...p, billing_cycle: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
            <option value="ai_api">AI / API</option>
            <option value="saas">SaaS</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Next Billing Date</label>
          <input type="date" value={form.next_billing_date} onChange={e => setForm(p => ({ ...p, next_billing_date: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
          <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" placeholder="Optional notes" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs">{saving ? <Loader variant="inline" /> : 'Save'}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">Cancel</Button>
      </div>
    </form>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ExpensesPanel() {
  const [tab, setTab] = useState<'overview' | 'subscriptions' | 'one_off'>('subscriptions')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subTotals, setSubTotals] = useState({ monthly: 0, annual: 0 })
  const [loading, setLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddSub, setShowAddSub] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, expRes, subRes] = await Promise.all([
        fetch('/api/expenses?action=summary&days=30'),
        fetch('/api/expenses?days=365&kind=one_off'),
        fetch('/api/subscriptions?status=all'),
      ])
      if (sumRes.ok) setSummary(await sumRes.json())
      if (expRes.ok) { const d = await expRes.json(); setExpenses(d.expenses || []) }
      if (subRes.ok) { const d = await subRes.json(); setSubscriptions(d.subscriptions || []); setSubTotals({ monthly: d.monthlyTotal || 0, annual: d.annualTotal || 0 }) }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function cancelSub(id: number) {
    await fetch(`/api/subscriptions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    fetchAll()
  }

  async function deleteExpense(id: number) {
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchAll()
  }

  const activeSubs = subscriptions.filter(s => s.status === 'active')
  const inactiveSubs = subscriptions.filter(s => s.status !== 'active')
  const upcomingRenewals = activeSubs
    .map((sub) => ({ sub, days: daysUntil(sub.next_billing_date) }))
    .sort((a, b) => (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER))
  const urgentRenewals = upcomingRenewals.filter(({ days }) => {
    const tone = renewalTone(days)
    return tone === 'due' || tone === 'soon' || tone === 'missing'
  })
  const missingBillingDates = upcomingRenewals.filter(({ days }) => days === null).length
  const topMonthlySubs = activeSubs
    .slice()
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
    .slice(0, 5)

  return (
    <Page
      kicker="LEDGER / LOCAL SPEND"
      title="Expense Ledger"
      subtitle="Canonical Mission Control ledger for subscriptions and one-off expenses. Spend data stays in the local app database, with renewal gates visible before anything is treated clean."
      badges={(
        <>
          <Chip tone="teal">LOCAL DB</Chip>
          <Chip tone="amber">RENEWAL GATED</Chip>
          <Chip tone="rose">NO EXTERNAL BILLING MUTATION</Chip>
        </>
      )}
      actions={(
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="h-8 text-xs">
          {loading ? <Loader variant="inline" /> : 'Refresh'}
        </Button>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Monthly Subscriptions" value={loading ? '...' : fmt(subTotals.monthly)} glow />
          <Stat label="One-off 30d" value={loading ? '...' : fmt(summary?.oneOffTotal || 0)} accent="purple" />
          <Stat label="Renewal Gates" value={loading ? '...' : urgentRenewals.length} accent={urgentRenewals.length ? 'amber' : 'teal'} />
          <Stat label="Missing Billing Dates" value={loading ? '...' : missingBillingDates} accent={missingBillingDates ? 'rose' : 'teal'} />
        </div>

        <HudPanel
          kicker="LEDGER VIEW"
          title="Spend command tabs"
          right={<Chip tone="dim">{activeSubs.length} active subs</Chip>}
        >
          <div className="flex flex-wrap gap-2">
            {(['overview', 'subscriptions', 'one_off'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`mc-btn-glitch inline-flex border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${tab === t ? 'border-[color:var(--mc-teal)]/60 bg-[rgba(46,230,214,0.13)] text-[color:var(--mc-teal-soft)]' : 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-2)] hover:border-[color:var(--mc-teal)]/45 hover:text-[color:var(--mc-teal-soft)]'}`}>
                {t === 'one_off' ? 'One-off Expenses' : t === 'subscriptions' ? 'Subscriptions' : 'Overview'}
                {t === 'subscriptions' && activeSubs.length > 0 && <span className="ml-2 text-[color:var(--mc-amber)]">{activeSubs.length}</span>}
              </button>
            ))}
          </div>
          {!loading && (
            <div className="mt-3">
              <BoundaryBanner tone={urgentRenewals.length || missingBillingDates ? 'amber' : 'teal'} title="Ledger boundary">
                {urgentRenewals.length} renewal gate(s) need review; {missingBillingDates} missing billing date(s). This surface tracks local ledger state only and performs no external billing mutation.
              </BoundaryBanner>
            </div>
          )}
        </HudPanel>

        <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader variant="inline" /></div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Monthly Subscriptions', value: fmt(subTotals.monthly), sub: `${fmt(subTotals.annual)}/yr · ${activeSubs.length} active` },
                    { label: 'One-off Expenses (30d)', value: fmt(summary?.oneOffTotal || 0), sub: 'manual/non-recurring ledger' },
                    { label: 'Tracked Monthly Exposure', value: fmt(subTotals.monthly + (summary?.oneOffTotal || 0)), sub: 'active subs + 30d one-offs' },
                    { label: 'Renewal Gates', value: String(urgentRenewals.length), sub: `${missingBillingDates} missing billing dates` },
                  ].map(s => (
                    <div key={s.label} className="p-3 bg-card border border-border rounded-lg">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold text-foreground mt-1">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Active Subscriptions summary */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs font-semibold text-foreground">Renewal Watch</h3>
                    <span className="text-[10px] text-muted-foreground">next 30d + missing dates</span>
                  </div>
                  {urgentRenewals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No renewal gates inside 30 days and no missing billing dates.</p>
                  ) : (
                    <div className="space-y-2">
                      {urgentRenewals.slice(0, 6).map(({ sub, days }) => {
                        const tone = renewalTone(days)
                        return (
                          <div key={sub.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{sub.name}</p>
                              <p className="text-[10px] text-muted-foreground">{sub.vendor} · {fmt(monthlyEquivalent(sub))}/mo equivalent</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RENEWAL_COLORS[tone]}`}>{renewalLabel(days)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Largest Monthly Exposure</h3>
                  {activeSubs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active subscriptions.</p>
                  ) : (
                    <div className="space-y-2">
                      {topMonthlySubs.map(s => (
                        <div key={s.id} className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-medium text-foreground">{s.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.vendor}</span>
                          </div>
                          <span className="text-xs font-mono text-foreground">{fmt(monthlyEquivalent(s))}/mo eq.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-foreground mb-3">Canonical Ledger Boundary</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ['Source', '/api/expenses + /api/subscriptions'],
                      ['Storage', 'Mission Control local DB'],
                      ['Rule', 'No loose ledger files'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-background px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xs font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category breakdown */}
                {summary && summary.byCategory.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-foreground mb-3">By Category (30d Expenses)</h3>
                    <div className="space-y-2">
                      {summary.byCategory.map(c => (
                        <div key={c.category} className="flex items-center justify-between">
                          <span className={`text-xs capitalize ${CATEGORY_COLORS[c.category] || 'text-muted-foreground'}`}>{c.category.replace('_', ' ')}</span>
                          <span className="text-xs font-mono text-foreground">{fmt(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUBSCRIPTIONS TAB */}
            {tab === 'subscriptions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{fmt(subTotals.monthly)}/month · {fmt(subTotals.annual)}/year</p>
                  </div>
                  <Button size="sm" onClick={() => setShowAddSub(v => !v)} className="h-8 text-xs">
                    {showAddSub ? 'Cancel' : '+ Add Subscription'}
                  </Button>
                </div>

                {showAddSub && <AddSubscriptionForm onSave={() => { setShowAddSub(false); fetchAll() }} onCancel={() => setShowAddSub(false)} />}

                {/* Active */}
                <div className="space-y-2">
                  {activeSubs.map(s => (
                    <div key={s.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{s.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.vendor} · {s.category.replace('_', ' ')}</p>
                        {s.next_billing_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">Next billing: {relDate(s.next_billing_date)}</p>
                        )}
                        {!s.next_billing_date && (
                          <p className="text-xs text-amber-400 mt-0.5">Next billing date missing - cannot forecast renewal precisely.</p>
                        )}
                        {s.notes && <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{s.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                        <span className="font-bold text-sm text-foreground">{fmt(s.amount)}</span>
                        <span className="text-[10px] text-muted-foreground">/{s.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RENEWAL_COLORS[renewalTone(daysUntil(s.next_billing_date))]}`}>
                          {renewalLabel(daysUntil(s.next_billing_date))}
                        </span>
                        <button onClick={() => cancelSub(s.id)} className="text-[10px] text-red-400 hover:text-red-300 mt-1">Cancel</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inactive */}
                {inactiveSubs.length > 0 && (
                  <div className="opacity-50 space-y-2">
                    <p className="text-xs text-muted-foreground">Cancelled / Paused</p>
                    {inactiveSubs.map(s => (
                      <div key={s.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-lg">
                        <div>
                          <span className="font-medium text-xs text-foreground">{s.name}</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                          <p className="text-xs text-muted-foreground">{s.vendor}</p>
                        </div>
                        <span className="text-xs font-mono text-foreground">{fmt(s.amount)}/{s.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {subscriptions.length === 0 && !showAddSub && (
                  <p className="text-sm text-muted-foreground text-center py-8">No subscriptions yet. Add one above.</p>
                )}
              </div>
            )}

            {/* ONE-OFF EXPENSES TAB */}
            {tab === 'one_off' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{expenses.length} one-off expenses (last 365 days). Recurring subscriptions belong on the Subscriptions tab.</p>
                  <Button size="sm" onClick={() => setShowAddExpense(v => !v)} className="h-8 text-xs">
                    {showAddExpense ? 'Cancel' : '+ Add Expense'}
                  </Button>
                </div>

                {showAddExpense && <AddExpenseForm onSave={() => { setShowAddExpense(false); fetchAll() }} onCancel={() => setShowAddExpense(false)} />}

                {expenses.length === 0 && !showAddExpense ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No one-off expenses logged in the canonical Mission Control ledger. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {expenses.map(e => (
                      <div key={e.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-lg group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs text-foreground">{e.description}</span>
                            <span className={`text-[10px] capitalize ${CATEGORY_COLORS[e.category] || 'text-muted-foreground'}`}>{e.category.replace('_', ' ')}</span>
                            {e.is_recurring === 1 && <span className="text-[10px] text-blue-400">↺ {e.recurrence}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {e.vendor && `${e.vendor} · `}{relDate(e.expense_date)} · {e.source}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="font-bold text-sm text-foreground">{fmt(e.amount, e.currency)}</span>
                          <button onClick={() => deleteExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-300">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </Page>
  )
}
