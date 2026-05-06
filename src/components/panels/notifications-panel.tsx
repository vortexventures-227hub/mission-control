'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Local Mission Control notification queue only. No email, SMS, push, or external agent delivery is implied.
          </p>
        </div>
        <Button
          onClick={markAllRead}
          variant="secondary"
          size="sm"
        >
          {t('markAllRead')}
        </Button>
      </div>

      <div className="p-4 border-b border-border flex-shrink-0">
        <label className="block text-sm text-muted-foreground mb-2">{t('recipientLabel')}</label>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="min-w-0 flex-1 bg-surface-1 text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder={t('recipientPlaceholder')}
          />
          <div className="flex flex-wrap gap-1.5">
            {['operator', 'Chris', 'koda', 'herm'].map((item) => (
              <button
                key={item}
                onClick={() => setRecipient(item)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  recipient === item
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          {[
            ['Unread', unreadCount],
            ['Total', totalCount],
            ['Delivered rows', notifications.filter((item) => item.delivered_at).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="text-lg font-black text-foreground">{value}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 m-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              className={`rounded-lg p-3 border transition-smooth ${
                n.read_at ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{n.title}</div>
                  <div className="text-xs text-muted-foreground/60">{n.type}</div>
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
              <div className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{n.message}</div>
              <div className="text-[10px] text-muted-foreground/40 mt-2">
                {new Date(n.created_at * 1000).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
