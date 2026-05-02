import { getDatabase } from './db'

export type AssetLibraryStatus = 'verified' | 'evidence_missing' | 'draft' | 'blocked'
export type AssetLibraryDetailStatus = 'read_only' | 'evidence_missing' | 'planned' | 'blocked' | 'approval_required'

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

export interface EnrichedAssetLibraryItem extends AssetLibraryItem {
  details: Array<{ label: string; value: string; status: AssetLibraryDetailStatus }>
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

function statusDetail(asset: AssetLibraryItem): { label: string; value: string; status: AssetLibraryDetailStatus } {
  if (asset.status === 'verified') {
    return {
      label: 'Verification gate',
      value: 'Verified for read-only reference because a receipt, source file, or source URL is attached. This is not authorization to publish, post, spend, trade, or write memory.',
      status: 'read_only',
    }
  }
  if (asset.status === 'blocked') {
    return {
      label: 'Verification gate',
      value: 'Blocked from promotion until the blocker is resolved with a receipt and scoped approval where needed.',
      status: 'blocked',
    }
  }
  if (asset.status === 'draft') {
    return {
      label: 'Verification gate',
      value: 'Draft inventory only. The asset can be organized internally, but cannot be claimed as verified until evidence is attached.',
      status: 'planned',
    }
  }
  return {
    label: 'Verification gate',
    value: 'Evidence Missing: no source file, receipt, screenshot, or URL is attached, so this asset must not appear as verified inventory.',
    status: 'evidence_missing',
  }
}

function locationDetail(asset: AssetLibraryItem): { label: string; value: string; status: AssetLibraryDetailStatus } {
  const location = asset.evidence_path || asset.source_url
  return {
    label: 'Source / receipt location',
    value: location || 'Evidence Missing: attach a canonical file path, receipt path, screenshot path, or source URL before promotion.',
    status: location ? 'read_only' : 'evidence_missing',
  }
}

function promotionDetail(asset: AssetLibraryItem): { label: string; value: string; status: AssetLibraryDetailStatus } {
  return {
    label: 'Promotion boundary',
    value: `Next safe action: ${asset.next_action} External marketing sends/posts/spend, trades/account mutations, Graphify/gBrain writes, and customer-facing publication still require explicit approval where applicable.`,
    status: asset.status === 'blocked' ? 'blocked' : 'approval_required',
  }
}

function enrichAsset(asset: AssetLibraryItem): EnrichedAssetLibraryItem {
  return {
    ...asset,
    details: [statusDetail(asset), locationDetail(asset), promotionDetail(asset)],
  }
}

export function getAssetLibrarySnapshot(workspaceId = 1) {
  const assets = listAssetLibraryItems(workspaceId)
  const enrichedAssets = assets.map(enrichAsset)
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
      promotionGatesVisible: enrichedAssets.filter((item) => item.details.some((detail) => detail.label === 'Promotion boundary')).length,
      sourceReceiptsLinked: enrichedAssets.filter((item) => Boolean(item.evidence_path || item.source_url)).length,
      externalPublishEnabled: false,
    },
    assets: enrichedAssets,
  }
}
