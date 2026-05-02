import { getDatabase } from './db'

export type BrainMemoryLayerStatus =
  | 'present_only'
  | 'refreshing'
  | 'queried_manually'
  | 'runtime_backed'
  | 'operationally_adopted'
  | 'isolated'
  | 'evidence_missing'
  | 'blocked'

export type BrainMemoryCorrectionStatus = 'staged' | 'approved' | 'applied' | 'rejected' | 'blocked'

export interface BrainMemoryDetail {
  label: string
  value: string
  status: 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'planned' | 'blocked'
}

export interface BrainMemoryLayer {
  id: number
  workspace_id: number
  layer_key: string
  label: string
  layer_type: string
  status: BrainMemoryLayerStatus
  domain: string
  evidence_path: string | null
  runtime_adoption: string
  next_action: string
  created_at: number
  updated_at: number
  details: BrainMemoryDetail[]
}

export interface BrainMemoryCorrectionRequest {
  id: number
  workspace_id: number
  request_key: string
  title: string
  status: BrainMemoryCorrectionStatus
  domain: string
  evidence_path: string | null
  requested_change: string
  next_action: string
  created_at: number
  updated_at: number
  details: BrainMemoryDetail[]
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

function layerStatusDetail(status: BrainMemoryLayerStatus): BrainMemoryDetail {
  if (status === 'runtime_backed' || status === 'operationally_adopted' || status === 'queried_manually') {
    return { label: 'Read-path gate', value: 'Read path is visible for review only; writes still require approved ingestion/correction receipts.', status: 'read_only' }
  }
  if (status === 'isolated' || status === 'blocked') {
    return { label: 'Isolation / block gate', value: 'Blocked from cross-domain writes or adoption until an explicit approved receipt changes this boundary.', status: 'blocked' }
  }
  if (status === 'evidence_missing') {
    return { label: 'Evidence gate', value: 'Evidence Missing: storage, freshness, read-path, or runtime-adoption proof is not attached.', status: 'evidence_missing' }
  }
  return { label: 'Adoption gate', value: 'Not Instrumented Yet for operational runtime adoption; treat as planned/manual memory only.', status: 'not_instrumented' }
}

function layerDetails(layer: Omit<BrainMemoryLayer, 'details'>): BrainMemoryDetail[] {
  return [
    layerStatusDetail(layer.status),
    {
      label: 'Runtime adoption',
      value: `${layer.runtime_adoption.replace(/_/g, ' ')} for ${layer.domain}; Mission Control does not convert this into a write-enabled memory claim.`,
      status: layer.status === 'runtime_backed' || layer.status === 'operationally_adopted' || layer.status === 'queried_manually' ? 'read_only' : layer.status === 'isolated' || layer.status === 'blocked' ? 'blocked' : 'not_instrumented',
    },
    {
      label: 'Write authority boundary',
      value: layer.layer_type === 'david_brain'
        ? 'David memory remains Material Solutions-only isolated; no Vortex, Blackwire, trading, or internal project memory writes.'
        : 'Graphify/gBrain/agent-memory writes are disabled here unless an approved ingestion or correction receipt exists.',
      status: layer.layer_type === 'david_brain' ? 'blocked' : 'approval_required',
    },
  ]
}

function correctionDetails(request: Omit<BrainMemoryCorrectionRequest, 'details'>): BrainMemoryDetail[] {
  return [
    {
      label: 'Evidence requirement',
      value: request.evidence_path ? `Receipt attached: ${request.evidence_path}` : 'Evidence Missing: correction cannot be applied without a source receipt.',
      status: request.evidence_path ? 'read_only' : 'evidence_missing',
    },
    {
      label: 'Approval / application gate',
      value: request.status === 'applied'
        ? 'Applied corrections are read-only facts here; this surface still does not perform writes.'
        : 'Approval Required: staged corrections cannot write Graphify, gBrain, David memory, or long-term memory from this surface.',
      status: request.status === 'applied' ? 'read_only' : request.status === 'rejected' || request.status === 'blocked' ? 'blocked' : 'approval_required',
    },
    {
      label: 'Destination boundary',
      value: request.domain.includes('David') || request.domain.includes('Material Solutions')
        ? 'Material Solutions/David corrections must stay in the isolated David lane.'
        : 'Cross-project memory corrections must stay receipt-gated and cannot overwrite customer/David memory.',
      status: request.domain.includes('David') || request.domain.includes('Material Solutions') ? 'blocked' : 'approval_required',
    },
  ]
}

export function listBrainMemoryLayers(workspaceId = 1): BrainMemoryLayer[] {
  const layers = getDatabase().prepare(`
    SELECT * FROM mission_control_brain_memory_layers
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'evidence_missing' THEN 1
        WHEN 'present_only' THEN 2
        WHEN 'refreshing' THEN 3
        WHEN 'queried_manually' THEN 4
        WHEN 'runtime_backed' THEN 5
        WHEN 'operationally_adopted' THEN 6
        WHEN 'isolated' THEN 7
        ELSE 8
      END,
      domain,
      label
  `).all(workspaceId) as Array<Omit<BrainMemoryLayer, 'details'>>

  return layers.map((layer) => ({ ...layer, details: layerDetails(layer) }))
}

export function listBrainMemoryCorrectionRequests(workspaceId = 1): BrainMemoryCorrectionRequest[] {
  const requests = getDatabase().prepare(`
    SELECT * FROM mission_control_brain_memory_correction_requests
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'staged' THEN 1
        WHEN 'approved' THEN 2
        WHEN 'applied' THEN 3
        ELSE 4
      END,
      domain,
      title
  `).all(workspaceId) as Array<Omit<BrainMemoryCorrectionRequest, 'details'>>

  return requests.map((request) => ({ ...request, details: correctionDetails(request) }))
}

export function getBrainMemorySnapshot(workspaceId = 1) {
  const layers = listBrainMemoryLayers(workspaceId)
  const correctionRequests = listBrainMemoryCorrectionRequests(workspaceId)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Brain / Memory is read-only in this MVP slice; it does not write Graphify, gBrain, wiki, Obsidian, David memory, or long-term agent memory.',
      'Graphify/gBrain writes require approved ingestion or correction receipts; direct casual writes remain blocked.',
      'David memory remains Material Solutions-only isolated and must not mix with Vortex, Blackwire, trading, or internal project memory.',
      'Memory tools without runtime adoption proof stay Evidence Missing or Present Only; no fake operational-adoption claims.',
    ],
    summary: {
      totalLayers: layers.length,
      runtimeBackedLayers: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_layers WHERE workspace_id = ? AND status IN ('runtime_backed', 'operationally_adopted')`, workspaceId),
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_layers WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      correctionRequests: correctionRequests.length,
      stagedCorrections: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_correction_requests WHERE workspace_id = ? AND status = 'staged'`, workspaceId),
      approvedCorrections: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_correction_requests WHERE workspace_id = ? AND status = 'approved'`, workspaceId),
      appliedCorrections: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_correction_requests WHERE workspace_id = ? AND status = 'applied'`, workspaceId),
      blockedCorrections: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_correction_requests WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      isolatedLayers: countBy(`SELECT COUNT(*) as count FROM mission_control_brain_memory_layers WHERE workspace_id = ? AND status = 'isolated'`, workspaceId),
      writeGatesVisible: layers.length + correctionRequests.length,
      writeEnabled: false,
      davidIsolationEnforced: true,
    },
    layers,
    correctionRequests,
  }
}
