'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

type RoomKind = 'command' | 'project' | 'agent_dm' | 'system'
type DeliveryState = 'sent' | 'delivered' | 'seen'
type TaskStatus = 'created' | 'accepted' | 'working' | 'blocked' | 'done'

interface Room {
  id: number
  slug: string
  name: string
  kind: RoomKind
  pinned_finish_line: string | null
  pinned_owner: string | null
  pinned_blocker: string | null
  message_count?: number
  latest_message_at?: number | null
}

interface Delivery {
  id: number
  message_id: number
  recipient_type: 'human' | 'agent' | 'room'
  recipient_id: string
  state: DeliveryState
  state_at: number
  evidence: string | null
}

interface Message {
  id: number
  room_id: number
  sender_type: 'human' | 'agent' | 'system'
  sender_id: string
  sender_display_name?: string
  body: string
  message_type: 'normal' | 'task_event' | 'decision_receipt' | 'attachment' | 'alert'
  parent_message_id: number | null
  created_at: number
  delivery: Delivery[]
}

interface Assignment {
  id: number
  title: string
  description: string | null
  assignee_agent_id: string | null
  status: TaskStatus
  priority: 'normal' | 'priority' | 'blocker' | 'approval_needed'
  evidence: string | null
  created_at: number
  updated_at: number
}

interface Receipt {
  id: number
  decision: string
  approved_by: string
  approval_tier: 'none' | 'mission_control' | 'chris_explicit'
  evidence: string | null
  created_at: number
}

interface AgentProfile {
  agent_id: string
  display_name: string
  role: string
  runtime_type: string
  model: string | null
  status: string
  current_assignment: string | null
  last_proof: string | null
  capabilities_summary: string | null
  updated_at: number
}

interface QueuedAlert {
  id: number
  target_agent_id: string
  reason: string
  alert_state: string
  created_at: number
  updated_at: number
}

interface GroupChatResponse {
  rooms: Room[]
  selectedRoom: Room | null
  messages: Message[]
  assignments: Assignment[]
  receipts: Receipt[]
  queuedAlerts: QueuedAlert[]
  agentProfiles: AgentProfile[]
  generatedAt: number
}

const statusClasses: Record<string, string> = {
  sent: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  delivered: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  seen: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  created: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  accepted: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  working: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  blocked: 'bg-red-500/15 text-red-300 border-red-500/25',
  done: 'bg-green-500/15 text-green-300 border-green-500/25',
  online_proven: 'bg-green-500/15 text-green-300 border-green-500/25',
  queued: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  unknown: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25',
}

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusClasses[value] || statusClasses.unknown}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function RoomIcon({ kind }: { kind: RoomKind }) {
  const label = kind === 'agent_dm' ? 'DM' : kind === 'command' ? 'HQ' : kind === 'system' ? 'SYS' : 'OPS'
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[10px] font-black text-primary">
      {label}
    </div>
  )
}

function deliverySummary(message: Message): DeliveryState {
  if (message.delivery.some((d) => d.state === 'seen')) return 'seen'
  if (message.delivery.some((d) => d.state === 'delivered')) return 'delivered'
  return 'sent'
}

export function GroupChatPanel() {
  const [data, setData] = useState<GroupChatResponse | null>(null)
  const [roomSlug, setRoomSlug] = useState('blackwire-ops')
  const [messageBody, setMessageBody] = useState('')
  const [decision, setDecision] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`/api/group-chat/rooms?room=${encodeURIComponent(roomSlug)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load group chat')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [roomSlug])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data?.messages || []
    return (data?.messages || []).filter((message) =>
      message.body.toLowerCase().includes(q) ||
      message.sender_id.toLowerCase().includes(q) ||
      message.sender_display_name?.toLowerCase().includes(q)
    )
  }, [data?.messages, search])

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data?.assignments || []
    return (data?.assignments || []).filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.assignee_agent_id?.toLowerCase().includes(q)
    )
  }, [data?.assignments, search])

  async function sendMessage(bodyOverride?: string) {
    const body = (bodyOverride || messageBody).trim()
    if (!body) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/group-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomSlug, body, senderId: 'chris', senderType: 'human' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Message failed')
      setMessageBody('')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function updateAssignment(assignmentId: number, status: TaskStatus) {
    const evidence = status === 'done'
      ? window.prompt('Evidence is required before Done. Paste receipt, URL, commit, or proof note:')?.trim()
      : `Mission Control local update to ${status}`
    if (status === 'done' && !evidence) {
      setError('Evidence is required before an assignment can move to Done.')
      return
    }
    const res = await fetch('/api/group-chat/assignments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, status, evidence }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Assignment update failed')
      return
    }
    await fetchData()
  }

  async function createReceipt() {
    const trimmed = decision.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/group-chat/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomSlug,
          decision: trimmed,
          approvedBy: 'Chris',
          approvalTier: 'mission_control',
          evidence: 'Created from Mission Control group chat v0 UI.',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Receipt failed')
      setDecision('')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="inline" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col">
      <div className="border-b border-border bg-card/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">Mission Control Group Chat</h1>
            <p className="text-xs text-muted-foreground">
              Blackwire room, DMs, delivery proof, assignment tracker, and decision receipts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages, tasks, receipts..."
              className="h-9 w-72 max-w-[45vw] rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            />
            <Button variant="outline" size="sm" onClick={fetchData}>Refresh</Button>
          </div>
        </div>
        {error && (
          <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="border-b border-border bg-background/60 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rooms</div>
          <div className="space-y-1">
            {(data?.rooms || []).map((room) => (
              <button
                key={room.slug}
                onClick={() => setRoomSlug(room.slug)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  roomSlug === room.slug
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-transparent hover:border-border hover:bg-card'
                }`}
              >
                <RoomIcon kind={room.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{room.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {room.message_count || 0} messages · {room.kind.replace(/_/g, ' ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">v0 proof</div>
            <p className="mt-1">Messages prove sent/delivered/seen locally. @mentions with action words create board items.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full text-xs"
              onClick={() => sendMessage('@koda verify the Blackwire room demo and mark the group chat proof path working.')}
              disabled={submitting}
            >
              Send @mention demo
            </Button>
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{data?.selectedRoom?.name || 'Room'}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{data?.selectedRoom?.pinned_finish_line || 'No pinned finish line.'}</p>
              </div>
              <StatusBadge value="sent" />
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {filteredMessages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No messages found.
              </div>
            ) : filteredMessages.map((message) => {
              const state = deliverySummary(message)
              const isSystem = message.sender_type === 'system'
              return (
                <article key={message.id} className={`rounded-xl border p-3 ${isSystem ? 'border-amber-500/20 bg-amber-500/5' : 'border-border bg-card'}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{message.sender_display_name || message.sender_id}</span>
                      <span className="text-[11px] text-muted-foreground">{formatTime(message.created_at)}</span>
                      {message.message_type !== 'normal' && <StatusBadge value={message.message_type} />}
                    </div>
                    <StatusBadge value={state} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{message.body}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {message.delivery.map((delivery) => (
                      <span key={delivery.id} className="rounded-md bg-background px-2 py-1 text-[10px] text-muted-foreground">
                        {delivery.recipient_id}: {delivery.state}
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="border-t border-border bg-card/40 p-3">
            <div className="flex gap-2">
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Type in plain English. Example: @koda build the Command Truth fixture route."
                className="min-h-16 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button onClick={() => sendMessage()} disabled={submitting || !messageBody.trim()} className="self-end">
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="overflow-auto border-t border-border bg-background/60 p-3 lg:border-l lg:border-t-0">
          <div className="space-y-3">
            <section className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pinned Context</div>
              <div className="mt-2 space-y-2 text-xs">
                <p><span className="font-semibold text-foreground">Owner:</span> {data?.selectedRoom?.pinned_owner || 'Not set'}</p>
                <p><span className="font-semibold text-foreground">Blocker:</span> {data?.selectedRoom?.pinned_blocker || 'None'}</p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Assignment Tracker Board</div>
                <span className="text-[11px] text-muted-foreground">{filteredAssignments.length}</span>
              </div>
              <div className="space-y-2">
                {filteredAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No assignment items yet.</p>
                ) : filteredAssignments.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-background p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-xs font-semibold text-foreground">{item.title}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">@{item.assignee_agent_id || 'unassigned'} · {item.priority}</div>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(['accepted', 'working', 'blocked', 'done'] as TaskStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateAssignment(item.id, status)}
                          className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Decision Receipts</div>
              <div className="mt-2 flex gap-2">
                <input
                  value={decision}
                  onChange={(event) => setDecision(event.target.value)}
                  placeholder="Record a Mission Control decision..."
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                />
                <Button variant="outline" size="sm" onClick={createReceipt} disabled={!decision.trim() || submitting}>Add</Button>
              </div>
              <div className="mt-3 space-y-2">
                {(data?.receipts || []).slice(0, 5).map((receipt) => (
                  <div key={receipt.id} className="rounded-lg bg-background p-2 text-xs">
                    <div className="font-semibold text-foreground">{receipt.decision}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {receipt.approval_tier} · {receipt.approved_by} · {formatTime(receipt.created_at)}
                    </div>
                  </div>
                ))}
                {(data?.receipts || []).length === 0 && <p className="text-xs text-muted-foreground">No receipts yet.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Queued Alerts</div>
              <div className="mt-2 space-y-2">
                {(data?.queuedAlerts || []).map((alert) => (
                  <div key={alert.id} className="rounded-lg bg-background p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">@{alert.target_agent_id}</span>
                      <StatusBadge value={alert.alert_state} />
                    </div>
                    <p className="mt-1 text-muted-foreground">{alert.reason}</p>
                  </div>
                ))}
                {(data?.queuedAlerts || []).length === 0 && <p className="text-xs text-muted-foreground">No queued alerts.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Agent Cards</div>
              <div className="mt-2 space-y-2">
                {(data?.agentProfiles || []).map((profile) => (
                  <div key={profile.agent_id} className="rounded-lg bg-background p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">{profile.display_name}</div>
                        <div className="text-[11px] text-muted-foreground">{profile.role}</div>
                      </div>
                      <StatusBadge value={profile.status} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{profile.current_assignment || 'No current assignment.'}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}
