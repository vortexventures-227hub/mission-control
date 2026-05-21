'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { useSmartPoll } from '@/lib/use-smart-poll'

interface Notification {
  id: number
  recipient: string
  type: string
  title: string
  message: string
  source_type?: string
  source_id?: number
  read_at?: number
  delivered_at?: number
  created_at: number
}

export function NotificationsPanel() {
  const t = useTranslations('notifications')
  const [recipient, setRecipient] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('mc.notifications.recipient') || 'operator'
  })
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!recipient) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/notifications?recipient=${encodeURIComponent(recipient)}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')
      const data = await response.json()
      setNotifications(data.notifications || [])
      setUnreadCount(Number(data.unreadCount || 0))
      setTotalCount(Number(data.total || 0))
    } catch (err) {
      setError('Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [recipient])

  useEffect(() => {
    if (recipient) {
      window.localStorage.setItem('mc.notifications.recipient', recipient)
      fetchNotifications()
    }
  }, [recipient, fetchNotifications])

  useSmartPoll(fetchNotifications, 30000, { enabled: !!recipient, pauseWhenSseConnected: true })

  const markAllRead = async () => {
    if (!recipient) return
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, markAllRead: true })
      })
      if (!res.ok) throw new Error('Failed to mark all as read')
      fetchNotifications()
    } catch {
      // Silent — notification state will resync on next poll
    }
  }

  const markRead = async (id: number) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      })
      if (!res.ok) throw new Error('Failed to mark as read')
      fetchNotifications()
    } catch {
      // Silent — notification state will resync on next poll
    }
  }

  const deliveredCount = notifications.filter((item) => item.delivered_at).length
  const pendingDeliveryCount = notifications.filter((item) => !item.delivered_at).length

  return (
    <Page
      kicker="NOTIFICATIONS / LOCAL QUEUE"
      title={t('title')}
      subtitle="Operator notification queue for Mission Control events, delivery rows, and unread work. This is local command visibility, not email, SMS, push, or external agent delivery."
      badges={(
        <>
          <Chip tone="teal" pulse>LOCAL QUEUE</Chip>
          <Chip tone="amber">DELIVERY ROW IS NOT RECEIPT</Chip>
          <Chip tone="rose">NO EXTERNAL SEND IMPLIED</Chip>
        </>
      )}
      actions={(
        <Button
          onClick={markAllRead}
          variant="secondary"
          size="sm"
        >
          {t('markAllRead')}
        </Button>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Unread" value={unreadCount} sub="needs operator scan" accent="amber" glow={unreadCount > 0} />
          <Stat label="Total" value={totalCount} sub="rows for recipient" accent="teal" />
          <Stat label="Delivered Rows" value={deliveredCount} sub="local delivered_at set" accent="purple" />
          <Stat label="Pending Delivery" value={pendingDeliveryCount} sub="not marked delivered" accent="rose" glow={pendingDeliveryCount > 0} />
        </div>

        <HudPanel kicker="RECIPIENT FILTER" title="Queue Controls">
          <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--mc-ink-2)]">{t('recipientLabel')}</label>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="min-w-0 flex-1 border border-[color:var(--mc-hairline-2)] bg-black/30 px-3 py-2 font-mono text-sm text-[color:var(--mc-ink-0)] placeholder:text-[color:var(--mc-ink-3)] focus:outline-none focus:ring-2 focus:ring-[color:var(--mc-teal)]/40"
              placeholder={t('recipientPlaceholder')}
            />
            <div className="flex flex-wrap gap-1.5">
              {['operator', 'Chris', 'koda', 'herm'].map((item) => (
                <button
                  key={item}
                  onClick={() => setRecipient(item)}
                  className={`border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                    recipient === item
                      ? 'border-[color:var(--mc-teal)]/70 bg-[rgba(46,230,214,0.14)] text-[color:var(--mc-teal-soft)]'
                      : 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-2)] hover:text-[color:var(--mc-ink-0)]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </HudPanel>

        <BoundaryBanner tone="amber" title="Local Boundary">
          A delivered notification row means Mission Control recorded local queue delivery. It does not prove email, SMS, push delivery, agent action, or completed work.
        </BoundaryBanner>

        {error && (
          <BoundaryBanner tone="rose" title="Notification Runtime Warning">
            {error}
          </BoundaryBanner>
        )}

        <HudPanel
          kicker="QUEUE / EVENT ROWS"
          title="Notification Stream"
          right={<Chip tone={loading ? 'amber' : 'teal'}>{loading ? 'Loading' : `${notifications.length} rows`}</Chip>}
          glow
        >
          <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader variant="inline" label="Loading" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mb-2">
                <path d="M12 5a4 4 0 00-8 0c0 4-2 5-2 5h12s-2-1-2-5" />
                <path d="M9.15 14a1.25 1.25 0 01-2.3 0" />
              </svg>
              <span className="text-sm">{t('noNotifications')}</span>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`border p-3 transition-smooth ${
                  n.read_at
                    ? 'border-[color:var(--mc-hairline)] bg-black/20'
                    : 'border-[color:var(--mc-teal-dim)] bg-[rgba(46,230,214,0.08)]'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--mc-ink-0)]">{n.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Chip tone={n.read_at ? 'dim' : 'teal'}>{n.read_at ? 'Read' : 'Unread'}</Chip>
                      <Chip tone={n.delivered_at ? 'purple' : 'amber'}>{n.delivered_at ? 'Delivered Row' : 'Pending Row'}</Chip>
                      <Chip tone="neutral">{n.type}</Chip>
                    </div>
                  </div>
                  {!n.read_at && (
                    <Button
                      onClick={() => markRead(n.id)}
                      variant="link"
                      size="xs"
                      className="flex-shrink-0 ml-2"
                    >
                      {t('markRead')}
                    </Button>
                  )}
                </div>
                <div className="text-sm text-[color:var(--mc-ink-1)] mt-2 whitespace-pre-wrap">{n.message}</div>
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-3)]">
                  <span>{new Date(n.created_at * 1000).toLocaleString()}</span>
                  {n.source_type && <span>source: {n.source_type}{n.source_id ? `:${n.source_id}` : ''}</span>}
                </div>
              </div>
            ))
          )}
          </div>
        </HudPanel>
      </div>
    </Page>
  )
}
