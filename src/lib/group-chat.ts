import type Database from 'better-sqlite3'
import { getDatabase } from './db'

export type GroupChatRoomKind = 'command' | 'project' | 'agent_dm' | 'system'
export type GroupChatSenderType = 'human' | 'agent' | 'system'
export type GroupChatMessageType = 'normal' | 'task_event' | 'decision_receipt' | 'attachment' | 'alert'
export type GroupChatDeliveryState = 'sent' | 'delivered' | 'seen'
export type GroupChatTaskStatus = 'created' | 'accepted' | 'working' | 'blocked' | 'done'
export type GroupChatTaskPriority = 'normal' | 'priority' | 'blocker' | 'approval_needed'
export type GroupChatApprovalTier = 'none' | 'mission_control' | 'chris_explicit'

const ACTION_WORDS = /\b(assign|do|build|audit|verify|fix|implement|check|review|create)\b/i
const MENTION_PATTERN = /@([a-zA-Z][a-zA-Z0-9_-]*)/g

export interface GroupChatRoom {
  id: number
  slug: string
  name: string
  kind: GroupChatRoomKind
  project_key: string | null
  pinned_finish_line: string | null
  pinned_owner: string | null
  pinned_blocker: string | null
  created_at: number
  updated_at: number
  message_count?: number
  latest_message_at?: number | null
}

export interface GroupChatMessage {
  id: number
  room_id: number
  room_slug?: string
  sender_type: GroupChatSenderType
  sender_id: string
  sender_display_name?: string
  body: string
  message_type: GroupChatMessageType
  parent_message_id: number | null
  created_at: number
  delivery: GroupChatDelivery[]
}

export interface GroupChatDelivery {
  id: number
  message_id: number
  recipient_type: 'human' | 'agent' | 'room'
  recipient_id: string
  state: GroupChatDeliveryState
  state_at: number
  evidence: string | null
}

export interface GroupChatAssignment {
  id: number
  room_id: number
  source_message_id: number | null
  title: string
  description: string | null
  assignee_agent_id: string | null
  status: GroupChatTaskStatus
  priority: GroupChatTaskPriority
  evidence: string | null
  created_at: number
  updated_at: number
}

export interface GroupChatDecisionReceipt {
  id: number
  room_id: number
  source_message_id: number | null
  decision: string
  approved_by: string
  approval_tier: GroupChatApprovalTier
  evidence: string | null
  created_at: number
}

export interface GroupChatAgentProfile {
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

export interface GroupChatQueuedAlert {
  id: number
  room_id: number
  target_agent_id: string
  source_message_id: number | null
  reason: string
  alert_state: string
  created_at: number
  updated_at: number
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function displayNameForSender(db: Database.Database, workspaceId: number, senderId: string): string {
  const profile = db.prepare(`
    SELECT display_name FROM group_chat_agent_profile_cards
    WHERE workspace_id = ? AND agent_id = ?
  `).get(workspaceId, senderId) as { display_name: string } | undefined
  return profile?.display_name || senderId
}

export function listGroupChatRooms(workspaceId = 1): GroupChatRoom[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      r.*,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as latest_message_at
    FROM group_chat_rooms r
    LEFT JOIN group_chat_messages m
      ON m.room_id = r.id AND m.workspace_id = r.workspace_id
    WHERE r.workspace_id = ?
    GROUP BY r.id
    ORDER BY
      CASE r.kind WHEN 'command' THEN 0 WHEN 'project' THEN 1 WHEN 'agent_dm' THEN 2 ELSE 3 END,
      r.name COLLATE NOCASE
  `).all(workspaceId) as GroupChatRoom[]
}

export function getGroupChatRoomBySlug(slug: string, workspaceId = 1): GroupChatRoom | null {
  const db = getDatabase()
  return (db.prepare(`
    SELECT * FROM group_chat_rooms WHERE workspace_id = ? AND slug = ? LIMIT 1
  `).get(workspaceId, slug) as GroupChatRoom | undefined) || null
}

function getDeliveriesForMessages(db: Database.Database, workspaceId: number, messageIds: number[]): Map<number, GroupChatDelivery[]> {
  if (messageIds.length === 0) return new Map()
  const placeholders = messageIds.map(() => '?').join(',')
  const deliveries = db.prepare(`
    SELECT * FROM group_chat_message_delivery_state
    WHERE workspace_id = ? AND message_id IN (${placeholders})
    ORDER BY state_at ASC
  `).all(workspaceId, ...messageIds) as GroupChatDelivery[]
  const byMessage = new Map<number, GroupChatDelivery[]>()
  for (const delivery of deliveries) {
    const bucket = byMessage.get(delivery.message_id) || []
    bucket.push(delivery)
    byMessage.set(delivery.message_id, bucket)
  }
  return byMessage
}

export function listGroupChatMessages(roomSlug: string, workspaceId = 1): GroupChatMessage[] {
  const db = getDatabase()
  const room = getGroupChatRoomBySlug(roomSlug, workspaceId)
  if (!room) return []
  const rows = db.prepare(`
    SELECT m.*, r.slug as room_slug
    FROM group_chat_messages m
    JOIN group_chat_rooms r ON r.id = m.room_id
    WHERE m.workspace_id = ? AND m.room_id = ?
    ORDER BY m.created_at ASC, m.id ASC
  `).all(workspaceId, room.id) as Array<Omit<GroupChatMessage, 'delivery'>>
  const deliveries = getDeliveriesForMessages(db, workspaceId, rows.map(row => row.id))
  return rows.map(row => ({
    ...row,
    sender_display_name: displayNameForSender(db, workspaceId, row.sender_id),
    delivery: deliveries.get(row.id) || [],
  }))
}

export function listGroupChatAssignments(roomId: number, workspaceId = 1): GroupChatAssignment[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM group_chat_assignment_tracker_items
    WHERE workspace_id = ? AND room_id = ?
    ORDER BY
      CASE status WHEN 'blocked' THEN 0 WHEN 'working' THEN 1 WHEN 'accepted' THEN 2 WHEN 'created' THEN 3 ELSE 4 END,
      updated_at DESC
  `).all(workspaceId, roomId) as GroupChatAssignment[]
}

export function listGroupChatDecisionReceipts(roomId: number, workspaceId = 1): GroupChatDecisionReceipt[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM group_chat_decision_receipts
    WHERE workspace_id = ? AND room_id = ?
    ORDER BY created_at DESC
    LIMIT 25
  `).all(workspaceId, roomId) as GroupChatDecisionReceipt[]
}

export function listGroupChatAgentProfiles(workspaceId = 1): GroupChatAgentProfile[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT agent_id, display_name, role, runtime_type, model, status, current_assignment,
      last_proof, capabilities_summary, updated_at
    FROM group_chat_agent_profile_cards
    WHERE workspace_id = ?
    ORDER BY
      CASE status WHEN 'online_proven' THEN 0 WHEN 'queued' THEN 1 WHEN 'unknown' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END,
      display_name COLLATE NOCASE
  `).all(workspaceId) as GroupChatAgentProfile[]
}

export function listGroupChatQueuedAlerts(roomId: number, workspaceId = 1): GroupChatQueuedAlert[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM group_chat_queued_alerts
    WHERE workspace_id = ? AND room_id = ?
    ORDER BY updated_at DESC
    LIMIT 25
  `).all(workspaceId, roomId) as GroupChatQueuedAlert[]
}

export function parseActionMentions(body: string): string[] {
  if (!ACTION_WORDS.test(body)) return []
  const mentions = new Set<string>()
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const agentId = match[1]?.toLowerCase()
    if (agentId) mentions.add(agentId)
  }
  return [...mentions]
}

function titleFromMentionMessage(body: string, assignee: string): string {
  const cleaned = body
    .replace(MENTION_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
  const prefix = cleaned.length > 0 ? cleaned : `Assignment for @${assignee}`
  return prefix.length > 90 ? `${prefix.slice(0, 87)}...` : prefix
}

function createAssignmentForMention(
  db: Database.Database,
  workspaceId: number,
  roomId: number,
  sourceMessageId: number,
  assignee: string,
  body: string,
): GroupChatAssignment {
  const profile = db.prepare(`
    SELECT status FROM group_chat_agent_profile_cards
    WHERE workspace_id = ? AND agent_id = ?
  `).get(workspaceId, assignee) as { status: string } | undefined
  const priority: GroupChatTaskPriority = /\b(blocker|urgent|critical|approval)\b/i.test(body)
    ? 'blocker'
    : 'priority'
  const now = nowSeconds()
  const result = db.prepare(`
    INSERT INTO group_chat_assignment_tracker_items (
      workspace_id, room_id, source_message_id, title, description, assignee_agent_id,
      status, priority, evidence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?)
  `).run(
    workspaceId,
    roomId,
    sourceMessageId,
    titleFromMentionMessage(body, assignee),
    body,
    assignee,
    priority,
    `Created automatically from @${assignee} action mention.`,
    now,
    now,
  )

  if (!profile || profile.status !== 'online_proven') {
    db.prepare(`
      INSERT INTO group_chat_queued_alerts (
        workspace_id, room_id, target_agent_id, source_message_id, reason,
        alert_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
    `).run(
      workspaceId,
      roomId,
      assignee,
      sourceMessageId,
      `@${assignee} is not online_proven; assignment queued for alert.`,
      now,
      now,
    )
  }

  return db.prepare(`
    SELECT * FROM group_chat_assignment_tracker_items
    WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, result.lastInsertRowid) as GroupChatAssignment
}

export function createGroupChatMessage(input: {
  roomSlug: string
  senderType: GroupChatSenderType
  senderId: string
  body: string
  messageType?: GroupChatMessageType
  parentMessageId?: number | null
  workspaceId?: number
}): { message: GroupChatMessage; assignments: GroupChatAssignment[] } {
  const workspaceId = input.workspaceId || 1
  const db = getDatabase()
  const room = getGroupChatRoomBySlug(input.roomSlug, workspaceId)
  if (!room) throw new Error(`Unknown room: ${input.roomSlug}`)
  const now = nowSeconds()
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO group_chat_messages (
        workspace_id, room_id, sender_type, sender_id, body, message_type, parent_message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspaceId,
      room.id,
      input.senderType,
      input.senderId,
      input.body.trim(),
      input.messageType || 'normal',
      input.parentMessageId || null,
      now,
    )
    const messageId = Number(result.lastInsertRowid)
    const delivery = db.prepare(`
      INSERT OR REPLACE INTO group_chat_message_delivery_state (
        workspace_id, message_id, recipient_type, recipient_id, state, state_at, evidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    delivery.run(workspaceId, messageId, 'room', room.slug, 'sent', now, 'local Mission Control DB commit')
    delivery.run(workspaceId, messageId, 'human', 'chris', input.senderId === 'chris' ? 'seen' : 'delivered', now, 'local fixture delivery')
    delivery.run(workspaceId, messageId, 'agent', 'koda', input.senderId === 'koda' ? 'seen' : 'delivered', now, 'local fixture delivery')
    delivery.run(workspaceId, messageId, 'agent', 'herm', input.senderId === 'herm' ? 'seen' : 'delivered', now, 'local fixture delivery')

    const assignments = parseActionMentions(input.body).map((assignee) =>
      createAssignmentForMention(db, workspaceId, room.id, messageId, assignee, input.body)
    )

    const message = listGroupChatMessages(room.slug, workspaceId).find(row => row.id === messageId)
    if (!message) throw new Error('Failed to read created message')
    return { message, assignments }
  })
  return tx()
}

export function updateGroupChatDeliveryState(input: {
  messageId: number
  recipientType: 'human' | 'agent' | 'room'
  recipientId: string
  state: GroupChatDeliveryState
  evidence?: string
  workspaceId?: number
}): GroupChatDelivery {
  const workspaceId = input.workspaceId || 1
  const db = getDatabase()
  const now = nowSeconds()
  db.prepare(`
    INSERT OR REPLACE INTO group_chat_message_delivery_state (
      workspace_id, message_id, recipient_type, recipient_id, state, state_at, evidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    workspaceId,
    input.messageId,
    input.recipientType,
    input.recipientId,
    input.state,
    now,
    input.evidence || 'manual Mission Control update',
  )
  return db.prepare(`
    SELECT * FROM group_chat_message_delivery_state
    WHERE workspace_id = ? AND message_id = ? AND recipient_type = ? AND recipient_id = ?
  `).get(workspaceId, input.messageId, input.recipientType, input.recipientId) as GroupChatDelivery
}

export function updateGroupChatAssignmentStatus(input: {
  assignmentId: number
  status: GroupChatTaskStatus
  evidence?: string
  workspaceId?: number
}): GroupChatAssignment {
  const workspaceId = input.workspaceId || 1
  const db = getDatabase()
  const now = nowSeconds()
  db.prepare(`
    UPDATE group_chat_assignment_tracker_items
    SET status = ?, evidence = COALESCE(?, evidence), updated_at = ?
    WHERE workspace_id = ? AND id = ?
  `).run(input.status, input.evidence || null, now, workspaceId, input.assignmentId)
  const assignment = db.prepare(`
    SELECT * FROM group_chat_assignment_tracker_items
    WHERE workspace_id = ? AND id = ?
  `).get(workspaceId, input.assignmentId) as GroupChatAssignment | undefined
  if (!assignment) throw new Error(`Unknown assignment: ${input.assignmentId}`)
  return assignment
}

export function createGroupChatDecisionReceipt(input: {
  roomSlug: string
  sourceMessageId?: number | null
  decision: string
  approvedBy: string
  approvalTier: GroupChatApprovalTier
  evidence?: string
  workspaceId?: number
}): GroupChatDecisionReceipt {
  const workspaceId = input.workspaceId || 1
  const db = getDatabase()
  const room = getGroupChatRoomBySlug(input.roomSlug, workspaceId)
  if (!room) throw new Error(`Unknown room: ${input.roomSlug}`)
  const now = nowSeconds()
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO group_chat_decision_receipts (
        workspace_id, room_id, source_message_id, decision, approved_by,
        approval_tier, evidence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspaceId,
      room.id,
      input.sourceMessageId || null,
      input.decision.trim(),
      input.approvedBy.trim(),
      input.approvalTier,
      input.evidence || null,
      now,
    )
    const messageResult = db.prepare(`
      INSERT INTO group_chat_messages (
        workspace_id, room_id, sender_type, sender_id, body, message_type, created_at
      ) VALUES (?, ?, 'system', 'decision-receipts', ?, 'decision_receipt', ?)
    `).run(
      workspaceId,
      room.id,
      `Decision receipt: ${input.decision.trim()} (${input.approvalTier}, approved by ${input.approvedBy.trim()})`,
      now,
    )
    const messageId = Number(messageResult.lastInsertRowid)
    const delivery = db.prepare(`
      INSERT OR REPLACE INTO group_chat_message_delivery_state (
        workspace_id, message_id, recipient_type, recipient_id, state, state_at, evidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    delivery.run(workspaceId, messageId, 'room', room.slug, 'sent', now, 'decision receipt created')
    delivery.run(workspaceId, messageId, 'human', 'chris', 'seen', now, 'decision receipt visible in Mission Control')
    delivery.run(workspaceId, messageId, 'agent', 'koda', 'delivered', now, 'decision receipt visible in Mission Control')
    delivery.run(workspaceId, messageId, 'agent', 'herm', 'delivered', now, 'decision receipt visible in Mission Control')
    return db.prepare(`
      SELECT * FROM group_chat_decision_receipts
      WHERE workspace_id = ? AND id = ?
    `).get(workspaceId, result.lastInsertRowid) as GroupChatDecisionReceipt
  })
  return tx()
}
