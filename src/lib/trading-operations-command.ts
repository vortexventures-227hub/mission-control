import { getDatabase } from './db'

export type TradingWatchItemStatus =
  | 'planned'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'watching'
  | 'researched'

export interface TradingWatchItem {
  id: number
  workspace_id: number
  item_key: string
  title: string
  lane: string
  status: TradingWatchItemStatus
  owner_agent: string
  market_url: string | null
  evidence_path: string | null
  next_action: string
  created_at: number
  updated_at: number
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listTradingWatchItems(workspaceId = 1): TradingWatchItem[] {
  return getDatabase().prepare(`
    SELECT * FROM mission_control_trading_watch_items
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'approval_required' THEN 1
        WHEN 'evidence_missing' THEN 2
        WHEN 'planned' THEN 3
        WHEN 'watching' THEN 4
        WHEN 'researched' THEN 5
        ELSE 6
      END,
      lane,
      title
  `).all(workspaceId) as TradingWatchItem[]
}

export function getTradingOperationsSnapshot(workspaceId = 1) {
  const watchItems = listTradingWatchItems(workspaceId)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Trading Operations is read-only in this MVP slice; it stages watchlist, signal, risk, spread, and ledger cards only.',
      'No real trades, order placement, order cancellation, wallet movement, account mutation, market API-key use, or automated execution is implemented or allowed here.',
      'Positions, fills, P&L, bankroll, and market signals remain Evidence Missing unless imported from verified receipts and approved sources.',
      'Any account-affecting, financial, trading, paid-data, or external-market action requires explicit Chris approval with scope and rollback/stop plan.',
    ],
    summary: {
      totalWatchItems: watchItems.length,
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_trading_watch_items WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      approvalRequired: countBy(`SELECT COUNT(*) as count FROM mission_control_trading_watch_items WHERE workspace_id = ? AND status = 'approval_required'`, workspaceId),
      blockedItems: countBy(`SELECT COUNT(*) as count FROM mission_control_trading_watch_items WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      executionEnabled: false,
      connectorInstrumented: false,
      walletMutationEnabled: false,
      approvalRequiredForTrades: true,
    },
    watchItems,
  }
}
