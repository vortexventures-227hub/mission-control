import { getDatabase } from './db'
import { existsSync, statSync } from 'fs'
import {
  getGroupChatRoomBySlug,
  listGroupChatAgentProfiles,
  listGroupChatAssignments,
  listGroupChatDecisionReceipts,
  listGroupChatMessages,
  listGroupChatQueuedAlerts,
  listGroupChatRooms,
} from './group-chat'
import { getAssetLibrarySnapshot } from './asset-library-command'
import { getBrainstormSnapshot } from './brainstorm-command'
import { getBrainMemorySnapshot } from './brain-memory-command'
import { getDesignStudioSnapshot } from './design-studio-command'
import { getResearchCommandSnapshot } from './research-command'
import { getSecurityCommandSnapshot } from './security-command-center'
import { getTradingOperationsSnapshot } from './trading-operations-command'

export interface MvpSurfaceStatus {
  id: string
  label: string
  status: 'live' | 'partial' | 'not_instrumented' | 'isolated'
  detail: string
  href?: string
}

export interface MvpEvidenceRow {
  id: string
  label: string
  status: 'live' | 'manual' | 'not_instrumented' | 'isolated' | 'evidence_missing'
  sourcePath: string
  lastChecked: number | null
  evidence: string
}

export interface MvpTruthGate {
  id: string
  label: string
  status: 'approval_required' | 'not_instrumented' | 'blocked' | 'evidence_missing' | 'read_only'
  detail: string
  blockedAction: string
  evidence: string
  href?: string
}

export interface MvpBlackwireGate {
  id: string
  label: string
  status: 'read_only' | 'approval_required' | 'evidence_missing' | 'blocked'
  detail: string
  requiredEvidence: string
  source: string
  href?: string
}

function scalarCount(sql: string, ...params: unknown[]): number {
  const db = getDatabase()
  const row = db.prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

function safeCount(sql: string, ...params: unknown[]): number {
  try {
    return scalarCount(sql, ...params)
  } catch {
    return 0
  }
}

function pathRow(id: string, label: string, sourcePath: string, fallbackStatus: MvpEvidenceRow['status'], evidence: string): MvpEvidenceRow {
  try {
    const stat = existsSync(sourcePath) ? statSync(sourcePath) : null
    return {
      id,
      label,
      status: stat ? fallbackStatus : 'evidence_missing',
      sourcePath,
      lastChecked: stat ? Math.floor(stat.mtimeMs / 1000) : null,
      evidence: stat ? evidence : 'Path missing during local proof; do not mark green.',
    }
  } catch {
    return {
      id,
      label,
      status: 'evidence_missing',
      sourcePath,
      lastChecked: null,
      evidence: 'Path check failed; do not mark green.',
    }
  }
}

export function getMissionControlMvpSnapshot(workspaceId = 1) {
  const rooms = listGroupChatRooms(workspaceId)
  const blackwireRoom = getGroupChatRoomBySlug('blackwire-ops', workspaceId) || rooms.find((room) => room.kind === 'project') || rooms[0] || null
  const commandRoom = getGroupChatRoomBySlug('command', workspaceId) || rooms.find((room) => room.kind === 'command') || null
  const selectedRoom = blackwireRoom || commandRoom
  const messages = selectedRoom ? listGroupChatMessages(selectedRoom.slug, workspaceId) : []
  const commandMessages = commandRoom ? listGroupChatMessages(commandRoom.slug, workspaceId) : []
  const assignments = selectedRoom ? listGroupChatAssignments(selectedRoom.id, workspaceId) : []
  const receipts = selectedRoom ? listGroupChatDecisionReceipts(selectedRoom.id, workspaceId) : []
  const queuedAlerts = selectedRoom ? listGroupChatQueuedAlerts(selectedRoom.id, workspaceId) : []
  const agents = listGroupChatAgentProfiles(workspaceId)
  const projects = safeCount(`SELECT COUNT(*) as count FROM projects WHERE workspace_id = ? AND status = 'active'`, workspaceId)
  const tasks = safeCount(`SELECT COUNT(*) as count FROM tasks WHERE workspace_id = ?`, workspaceId)
  const doneWithEvidence = safeCount(`SELECT COUNT(*) as count FROM group_chat_assignment_tracker_items WHERE workspace_id = ? AND status = 'done' AND evidence IS NOT NULL AND TRIM(evidence) != ''`, workspaceId)
  const doneWithoutEvidence = safeCount(`SELECT COUNT(*) as count FROM group_chat_assignment_tracker_items WHERE workspace_id = ? AND status = 'done' AND (evidence IS NULL OR TRIM(evidence) = '')`, workspaceId)
  const approvalsPending = safeCount(`SELECT COUNT(*) as count FROM exec_approval_requests WHERE workspace_id = ? AND status IN ('pending','requested')`, workspaceId)
  const approvalNeededAssignments = assignments.filter((assignment) => assignment.priority === 'approval_needed' || assignment.priority === 'blocker' || assignment.status === 'blocked').length
  const messageDeliveryStates = messages.flatMap((message) => message.delivery.map((delivery) => delivery.state))
  const security = getSecurityCommandSnapshot(workspaceId)
  const assetLibrarySurface = getAssetLibrarySnapshot(workspaceId)
  const brainstormSurface = getBrainstormSnapshot(workspaceId)
  const brainMemorySurface = getBrainMemorySnapshot(workspaceId)
  const researchSurface = getResearchCommandSnapshot(workspaceId)
  const tradingSurface = getTradingOperationsSnapshot(workspaceId)
  const designSurface = getDesignStudioSnapshot(workspaceId)
  const dbBackedCommandSurfaces = [
    assetLibrarySurface.summary.totalAssets,
    brainstormSurface.summary.totalIdeas,
    brainMemorySurface.summary.totalLayers,
    researchSurface.summary.totalBriefs,
    tradingSurface.summary.totalWatchItems,
    designSurface.summary.totalDesignItems,
  ].filter((count) => Number(count) > 0).length
  const memoryInventory: MvpEvidenceRow[] = [
    pathRow('koda-graphify', 'Koda Graphify / mailbox memory', '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/graphify-out', 'manual', 'Inventory-only graph output exists; not automatic long-term runtime memory.'),
    pathRow('koda-vault', 'KodaVault', '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/KodaVault', 'manual', 'Operator-owned Koda context folder exists.'),
    pathRow('david-current-inventory', 'David current inventory memory', '/Users/vortexventures/Desktop/Vortex Ventures/VVMaterialSolutionsOps/agents/david/memory/current_inventory/UP_TO_DATE_CURRENT_INVENTORY.md', 'manual', 'David inventory truth file exists but Retell/static KB sync must remain explicit.'),
    pathRow('david-runtime', 'David runtime', '/Users/vortexventures/Desktop/Vortex Ventures/VVMaterialSolutionsOps/runtime/david-agent', 'not_instrumented', 'Runtime path exists; Mission Control adapter is not yet live.'),
  ]
  const assetLibrary: MvpEvidenceRow[] = [
    pathRow('vvms-inventory-media', 'Material Solutions inventory media', '/Users/vortexventures/Desktop/Vortex Ventures/VVMaterialSolutionsOps/Inventory', 'manual', 'Canonical media folder exists; asset card is manual evidence, not an automated DAM yet.'),
    pathRow('mission-receipts', 'Mission Control receipts', '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Outbox', 'manual', 'Receipts are filesystem-backed and searchable by path.'),
    pathRow('blackwire-handoff', 'Blackwire handoff folder', '/Users/vortexventures/Desktop/Vortex Ventures/Blackwire Ops/Push Button Ops/Herm_BlackOps_PushButton/handoff', 'manual', 'Historical trackers and sprint receipts remain evidence assets.'),
  ]
  const brainstormWall: MvpEvidenceRow[] = [
    {
      id: 'blackwire-room-brainstorm',
      label: 'Brainstorm capture into Blackwire room',
      status: 'isolated',
      sourcePath: '/api/group-chat/messages',
      lastChecked: Math.floor(Date.now() / 1000),
      evidence: 'Command Truth can log brainstorm notes as isolated messages; not promoted to decisions without receipts.',
    },
  ]
  const newProjectChecklist: MvpEvidenceRow[] = [
    {
      id: 'canonical-root-required',
      label: 'Canonical root required',
      status: 'live',
      sourcePath: '/Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps',
      lastChecked: Math.floor(Date.now() / 1000),
      evidence: 'New projects must declare one canonical root before being treated as active Mission Control work.',
    },
    {
      id: 'receipt-path-required',
      label: 'Receipt path required',
      status: 'live',
      sourcePath: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Outbox',
      lastChecked: Math.floor(Date.now() / 1000),
      evidence: 'Receipts remain the proof trail until Mission Control supersedes filesystem dispatch.',
    },
    {
      id: 'owner-status-evidence',
      label: 'Owner + status + evidence',
      status: 'live',
      sourcePath: '/api/group-chat/assignments',
      lastChecked: Math.floor(Date.now() / 1000),
      evidence: 'Assignment tracker items carry owner, status, and evidence fields; Done requires evidence.',
    },
  ]

  const blackwireDoneGates: MvpBlackwireGate[] = [
    {
      id: 'room-source-of-truth',
      label: 'Blackwire group chat source-of-truth',
      status: selectedRoom ? 'read_only' : 'evidence_missing',
      detail: selectedRoom ? `${selectedRoom.name} is the selected Blackwire room with ${messages.length} message(s) visible to Command Truth.` : 'Evidence Missing: no Blackwire project room is available in the group-chat store.',
      requiredEvidence: 'A project room, recent message history, and delivery states before using chat as operational truth.',
      source: selectedRoom ? `/group-chat/${selectedRoom.slug}` : '/api/group-chat/rooms',
      href: '/group-chat',
    },
    {
      id: 'assignment-board-evidence',
      label: 'Task board / evidence-gated Done',
      status: doneWithoutEvidence > 0 ? 'blocked' : assignments.length ? 'read_only' : 'evidence_missing',
      detail: `${assignments.length} Blackwire board item(s); ${doneWithEvidence} Done with evidence; ${doneWithoutEvidence} Done without evidence.`,
      requiredEvidence: 'Every Done board item must carry a non-empty evidence path or receipt reference; Done without evidence is blocked, not green.',
      source: 'group_chat_assignment_tracker_items',
      href: '/group-chat',
    },
    {
      id: 'approval-receipt-gate',
      label: 'Approval / decision receipt gate',
      status: approvalsPending > 0 || approvalNeededAssignments > 0 ? 'approval_required' : receipts.length ? 'read_only' : 'evidence_missing',
      detail: `${receipts.length} Blackwire decision receipt(s); ${approvalsPending} pending exec approval(s); ${approvalNeededAssignments} approval/blocker board item(s).`,
      requiredEvidence: 'Approval-required work needs a scoped decision receipt or pending approval object before external, paid, trading, memory-write, or customer-facing action.',
      source: 'group_chat_decision_receipts + exec_approval_requests',
      href: '/exec-approvals',
    },
    {
      id: 'recipient-delivery-proof',
      label: 'Recipient delivery / agent proof gate',
      status: messageDeliveryStates.length ? 'read_only' : 'evidence_missing',
      detail: messageDeliveryStates.length ? `Latest delivery states visible: ${Array.from(new Set(messageDeliveryStates)).join(' / ')}.` : 'Evidence Missing: no sent/delivered/seen delivery state is attached to the selected Blackwire messages.',
      requiredEvidence: 'Assignments should show recipient delivery or queued-alert state plus agent card proof before assuming the assignee saw it.',
      source: 'group_chat_message_delivery_state + group_chat_agent_profile_cards',
      href: '/agents',
    },
  ]

  const truthGates: MvpTruthGate[] = [
    {
      id: 'external-marketing-actions',
      label: 'External marketing sends / posts / spend',
      status: 'approval_required',
      detail: 'Marketing Command Center can stage drafts and approvals only; analytics remain Not Instrumented Yet until wired.',
      blockedAction: 'No email/SMS/social/marketplace/ad sends, posts, campaign mutation, or spend.',
      evidence: 'Marketing summary externalActionsApprovalGated=true; public launch remains blocked behind Security Command Center posture and scoped approval.',
      href: '/marketing',
    },
    {
      id: 'karpathia-auto-research',
      label: 'Karpathia Auto-Research connector',
      status: 'not_instrumented',
      detail: 'Research briefs are visible, but autonomous source collection/citation connectors are Not Instrumented Yet.',
      blockedAction: 'No autonomous external research claims or source-backed promotion without receipts.',
      evidence: `karpathiaConnectorInstrumented=${researchSurface.summary.karpathiaConnectorInstrumented ? 'true' : 'false'}`,
      href: '/research-command',
    },
    {
      id: 'mirofish-paid-simulations',
      label: 'MiroFish paid simulations',
      status: 'approval_required',
      detail: 'Simulation Lab can stage briefs only; paid runs, external compute spend, or account mutation require explicit Chris approval.',
      blockedAction: 'No paid simulation execution or external compute spend.',
      evidence: `paidSimulationApprovalRequired=${researchSurface.summary.paidSimulationApprovalRequired ? 'true' : 'false'}`,
      href: '/research-command',
    },
    {
      id: 'trading-execution',
      label: 'Trading execution / wallet mutation',
      status: 'blocked',
      detail: 'Trading Operations is a watch/risk shell only; no connector, order route, positions/fills/P&L, wallet, account, or API-key mutation is enabled.',
      blockedAction: 'No real trades, order placement/cancel, wallet/account mutation, or market API-key use.',
      evidence: `executionEnabled=${tradingSurface.summary.executionEnabled ? 'true' : 'false'}; walletMutationEnabled=${tradingSurface.summary.walletMutationEnabled ? 'true' : 'false'}`,
      href: '/trading',
    },
    {
      id: 'graphify-gbrain-writes',
      label: 'Graphify / gBrain writes',
      status: 'approval_required',
      detail: 'Brain/Memory browse and correction staging are visible; writes only through approved ingestion/correction receipts.',
      blockedAction: 'No Graphify/gBrain writes from Mission Control without approved correction receipt.',
      evidence: `writeEnabled=${brainMemorySurface.summary.writeEnabled ? 'true' : 'false'}; correctionRequests=${brainMemorySurface.summary.correctionRequests}`,
      href: '/brain-memory',
    },
    {
      id: 'david-memory-isolation',
      label: 'David memory isolation',
      status: 'blocked',
      detail: 'David memory remains Material Solutions-only and must not mix with Vortex/Blackwire internal memory.',
      blockedAction: 'No David memory cross-write or context mixing.',
      evidence: `davidIsolationEnforced=${brainMemorySurface.summary.davidIsolationEnforced ? 'true' : 'false'}`,
      href: '/brain-memory',
    },
  ]

  const surfaces: MvpSurfaceStatus[] = [
    { id: 'command-truth', label: 'Command Truth Dashboard', status: 'live', detail: `${commandMessages.length} command-room messages; canonical root active, legacy rollback path visible.`, href: '/command-truth' },
    { id: 'security-command', label: 'Security Command Center', status: security.posture.openFindings ? 'partial' : 'live', detail: `${security.posture.systems} systems, ${security.posture.openFindings} open findings; missing hooks stay Not Instrumented Yet.`, href: '/security' },
    { id: 'blackwire-room', label: 'Blackwire Room', status: selectedRoom ? 'live' : 'partial', detail: selectedRoom ? `${selectedRoom.name}: ${messages.length} messages, ${messageDeliveryStates.join(' / ') || 'no delivery states yet'}` : 'No room seeded yet.', href: '/group-chat' },
    { id: 'assignment-boards', label: 'Assignment Tracker Boards', status: assignments.length ? 'live' : 'partial', detail: `${assignments.length} Blackwire board items; ${doneWithEvidence} Done with evidence.`, href: '/group-chat' },
    { id: 'approvals', label: 'Approvals', status: 'live', detail: `${receipts.length} group-chat receipts; ${approvalsPending} exec approvals pending.`, href: '/exec-approvals' },
    { id: 'agent-registry', label: 'Agent Registry / Cards', status: agents.length ? 'live' : 'partial', detail: `${agents.length} agent cards with status/current assignment/proof.`, href: '/agents' },
    { id: 'receipts-evidence-search', label: 'Receipts / Evidence / Search', status: 'live', detail: 'Group Chat search covers messages, task evidence, assignees, and decision receipts.', href: '/group-chat' },
    { id: 'notifications-queues', label: 'Notifications / Queues', status: queuedAlerts.length ? 'live' : 'partial', detail: `${queuedAlerts.length} queued agent alerts for offline or unproven recipients.`, href: '/group-chat' },
    { id: 'metrics-cockpit', label: 'Metrics Cockpit', status: 'live', detail: `${projects} active projects, ${tasks} tasks, ${messages.length} Blackwire messages, ${agents.filter((a) => a.status === 'online_proven').length} online-proven agents.`, href: '/command-truth' },
    { id: 'brain-memory', label: 'Brain / Memory Surfaces', status: brainMemorySurface.summary.totalLayers ? 'partial' : 'not_instrumented', detail: brainMemorySurface.summary.totalLayers ? `${brainMemorySurface.summary.totalLayers} memory layers and ${brainMemorySurface.summary.correctionRequests} correction requests; writes disabled, David isolation enforced: ${brainMemorySurface.summary.davidIsolationEnforced ? 'yes' : 'no'}.` : 'Not Instrumented Yet: no DB-backed memory-layer inventory counted; isolated from chat truth.', href: '/brain-memory' },
    { id: 'asset-library', label: 'Asset Library', status: assetLibrarySurface.summary.totalAssets ? 'partial' : 'not_instrumented', detail: assetLibrarySurface.summary.totalAssets ? `${assetLibrarySurface.summary.totalAssets} asset records; ${assetLibrarySurface.summary.evidenceMissing} Evidence Missing; external publish enabled: ${assetLibrarySurface.summary.externalPublishEnabled ? 'yes' : 'no'}.` : 'Not Instrumented Yet: asset library UI shell is visible; no asset-library records counted.', href: '/asset-library' },
    { id: 'marketing-command-center', label: 'Marketing Command Center', status: 'partial', detail: 'Global marketing OS and per-project Marketing tab data are runtime-visible; external sends/posts/spend are approval-gated and analytics remain Not Instrumented Yet.', href: '/marketing' },
    { id: 'research-command', label: 'Research Command Center / Karpathia / MiroFish', status: researchSurface.summary.totalBriefs ? 'partial' : 'not_instrumented', detail: researchSurface.summary.totalBriefs ? `${researchSurface.summary.totalBriefs} research briefs; Karpathia connector Not Instrumented Yet: ${researchSurface.summary.karpathiaConnectorInstrumented ? 'no' : 'yes'}; MiroFish paid simulations require approval: ${researchSurface.summary.paidSimulationApprovalRequired ? 'yes' : 'no'}.` : 'Not Instrumented Yet: no research-brief inventory counted.', href: '/research-command' },
    { id: 'design-studio', label: 'Design Studio', status: designSurface.summary.totalDesignItems ? 'partial' : 'not_instrumented', detail: designSurface.summary.totalDesignItems ? `${designSurface.summary.totalDesignItems} design inventory rows; ${designSurface.summary.visualReceiptsLinked} visual receipts linked; external publish enabled: ${designSurface.summary.externalPublishEnabled ? 'yes' : 'no'}.` : 'Not Instrumented Yet: no design inventory counted.', href: '/design' },
    { id: 'trading-operations', label: 'Trading Operations Cockpit', status: tradingSurface.summary.totalWatchItems ? 'partial' : 'not_instrumented', detail: tradingSurface.summary.totalWatchItems ? `${tradingSurface.summary.totalWatchItems} watch/risk rows; execution blocked: ${tradingSurface.summary.executionEnabled ? 'no' : 'yes'}; wallet mutation enabled: ${tradingSurface.summary.walletMutationEnabled ? 'yes' : 'no'}.` : 'Not Instrumented Yet: no trading watch/risk inventory counted.', href: '/trading' },
    { id: 'local-app-packaging', label: 'Local App / Install Packaging', status: 'partial', detail: 'PWA manifest, app icons, Apple web-app metadata, and standalone display are present; service worker is static-asset-only so dynamic command data is not cached. Internal packaging evidence only, not deploy/public-launch authority.', href: '/mission-control' },
    { id: 'brainstorm-wall', label: 'Brainstorm Wall', status: brainstormSurface.summary.totalIdeas ? 'partial' : 'isolated', detail: brainstormSurface.summary.totalIdeas ? `${brainstormSurface.summary.totalIdeas} ideas; ${brainstormSurface.summary.evidenceMissing} Evidence Missing; auto-promotion enabled: ${brainstormSurface.summary.autoPromotionEnabled ? 'yes' : 'no'}.` : 'Isolated MVP surface: local idea capture is intentionally separated from command truth until wired.', href: '/brainstorm' },
    { id: 'new-project', label: 'New Project Creation', status: 'live', detail: 'POST /api/projects is available from the Command Truth quick-create form.', href: '/command-truth' },
    { id: 'canonical-roots', label: 'Canonical Roots / Legacy Rollback', status: 'live', detail: 'Active path: /Desktop/Vortex Ventures/VVMissionControlOps/mission-control. Legacy rollback: git history + existing origin/main ahead state.' },
  ]

  return {
    generatedAt: Date.now(),
    canonical: {
      activePath: '/Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps/mission-control',
      legacyRollback: 'git history / origin/main rollback; no external deploy touched',
      sourceOfTruth: 'Mission Control local SQLite + canonical repo UI',
    },
    metrics: {
      rooms: rooms.length,
      messages: messages.length,
      assignments: assignments.length,
      receipts: receipts.length,
      queuedAlerts: queuedAlerts.length,
      agents: agents.length,
      projects,
      tasks,
      doneWithEvidence,
      doneWithoutEvidence,
      approvalNeededAssignments,
      securityOpenFindings: security.posture.openFindings,
      securitySystems: security.posture.systems,
      dbBackedCommandSurfaces,
    },
    blackwireFlow: [
      'Command Truth dashboard',
      'Blackwire room',
      'sent / delivered / seen delivery receipts',
      '@mention or plain-English task capture',
      'assignment board + agent sub-board',
      'approval-needed block / decision receipt',
      'evidence required before Done',
      'agent card status/current proof',
      'canonical active path + legacy rollback note',
    ],
    rooms,
    selectedRoom,
    messages: messages.slice(-12),
    assignments,
    receipts,
    queuedAlerts,
    agents,
    surfaces,
    blackwireDoneGates,
    truthGates,
    security,
    memoryInventory,
    assetLibrary,
    brainstormWall,
    newProjectChecklist,
  }
}
