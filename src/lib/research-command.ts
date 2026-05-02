import { getDatabase } from './db'

export type ResearchBriefStatus =
  | 'planned'
  | 'draft'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'researched'

export interface ResearchBriefDetail {
  label: string
  value: string
  status: 'read_only' | 'planned' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'blocked'
}

export interface ResearchBrief {
  id: number
  workspace_id: number
  research_key: string
  title: string
  lane: string
  status: ResearchBriefStatus
  owner_agent: string
  evidence_path: string | null
  next_action: string
  created_at: number
  updated_at: number
}

export interface EnrichedResearchBrief extends ResearchBrief {
  citationPlan: string
  readinessGate: string
  promotionGate: string
  details: ResearchBriefDetail[]
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

const laneProfiles: Record<string, Pick<EnrichedResearchBrief, 'citationPlan' | 'readinessGate' | 'promotionGate'>> = {
  karpathia: {
    citationPlan: 'Source connector, citation receipt, and confidence coverage must be attached before Karpathia can be treated as live auto-research.',
    readinessGate: 'Not Instrumented Yet: no autonomous external source connector is active.',
    promotionGate: 'Draft only; promote to tasks/campaigns/design/trading only after citation receipts are reviewed.',
  },
  mirofish: {
    citationPlan: 'Scenario assumptions, input sources, cost class, and result receipt must be attached before a simulation brief can be used.',
    readinessGate: 'Approval Required: paid simulation runs, external compute spend, and simulation-account mutation are blocked.',
    promotionGate: 'Prepare ready-to-review briefs only; Chris approval is required before paid execution.',
  },
  trading_research: {
    citationPlan: 'Market signal must include source URLs, resolution criteria, timestamp, and risk notes before any watchlist promotion.',
    readinessGate: 'Evidence Missing: no verified source/citation/ledger receipt is attached.',
    promotionGate: 'No trades, positions, fills, P&L, wallet mutation, or market API-key use from this surface.',
  },
  memory_harmony: {
    citationPlan: 'Research-to-memory corrections require source evidence, requested change, and approved ingestion/correction receipt.',
    readinessGate: 'Blocked: Graphify/gBrain writes are forbidden without approved ingestion/correction receipts.',
    promotionGate: 'Stage as correction request only; David memory remains Material Solutions-only isolated.',
  },
  design_research: {
    citationPlan: 'Design claims require screenshot receipts, visual QA notes, and decision rationale before approval.',
    readinessGate: 'Evidence Missing until visual receipts are linked.',
    promotionGate: 'Promote only into Design Studio receipt-backed QA, not external publishing.',
  },
  citation_vault: {
    citationPlan: 'Citation vault entries must include source, excerpt, confidence, owner, and receipt path.',
    readinessGate: 'Evidence Missing until source receipts are linked.',
    promotionGate: 'Can support decisions only after evidence review.',
  },
  research_queue: {
    citationPlan: 'Brief must identify sources, confidence, assumptions, and explicit evidence gaps.',
    readinessGate: 'Read-only queue item; completion requires receipt-backed evidence.',
    promotionGate: 'Promotion to actions requires evidence plus scoped approval for any external/paid/account-affecting step.',
  },
}

function detailStatusForBrief(brief: ResearchBrief): ResearchBriefDetail['status'] {
  if (brief.status === 'researched') return 'read_only'
  if (brief.status === 'draft') return 'planned'
  return brief.status
}

function enrichBrief(brief: ResearchBrief): EnrichedResearchBrief {
  const profile = laneProfiles[brief.lane] || laneProfiles.research_queue
  const citationStatus = brief.evidence_path ? detailStatusForBrief(brief) : 'evidence_missing'
  return {
    ...brief,
    ...profile,
    details: [
      { label: 'Citation plan', value: profile.citationPlan, status: citationStatus },
      { label: 'Readiness gate', value: profile.readinessGate, status: brief.lane === 'karpathia' ? 'not_instrumented' : detailStatusForBrief(brief) },
      { label: 'Promotion gate', value: profile.promotionGate, status: brief.status === 'approval_required' ? 'approval_required' : brief.status === 'blocked' ? 'blocked' : 'planned' },
    ],
  }
}

export function listResearchBriefs(workspaceId = 1): ResearchBrief[] {
  return getDatabase().prepare(`
    SELECT * FROM mission_control_research_briefs
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'approval_required' THEN 0
        WHEN 'blocked' THEN 1
        WHEN 'evidence_missing' THEN 2
        WHEN 'planned' THEN 3
        WHEN 'draft' THEN 4
        WHEN 'researched' THEN 5
        ELSE 6
      END,
      lane,
      title
  `).all(workspaceId) as ResearchBrief[]
}

export function getResearchCommandSnapshot(workspaceId = 1) {
  const briefs = listResearchBriefs(workspaceId).map(enrichBrief)
  const approvalRequired = countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'approval_required'`, workspaceId)
  const evidenceMissing = countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Research Command is read-only in this MVP slice; it stages briefs, citations, and findings but does not run autonomous external research.',
      'Karpathia Auto-Research stays Not Instrumented Yet until source connectors and citation receipts are proven.',
      'MiroFish paid simulations require explicit Chris approval before paid run, external compute spend, or simulation-account mutation.',
      'Research cannot promote tasks, marketing sends/posts/spend, trades, or Graphify/gBrain writes without evidence plus scoped approval.',
    ],
    summary: {
      totalBriefs: briefs.length,
      evidenceMissing,
      approvalRequired,
      researchedBriefs: countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'researched'`, workspaceId),
      citationReceiptsAttached: briefs.filter((brief) => Boolean(brief.evidence_path)).length,
      promotionGatesVisible: briefs.length > 0 && briefs.every((brief) => brief.details.some((detail) => detail.label === 'Promotion gate')),
      notInstrumentedLanes: briefs.some((brief) => brief.lane === 'karpathia') ? 1 : 0,
      approvalBlockedBriefs: approvalRequired + countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      paidSimulationApprovalRequired: true,
      karpathiaConnectorInstrumented: false,
      autoPromotionEnabled: false,
    },
    briefs,
  }
}
