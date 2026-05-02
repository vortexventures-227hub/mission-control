import { getDatabase } from './db'

export type DesignStudioItemStatus =
  | 'planned'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'receipt_backed'
  | 'qa_ready'

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

export function getDesignStudioSnapshot(workspaceId = 1) {
  const items = listDesignStudioItems(workspaceId)
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
      visualReceiptsLinked: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND screenshot_path IS NOT NULL`, workspaceId),
      externalPublishEnabled: false,
      visualQaProven: countBy(`SELECT COUNT(*) as count FROM mission_control_design_studio_items WHERE workspace_id = ? AND status = 'receipt_backed' AND screenshot_path IS NOT NULL`, workspaceId) > 0,
      patchRuntimeAuthority: false,
    },
    items,
  }
}
