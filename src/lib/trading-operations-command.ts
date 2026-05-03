import { getDatabase } from './db'

export type TradingWatchItemStatus =
  | 'planned'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'watching'
  | 'researched'

export type TradingDetailStatus = 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'planned' | 'blocked'

export interface TradingWatchItemDetail {
  label: string
  value: string
  status: TradingDetailStatus
}

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
  details: TradingWatchItemDetail[]
}

const laneDetailTemplates: Record<string, TradingWatchItemDetail[]> = {
  watchlist: [
    { label: 'Market data gate', value: 'Not Instrumented Yet: no Polymarket or approved-market connector, live quote, liquidity, spread, or expiry feed is attached.', status: 'not_instrumented' },
    { label: 'Source / timestamp requirement', value: 'Watchlist entries need market URL or ID, source timestamp, venue, category, liquidity, spread, and evidence before they can be treated as current.', status: 'evidence_missing' },
    { label: 'Execution boundary', value: 'Read-only watch surface only; no orders, API-key use, account access, or wallet mutation.', status: 'blocked' },
  ],
  signals: [
    { label: 'Signal evidence gate', value: 'Evidence Missing: thesis, probability estimate, market price, edge, confidence, and source citations must be timestamped before a signal becomes actionable.', status: 'evidence_missing' },
    { label: 'Research / simulation link', value: 'Attach Research Command citations and optional MiroFish brief receipts before promotion; paid simulations require approval.', status: 'approval_required' },
    { label: 'Actionability boundary', value: 'No signal can trigger a trade or public market action from Mission Control.', status: 'blocked' },
  ],
  risk: [
    { label: 'Sizing input gate', value: 'Approval Required: bankroll, max exposure, correlation/group exposure, downside case, and stop condition need scoped review before account-affecting action.', status: 'approval_required' },
    { label: 'Balance / position truth', value: 'Evidence Missing: no account balance, open position, fill, or P&L data is imported.', status: 'evidence_missing' },
    { label: 'Paper-only boundary', value: 'Internal paper/backtest notes may be staged, but real money, paid data, or account mutation stays blocked without Chris approval.', status: 'blocked' },
  ],
  spread: [
    { label: 'Spread data gate', value: 'Not Instrumented Yet: no cross-venue quote, order book, stale-pricing, fee, liquidity, or fill-risk connector is attached.', status: 'not_instrumented' },
    { label: 'Settlement / correlation caveat', value: 'Spread or arb notes require settlement rules, correlation caveats, fee assumptions, and source timestamps before review.', status: 'evidence_missing' },
    { label: 'Execution boundary', value: 'Spread observations are research only; Mission Control cannot place hedges, arb legs, or external orders.', status: 'blocked' },
  ],
  ledger: [
    { label: 'Ledger receipt gate', value: 'Evidence Missing: trade journal, open positions, closed P/L, thesis accuracy, hit rate, and drawdown require verified receipts before display.', status: 'evidence_missing' },
    { label: 'No fake performance', value: 'Do not invent balances, fills, P&L, hit rate, or lessons; empty ledger means Evidence Missing.', status: 'blocked' },
    { label: 'Import boundary', value: 'Only read-only, redacted, approved ledger receipts may be imported into this cockpit.', status: 'approval_required' },
  ],
  execution_guard: [
    { label: 'Execution hard block', value: 'Blocked: no order placement, cancellation, wallet movement, account mutation, deposits/withdrawals, market API-key use, or automated execution route exists.', status: 'blocked' },
    { label: 'Approval object requirement', value: 'Any real trade or account-affecting action needs explicit Chris approval with venue, order, size, spread/slippage guard, stop/rollback plan, and execution receipt path.', status: 'approval_required' },
    { label: 'Receipt requirement', value: 'Execution status cannot become Done without an external approved execution receipt; this MVP does not create that receipt.', status: 'evidence_missing' },
  ],
}

function withDetails(item: Omit<TradingWatchItem, 'details'>): TradingWatchItem {
  return {
    ...item,
    details: laneDetailTemplates[item.lane] || [
      { label: 'Trading truth gate', value: 'Evidence Missing until source, approval, and receipt requirements are linked.', status: 'evidence_missing' },
    ],
  }
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
  `).all(workspaceId).map((item) => withDetails(item as Omit<TradingWatchItem, 'details'>))
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
      detailGatesVisible: watchItems.reduce((total, item) => total + item.details.length, 0),
      sourceReceiptsLinked: watchItems.filter((item) => Boolean(item.evidence_path || item.market_url)).length,
      ledgerReceiptsLinked: watchItems.filter((item) => item.lane === 'ledger' && Boolean(item.evidence_path)).length,
      livePositionsImported: false,
      fillsImported: false,
      pnlImported: false,
      executionEnabled: false,
      connectorInstrumented: false,
      walletMutationEnabled: false,
      approvalRequiredForTrades: true,
    },
    watchItems,
  }
}
