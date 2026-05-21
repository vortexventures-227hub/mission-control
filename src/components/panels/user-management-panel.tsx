'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'
import { useMissionControl } from '@/store'

interface UserRecord {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'operator' | 'viewer'
  provider?: 'local' | 'google'
  email?: string | null
  avatar_url?: string | null
  is_approved?: number
  created_at: number
  last_login_at: number | null
}

interface AccessRequest {
  id: number
  provider: string
  email: string
  provider_user_id?: string | null
  display_name?: string | null
  avatar_url?: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: number
  last_attempt_at: number
  attempt_count: number
  reviewed_by?: string | null
  reviewed_at?: number | null
  review_note?: string | null
  approved_user_id?: number | null
}

function roleTone(role: string): 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim' {
  if (role === 'admin') return 'rose'
  if (role === 'operator') return 'teal'
  if (role === 'viewer') return 'dim'
  return 'neutral'
}

export function UserManagementPanel() {
  const t = useTranslations('userManagement')
  const { currentUser } = useMissionControl()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', password: '', display_name: '', role: 'operator' as const })
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', role: '' as '' | 'admin' | 'operator' | 'viewer', password: '' })
  const [saving, setSaving] = useState(false)

  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null)
  const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null)
  const [reviewForm, setReviewForm] = useState<{ role: 'admin' | 'operator' | 'viewer'; note: string }>({ role: 'viewer', note: '' })

  const showFeedback = (ok: boolean, text: string) => {
    setFeedback({ ok, text })
    setTimeout(() => setFeedback(null), 3200)
  }

  const fetchAll = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/auth/users', { cache: 'no-store' }),
        fetch('/api/auth/access-requests?status=all', { cache: 'no-store' }),
      ])

      if (uRes.status === 403 || rRes.status === 403) {
        setError(t('adminAccessRequired'))
        return
      }

      const uJson = await uRes.json().catch(() => ({}))
      const rJson = await rRes.json().catch(() => ({}))

      setUsers(Array.isArray(uJson?.users) ? uJson.users : [])
      setRequests(Array.isArray(rJson?.requests) ? rJson.requests : [])
      setError(null)
    } catch {
      setError(t('failedToLoadUsers'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const pendingRequests = requests.filter((r) => r.status === 'pending')

  const formatDate = (ts: number | null | undefined) => {
    if (!ts) return t('never')
    return new Date(ts * 1000).toLocaleString()
  }

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) return
    setCreating(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showFeedback(true, t('createdUser', { username: createForm.username }))
        setShowCreate(false)
        setCreateForm({ username: '', password: '', display_name: '', role: 'operator' })
        fetchAll()
      } else {
        showFeedback(false, data.error || t('failedToCreate'))
      }
    } catch {
      showFeedback(false, t('networkError'))
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (u: UserRecord) => {
    setEditingId(u.id)
    setEditForm({ display_name: u.display_name, role: u.role, password: '' })
  }

  const handleEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const body: any = { id: editingId }
      if (editForm.display_name) body.display_name = editForm.display_name
      if (editForm.role) body.role = editForm.role
      if (editForm.password) body.password = editForm.password

      const res = await fetch('/api/auth/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showFeedback(true, t('userUpdated'))
        setEditingId(null)
        fetchAll()
      } else {
        showFeedback(false, data.error || t('failedToUpdate'))
      }
    } catch {
      showFeedback(false, t('networkError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: UserRecord) => {
    if (u.id === currentUser?.id) return
    try {
      const res = await fetch(`/api/auth/users?id=${u.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showFeedback(true, t('deletedUser', { username: u.username }))
        fetchAll()
      } else {
        showFeedback(false, data.error || t('failedToDelete'))
      }
    } catch {
      showFeedback(false, t('networkError'))
    }
  }

  const submitReview = async (requestId: number, action: 'approve' | 'reject') => {
    setProcessingRequestId(requestId)
    try {
      const res = await fetch('/api/auth/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          action,
          role: reviewForm.role,
          note: reviewForm.note || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('failedToAction', { action }))
      const req = requests.find(r => r.id === requestId)
      showFeedback(true, t('requestActioned', { action, email: req?.email || t('user') }))
      setReviewingRequestId(null)
      setReviewForm({ role: 'viewer', note: '' })
      await fetchAll()
    } catch (e: any) {
      showFeedback(false, e?.message || t('failedToAction', { action }))
    } finally {
      setProcessingRequestId(null)
    }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <Page title={t('usersTitle')} kicker="Blackwire Ops / Access Control" subtitle={t('adminRequired')}>
        <BoundaryBanner tone="rose" title={t('accessDenied')}>
          {t('adminRequired')}
        </BoundaryBanner>
      </Page>
    )
  }

  if (loading) {
    return (
      <Page title={t('usersTitle')} kicker="Blackwire Ops / Access Control" subtitle={t('loadingUsers')}>
        <HudPanel>
          <div className="flex min-h-48 items-center justify-center gap-3">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--mc-teal)]" />
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">{t('loadingUsers')}</span>
          </div>
        </HudPanel>
      </Page>
    )
  }

  if (error) {
    return (
      <Page title={t('usersTitle')} kicker="Blackwire Ops / Access Control" subtitle={t('usersSummary', { count: users.length, pending: pendingRequests.length })}>
        <BoundaryBanner tone="rose" title="User directory failed to load">
          {error}
        </BoundaryBanner>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Access Control"
      title={t('usersTitle')}
      subtitle={t('usersSummary', { count: users.length, pending: pendingRequests.length })}
      badges={
        <>
          <Chip tone="amber">admin only</Chip>
          <Chip tone="dim">local user directory</Chip>
          {pendingRequests.length > 0 && <Chip tone="amber" pulse>{pendingRequests.length} pending</Chip>}
        </>
      }
      actions={
        <Button
          onClick={() => setShowCreate(!showCreate)}
          size="sm"
          className="border-[color:var(--mc-hairline-2)] font-mono text-[10px] uppercase tracking-[0.12em]"
        >
          {showCreate ? t('cancel') : t('addLocalUser')}
        </Button>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Access mutation boundary">
          User creation, role changes, password resets, request approvals, and deletes are admin-only controls. Treat every action here as audit-sensitive.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Users" value={users.length} sub="approved directory" />
          <Stat label="Pending" value={pendingRequests.length} sub="access requests" accent={pendingRequests.length > 0 ? 'amber' : 'teal'} glow={pendingRequests.length > 0} />
          <Stat label="Admins" value={users.filter((u) => u.role === 'admin').length} sub="privileged" accent="rose" />
          <Stat label="Google" value={users.filter((u) => u.provider === 'google').length} sub="oauth identities" accent="purple" />
        </section>

      {feedback && (
        <div className={`border px-3 py-2 text-sm ${feedback.ok ? 'border-[color:var(--mc-teal)]/40 bg-[rgba(46,230,214,0.10)] text-[color:var(--mc-teal-soft)]' : 'border-[color:var(--mc-rose)]/40 bg-[rgba(255,85,119,0.10)] text-[color:var(--mc-rose)]'}`}>
          {feedback.text}
        </div>
      )}

      {pendingRequests.length > 0 && (
        <HudPanel kicker="access gate" title={t('pendingRequests', { count: pendingRequests.length })} right={<Chip tone="amber" pulse>{pendingRequests.length} pending</Chip>} padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b border-[color:var(--mc-hairline)] text-[color:var(--mc-ink-2)]">
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em]">{t('identity')}</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em]">{t('attempts')}</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em]">{t('lastAttempt')}</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.14em]">{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="border-b border-[color:var(--mc-hairline)]/70 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {req.avatar_url ? (
                          <Image
                            src={req.avatar_url}
                            alt=""
                            width={32}
                            height={32}
                            unoptimized
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                            {(req.display_name || req.email)?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-[color:var(--mc-ink-0)]">{req.display_name || req.email}</div>
                          <div className="text-xs text-[color:var(--mc-ink-2)]">{req.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--mc-ink-2)]">{req.attempt_count}</td>
                    <td className="px-3 py-2 text-xs text-[color:var(--mc-ink-2)]">{formatDate(req.last_attempt_at)}</td>
                    <td className="px-3 py-2 text-right">
                      {reviewingRequestId === req.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <select
                            value={reviewForm.role}
                            onChange={(e) => setReviewForm(f => ({ ...f, role: e.target.value as any }))}
                            className="h-7 px-2 rounded bg-secondary border border-border text-xs text-foreground"
                          >
                            <option value="viewer">{t('roleViewer')}</option>
                            <option value="operator">{t('roleOperator')}</option>
                            <option value="admin">{t('roleAdmin')}</option>
                          </select>
                          <input
                            value={reviewForm.note}
                            onChange={(e) => setReviewForm(f => ({ ...f, note: e.target.value }))}
                            placeholder={t('noteOptional')}
                            className="h-7 px-2 rounded bg-secondary border border-border text-xs text-foreground w-32"
                          />
                          <Button
                            onClick={() => submitReview(req.id, 'approve')}
                            disabled={processingRequestId === req.id}
                            variant="success"
                            size="xs"
                          >
                            {processingRequestId === req.id ? '...' : t('confirm')}
                          </Button>
                          <Button
                            onClick={() => submitReview(req.id, 'reject')}
                            disabled={processingRequestId === req.id}
                            variant="destructive"
                            size="xs"
                          >
                            {t('reject')}
                          </Button>
                          <Button
                            onClick={() => { setReviewingRequestId(null); setReviewForm({ role: 'viewer', note: '' }) }}
                            variant="ghost"
                            size="xs"
                          >
                            {t('cancel')}
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-2">
                          <Button
                            onClick={() => { setReviewingRequestId(req.id); setReviewForm({ role: 'viewer', note: '' }) }}
                            disabled={processingRequestId === req.id}
                            variant="success"
                            size="xs"
                          >
                            {t('review')}
                          </Button>
                          <Button
                            onClick={() => submitReview(req.id, 'reject')}
                            disabled={processingRequestId === req.id}
                            variant="destructive"
                            size="xs"
                          >
                            {t('reject')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}

      {showCreate && (
        <HudPanel kicker="local identity" title={t('newLocalUser')} glow>
          <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} placeholder={t('username')} className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground" />
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder={t('password')} className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground" />
            <input value={createForm.display_name} onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))} placeholder={t('displayName')} className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground" />
            <select value={createForm.role} onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as any }))} className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground">
              <option value="viewer">{t('roleViewer')}</option>
              <option value="operator">{t('roleOperator')}</option>
              <option value="admin">{t('roleAdmin')}</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={!createForm.username || !createForm.password || creating} size="sm">
              {creating ? t('creating') : t('createUser')}
            </Button>
          </div>
          </div>
        </HudPanel>
      )}

      <HudPanel kicker="directory" title="Approved users" right={<Chip tone="dim">{users.length} records</Chip>} padded={false}>
        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="border-b border-[color:var(--mc-hairline)] text-[color:var(--mc-ink-2)]">
              <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em]">{t('colUser')}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em]">{t('colProvider')}</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em]">{t('colRole')}</th>
              <th className="hidden px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] md:table-cell">{t('colLastLogin')}</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-[0.14em]">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[color:var(--mc-hairline)]/70 last:border-0 transition-colors hover:bg-[rgba(46,230,214,0.045)]">
                {editingId === u.id ? (
                  <>
                    <td className="px-4 py-2.5">
                      <input value={editForm.display_name} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} className="h-8 px-2 rounded bg-secondary border border-border text-sm text-foreground w-full" />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.provider || 'local'}</td>
                    <td className="px-4 py-2.5">
                      <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as any }))} className="h-8 px-2 rounded bg-secondary border border-border text-sm text-foreground" disabled={u.id === currentUser?.id}>
                        <option value="viewer">{t('roleViewer')}</option>
                        <option value="operator">{t('roleOperator')}</option>
                        <option value="admin">{t('roleAdmin')}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} placeholder={t('newPasswordOptional')} className="h-8 px-2 rounded bg-secondary border border-border text-sm text-foreground w-full" disabled={(u.provider || 'local') !== 'local'} />
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <Button onClick={handleEdit} disabled={saving} size="xs">{t('save')}</Button>
                      <Button onClick={() => setEditingId(null)} variant="outline" size="xs">{t('cancel')}</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden">
                          {u.avatar_url ? (
                            <Image
                              src={u.avatar_url}
                              alt={u.display_name}
                              width={28}
                              height={28}
                              unoptimized
                              className="w-7 h-7 object-cover"
                            />
                          ) : u.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[color:var(--mc-ink-0)]">{u.display_name}</div>
                          <div className="text-xs text-[color:var(--mc-ink-2)]">{u.email || u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <Chip tone={u.provider === 'google' ? 'purple' : 'dim'}>{u.provider || 'local'}</Chip>
                    </td>
                    <td className="px-4 py-2.5">
                      <Chip tone={roleTone(u.role)}>{u.role}</Chip>
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-[color:var(--mc-ink-2)] md:table-cell">{formatDate(u.last_login_at)}</td>
                    <td className="px-4 py-2.5 text-right space-x-2">
                      <Button onClick={() => startEdit(u)} variant="outline" size="xs">{t('edit')}</Button>
                      {u.id !== currentUser?.id && (
                        <Button onClick={() => handleDelete(u)} variant="destructive" size="xs">{t('delete')}</Button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </HudPanel>
      </div>
    </Page>
  )
}
