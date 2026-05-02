import { getDatabase } from './db'

export type ResearchBriefStatus =
  | 'planned'
  | 'draft'
  | 'evidence_missing'
  | 'approval_required'
  | 'blocked'
  | 'researched'

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

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
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
  const briefs = listResearchBriefs(workspaceId)
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
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      approvalRequired: countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'approval_required'`, workspaceId),
      researchedBriefs: countBy(`SELECT COUNT(*) as count FROM mission_control_research_briefs WHERE workspace_id = ? AND status = 'researched'`, workspaceId),
      paidSimulationApprovalRequired: true,
      karpathiaConnectorInstrumented: false,
      autoPromotionEnabled: false,
    },
    briefs,
  }
}
