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
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listBrainMemoryLayers(workspaceId = 1): BrainMemoryLayer[] {
  return getDatabase().prepare(`
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
  `).all(workspaceId) as BrainMemoryLayer[]
}

export function listBrainMemoryCorrectionRequests(workspaceId = 1): BrainMemoryCorrectionRequest[] {
  return getDatabase().prepare(`
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
  `).all(workspaceId) as BrainMemoryCorrectionRequest[]
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
      writeEnabled: false,
      davidIsolationEnforced: true,
    },
    layers,
    correctionRequests,
  }
}
