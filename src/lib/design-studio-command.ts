import { getDatabase } from './db'

export type DesignStudioItemStatus =
  | 'planned'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'receipt_backed'
  | 'qa_ready'

export type DesignStudioDetailStatus = 'read_only' | 'evidence_missing' | 'planned' | 'blocked' | 'approval_required'

export interface DesignStudioItem {
  id: number
  workspace_id: number
  item_key: string
  title: string
  lane: string
  status: DesignStudioItemStatus
  owner_agent: string
  evidence_path: string | null
  screenshot_path: string | null
  next_action: string
  created_at: number
  updated_at: number
}

export interface EnrichedDesignStudioItem extends DesignStudioItem {
  details: Array<{ label: string; value: string; status: DesignStudioDetailStatus }>
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listDesignStudioItems(workspaceId = 1): DesignStudioItem[] {
  return getDatabase().prepare(`
    SELECT * FROM mission_control_design_studio_items
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'approval_required' THEN 1
        WHEN 'evidence_missing' THEN 2
        WHEN 'planned' THEN 3
        WHEN 'qa_ready' THEN 4
        WHEN 'receipt_backed' THEN 5
        ELSE 6
      END,
      lane,
      title
  `).all(workspaceId) as DesignStudioItem[]
}

function qaGateDetail(item: DesignStudioItem): { label: string; value: string; status: DesignStudioDetailStatus } {
  if (item.screenshot_path) {
    return {
      label: 'Visual QA gate',
      value: `Visual receipt linked at ${item.screenshot_path}. Treat as read-only proof only; do not infer production approval beyond the receipt scope.`,
      status: 'read_only',
    }
  }
  if (item.status === 'blocked') {
    return {
      label: 'Visual QA gate',
      value: 'Blocked: no visual receipt should be promoted, published, or customer-facing until the blocker is cleared.',
      status: 'blocked',
    }
  }
  return {
    label: 'Visual QA gate',
    value: 'Evidence Missing: capture and link a screenshot/browser proof receipt before claiming visual QA complete.',
    status: 'evidence_missing',
  }
}

function designDecisionDetail(item: DesignStudioItem): { label: string; value: string; status: DesignStudioDetailStatus } {
  return {
    label: 'Design decision / receipt',
    value: item.evidence_path || 'Evidence Missing: attach token audit, decision log, component inventory, browser proof, or design QA receipt.',
    status: item.evidence_path ? 'read_only' : 'evidence_missing',
  }
}

function authorityDetail(item: DesignStudioItem): { label: string; value: string; status: DesignStudioDetailStatus } {
  return {
    label: 'Authority boundary',
    value: `Owner ${item.owner_agent} may use this as a design/QA planning surface only. It grants no env, deploy, David, trading, memory-write, external publish, or customer-facing mutation authority.`,
    status: item.status === 'blocked' ? 'blocked' : 'approval_required',
  }
}

function enrichDesignItem(item: DesignStudioItem): EnrichedDesignStudioItem {
  return {
    ...item,
    details: [qaGateDetail(item), designDecisionDetail(item), authorityDetail(item)],
  }
}

export function getDesignStudioSnapshot(workspaceId = 1) {
  const items = listDesignStudioItems(workspaceId)
  const enrichedItems = items.map(enrichDesignItem)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Design Studio is read-only in this MVP slice; it inventories brand, component, visual receipt, and decision cards only.',
      'Visual QA must remain Evidence Missing until screenshot or browser proof receipts are linked.',
      'No external publishing, marketplace posting, campaign launch, production design mutation, or customer-facing change is performed from this surface.',
      'Patch/Claw Design may support product/UI composition only when explicitly rebooted and scoped; Design Studio does not grant architecture, env, deploy, David, trading, or memory-write authority.',
    ],
    summary: {
      totalDesignItems: items.length,
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      blockedDesignItems: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      approvalRequiredItems: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND status = 'approval_required'`, workspaceId),
      visualReceiptsLinked: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND screenshot_path IS NOT NULL`, workspaceId),
      qaGatesVisible: enrichedItems.filter((item) => item.details.some((detail) => detail.label === 'Visual QA gate')).length,
      designReceiptsLinked: enrichedItems.filter((item) => Boolean(item.evidence_path)).length,
      externalPublishEnabled: false,
      visualQaProven: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND status = 'receipt_backed' AND screenshot_path IS NOT NULL`, workspaceId) > 0,
      patchRuntimeAuthority: false,
    },
    items: enrichedItems,
  }
}
