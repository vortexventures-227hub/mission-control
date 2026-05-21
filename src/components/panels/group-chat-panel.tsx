'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
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

const statusLabels: Record<string, string> = {
  sent: 'local sent',
  delivered: 'local delivered',
  seen: 'local seen',
}

const LOCAL_DELIVERY_BOUNDARY = 'Local Mission Control state only. No Telegram, customer, email, or external agent delivery is implied.'

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ value }: { value: string }) {
  const label = statusLabels[value] || value.replace(/_/g, ' ')
  const tone = value === 'seen' || value === 'done' || value === 'online_proven'
    ? 'teal'
    : value === 'delivered' || value === 'working' || value === 'queued'
      ? 'amber'
      : value === 'blocked'
        ? 'rose'
        : value === 'accepted' || value === 'isolated'
          ? 'purple'
          : value === 'created' || value === 'sent'
            ? 'dim'
            : 'neutral'
  return (
    <Chip tone={tone}>{label}</Chip>
  )
}

function RoomIcon({ kind }: { kind: RoomKind }) {
  const label = kind === 'agent_dm' ? 'DM' : kind === 'command' ? 'HQ' : kind === 'system' ? 'SYS' : 'OPS'
  return (
    <div className="mc-bevel flex h-9 w-9 shrink-0 items-center justify-center font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--mc-teal-soft)]">
      {label}
    </div>
  )
}

function deliverySummary(message: Message): DeliveryState {
  const recipientDeliveries = message.delivery.filter((d) => d.recipient_type !== 'room')
  if (recipientDeliveries.length === 0) return 'sent'
  if (recipientDeliveries.every((d) => d.state === 'seen')) return 'seen'
  if (recipientDeliveries.some((d) => d.state === 'delivered' || d.state === 'seen')) return 'delivered'
  return 'sent'
}

interface GroupChatPanelProps {
  initialRoomSlug?: string
  initialSearch?: string
}

export function GroupChatPanel({ initialRoomSlug = 'blackwire-ops', initialSearch = '' }: GroupChatPanelProps = {}) {
  const [data, setData] = useState<GroupChatResponse | null>(null)
  const [roomSlug, setRoomSlug] = useState(initialRoomSlug)
  const [messageBody, setMessageBody] = useState('')
  const [decision, setDecision] = useState('')
  const [search, setSearch] = useState(initialSearch)
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

  const roomMetrics = useMemo(() => {
    const messages = data?.messages || []
    const assignments = data?.assignments || []
    const receipts = data?.receipts || []
    const unreadDeliveries = messages.flatMap((message) => message.delivery).filter((delivery) => delivery.state !== 'seen').length
    const approvalNeeded = assignments.filter((item) => item.priority === 'approval_needed' || item.status === 'blocked').length
    const doneWithoutEvidence = assignments.filter((item) => item.status === 'done' && !item.evidence).length

    return {
      messages: messages.length,
      assignments: assignments.length,
      receipts: receipts.length,
      unreadDeliveries,
      approvalNeeded,
      doneWithoutEvidence,
    }
  }, [data?.assignments, data?.messages, data?.receipts])

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

  async function updateDelivery(delivery: Delivery, state: DeliveryState) {
    const res = await fetch('/api/group-chat/delivery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: delivery.message_id,
        recipientType: delivery.recipient_type,
        recipientId: delivery.recipient_id,
        state,
        evidence: `${LOCAL_DELIVERY_BOUNDARY} Updated by operator in room ${roomSlug}.`,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Delivery update failed')
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
          approvalTier: 'chris_explicit',
          evidence: `Chris-explicit linked receipt from Mission Control Blackwire room ${roomSlug}: /rooms/${roomSlug} -> /command-truth?tab=routes -> /api/command-truth/routes`,
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
      <Page kicker="BLACKWIRE ROOM" title="INITIALIZING" badges={<Chip tone="teal" pulse>LOCAL MESSAGE BUS</Chip>}>
        <HudPanel title="Loading group chat proof state" glow>
          <div className="flex min-h-[220px] items-center justify-center text-[color:var(--mc-ink-1)]">
            <Loader variant="inline" />
          </div>
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="BLACKWIRE GROUP CHAT / LOCAL OPS ROOM"
      title="Mission Control Group Chat"
      subtitle="Blackwire room, DMs, delivery proof, assignment tracker, and decision receipts. This is a local command deck; no production messaging or agent autonomy is implied."
      badges={(
        <>
          <Chip tone="teal" pulse>LOCAL MVP DEMO</Chip>
          <Chip tone="amber">EVIDENCE BEFORE DONE</Chip>
          <Chip tone="rose">NO EXTERNAL SENDS</Chip>
        </>
      )}
      actions={(
        <>
          <Link href="/command-truth" className="mc-btn-glitch inline-flex border border-[color:var(--mc-teal)]/55 bg-[rgba(46,230,214,0.11)] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--mc-teal-soft)]">Command Truth</Link>
          <Link href="/tracker?agent=koda" className="mc-btn-glitch inline-flex border border-[color:var(--mc-hairline-2)] bg-white/[0.04] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--mc-ink-1)]">Koda Tracker</Link>
          <Link href="/exec-approvals" className="mc-btn-glitch inline-flex border border-[color:var(--mc-amber)]/45 bg-[rgba(245,165,36,0.10)] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--mc-amber)]">Approvals</Link>
        </>
      )}
    >
      <div className="flex h-full min-h-[calc(100vh-11rem)] flex-col overflow-hidden">
      <div className="relative mb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Messages" value={roomMetrics.messages} glow />
            <Stat label="Tasks" value={roomMetrics.assignments} accent="purple" />
            <Stat label="Receipts" value={roomMetrics.receipts} accent="amber" />
            <Stat label="Review Rows" value={roomMetrics.unreadDeliveries} accent={roomMetrics.unreadDeliveries ? 'amber' : 'teal'} />
            <Stat label="Approval Gates" value={roomMetrics.approvalNeeded} accent={roomMetrics.approvalNeeded ? 'amber' : 'teal'} />
            <Stat label="Done Without Proof" value={roomMetrics.doneWithoutEvidence} accent={roomMetrics.doneWithoutEvidence ? 'rose' : 'teal'} />
          </div>
          <HudPanel kicker="FILTER" title="Room search" className="sm:min-w-80">
            <div className="flex flex-col gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages, tasks, receipts..."
                className="h-9 min-w-0 border border-[color:var(--mc-hairline-2)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none placeholder:text-[color:var(--mc-ink-3)] focus:border-[color:var(--mc-teal)]"
              />
              <Button variant="outline" size="sm" onClick={fetchData}>Refresh</Button>
            </div>
          </HudPanel>
        </div>
        {(error || roomMetrics.doneWithoutEvidence > 0 || roomMetrics.approvalNeeded > 0) && (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {error && <BoundaryBanner tone="rose" title="Group Chat warning">{error}</BoundaryBanner>}
            {roomMetrics.approvalNeeded > 0 && <BoundaryBanner tone="amber" title="Approval gates">{roomMetrics.approvalNeeded} assignment gate(s) need approval or blocker resolution.</BoundaryBanner>}
            {roomMetrics.doneWithoutEvidence > 0 && <BoundaryBanner tone="rose" title="No fake green">{roomMetrics.doneWithoutEvidence} Done item(s) have missing evidence and must not be treated green.</BoundaryBanner>}
          </div>
        )}
      </div>

      <div className="relative grid flex-1 grid-cols-1 overflow-hidden border border-[color:var(--mc-hairline)] lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="border-b border-[color:var(--mc-hairline)] bg-black/20 p-3 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--mc-ink-2)]">Rooms</div>
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
          <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-3 text-xs text-slate-300 shadow-lg shadow-cyan-950/20">
            <div className="font-semibold text-white">Local proof boundary</div>
            <p className="mt-1">Delivery states are local proof labels only — local sent, local delivered, and local seen. @mentions create local board items; no external agent/customer channel is contacted.</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
              <span className="font-semibold text-cyan-200">Review queue:</span> {roomMetrics.unreadDeliveries} local proof row(s) still need operator review.
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
              <div className="font-semibold text-cyan-200">Agent local ingress</div>
              <p className="mt-1">POST `/api/group-chat/messages` with `senderType: agent`, matching `senderId`, and `x-agent-name`. Spoofed agent senders are rejected.</p>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2">
              <div className="font-semibold text-cyan-200">Delivery legend</div>
              <div className="mt-2 grid gap-1.5">
                <div className="flex items-center justify-between gap-2"><StatusBadge value="sent" /><span>stored in the room</span></div>
                <div className="flex items-center justify-between gap-2"><StatusBadge value="delivered" /><span>recipient row exists</span></div>
                <div className="flex items-center justify-between gap-2"><StatusBadge value="seen" /><span>operator/agent acknowledged locally</span></div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full text-xs"
              onClick={() => sendMessage('@koda verify the Blackwire room demo and mark the group chat proof path working.')}
              disabled={submitting}
            >
              Send local @mention demo
            </Button>
          </div>
        </aside>

        <section className="flex min-h-[520px] flex-col overflow-hidden border-x border-cyan-400/10 bg-slate-950/45">
          <div className="border-b border-cyan-400/10 bg-slate-950/55 px-4 py-3">
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
              <div className="rounded-lg border border-dashed border-cyan-400/20 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
                No messages found.
              </div>
            ) : filteredMessages.map((message) => {
              const state = deliverySummary(message)
              const isSystem = message.sender_type === 'system'
              return (
                <article key={message.id} className={`rounded-2xl border p-3 shadow-lg ${isSystem ? 'border-amber-500/25 bg-amber-500/10 shadow-amber-950/10' : 'border-white/10 bg-white/[0.045] shadow-slate-950/20'}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{message.sender_display_name || message.sender_id}</span>
                      <span className="text-[11px] text-slate-400">{formatTime(message.created_at)}</span>
                      {message.message_type !== 'normal' && <StatusBadge value={message.message_type} />}
                    </div>
                    <StatusBadge value={state} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100/90">{message.body}</p>
                  <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-2.5 py-2 text-[11px] text-slate-300">
                    {LOCAL_DELIVERY_BOUNDARY}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.delivery.map((delivery) => (
                      <span key={delivery.id} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300">
                        <span>{delivery.recipient_id}: {statusLabels[delivery.state] || delivery.state}</span>
                        {delivery.state !== 'seen' && (
                          <button
                            onClick={() => updateDelivery(delivery, 'seen')}
                            className="rounded border border-emerald-400/20 px-1.5 py-0.5 text-emerald-200 hover:bg-emerald-400/10"
                            title="Mark locally seen in Mission Control state only"
                          >
                            mark locally seen
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="border-t border-cyan-400/10 bg-slate-950/80 p-3">
            <div className="flex gap-2">
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Type in plain English. Example: @koda build the Command Truth fixture route."
                className="min-h-16 flex-1 resize-none rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300"
              />
              <Button onClick={() => sendMessage()} disabled={submitting || !messageBody.trim()} className="self-end">
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="overflow-auto border-t border-cyan-400/10 bg-slate-950/70 p-3 backdrop-blur lg:border-l lg:border-t-0">
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
                  <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-2.5 shadow-lg shadow-slate-950/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-xs font-semibold text-white">{item.title}</div>
                        <div className="mt-1 text-[11px] text-slate-400">@{item.assignee_agent_id || 'unassigned'} · {item.priority}</div>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                    <div className={`mt-2 rounded-lg border px-2 py-1.5 text-[11px] ${item.evidence ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/20 bg-amber-400/10 text-amber-100'}`}>
                      {item.evidence ? `Evidence: ${item.evidence}` : 'Evidence Missing — cannot be treated Done/green.'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(['accepted', 'working', 'blocked', 'done'] as TaskStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateAssignment(item.id, status)}
                          className="rounded border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white"
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
    </Page>
  )
}
