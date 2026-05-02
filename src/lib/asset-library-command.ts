import { getDatabase } from './db'

export type AssetLibraryStatus = 'verified' | 'evidence_missing' | 'draft' | 'blocked'

export interface AssetLibraryItem {
  id: number
  workspace_id: number
  asset_key: string
  title: string
  asset_type: string
  status: AssetLibraryStatus
  owner_project: string
  evidence_path: string | null
  source_url: string | null
  next_action: string
  created_at: number
  updated_at: number
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listAssetLibraryItems(workspaceId = 1): AssetLibraryItem[] {
  return getDatabase().prepare(`
    SELECT * FROM mission_control_asset_library_items
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'evidence_missing' THEN 1
        WHEN 'draft' THEN 2
        ELSE 3
      END,
      owner_project,
      title
  `).all(workspaceId) as AssetLibraryItem[]
}

export function getAssetLibrarySnapshot(workspaceId = 1) {
  const assets = listAssetLibraryItems(workspaceId)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Asset Library is read-only in this MVP slice; it does not publish, post, spend, or mutate external tools.',
      'Asset cards with no evidence_path or source_url stay Evidence Missing and must not be presented as verified inventory.',
      'Promotion from asset to campaign, design, trade, memory, or customer-facing action requires a scoped approval and receipt.',
    ],
    summary: {
      totalAssets: assets.length,
      verifiedAssets: countBy(`SELECT COUNT(*) as count FROM mission_control_asset_library_items WHERE workspace_id = ? AND status = 'verified'`, workspaceId),
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_asset_library_items WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      blockedAssets: countBy(`SELECT COUNT(*) as count FROM mission_control_asset_library_items WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      externalPublishEnabled: false,
    },
    assets,
  }
}
