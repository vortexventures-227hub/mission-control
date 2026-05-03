import { getDatabase } from './db'

export type BrainstormIdeaStatus = 'researched' | 'evidence_missing' | 'draft' | 'blocked' | 'approved_for_promotion'
export type BrainstormIdeaLane = 'active_mvp' | 'future' | 'hypothesis' | 'parking_lot' | 'promotion_gate'

export interface BrainstormIdea {
  id: number
  workspace_id: number
  idea_key: string
  title: string
  lane: BrainstormIdeaLane
  status: BrainstormIdeaStatus
  owner_project: string
  evidence_path: string | null
  next_action: string
  created_at: number
  updated_at: number
  details: BrainstormIdeaDetail[]
}

export interface BrainstormIdeaDetail {
  label: string
  value: string
  status: 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'planned' | 'blocked'
}

const laneLabels: Record<BrainstormIdeaLane, string> = {
  active_mvp: 'Active MVP candidate',
  future: 'Future / not-now idea',
  hypothesis: 'Hypothesis needing research',
  parking_lot: 'Parking lot / hold',
  promotion_gate: 'Promotion gate',
}

function buildIdeaDetails(idea: Omit<BrainstormIdea, 'details'>): BrainstormIdeaDetail[] {
  const hasEvidence = Boolean(idea.evidence_path)
  const promotionAllowed = idea.status === 'approved_for_promotion'

  return [
    {
      label: 'Research / evidence gate',
      value: hasEvidence
        ? `Evidence attached: ${idea.evidence_path}`
        : 'Evidence Missing: no research receipt, source, screenshot, or approval packet is attached.',
      status: hasEvidence ? 'read_only' : 'evidence_missing',
    },
    {
      label: 'Promotion boundary',
      value: promotionAllowed
        ? 'Approved-for-promotion still requires scoped execution authority before tasks, campaigns, designs, trades, or memory writes.'
        : 'No automatic promotion into tasks, marketing, design, trading, asset inventory, Graphify/gBrain, or David memory.',
      status: promotionAllowed ? 'approval_required' : idea.status === 'blocked' ? 'blocked' : 'approval_required',
    },
    {
      label: 'Lane contract',
      value: `${laneLabels[idea.lane]} for ${idea.owner_project}; next action: ${idea.next_action}`,
      status: idea.status === 'blocked' ? 'blocked' : idea.status === 'evidence_missing' ? 'evidence_missing' : idea.status === 'draft' ? 'planned' : 'read_only',
    },
  ]
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listBrainstormIdeas(workspaceId = 1): BrainstormIdea[] {
  const rows = getDatabase().prepare(`
    SELECT * FROM mission_control_brainstorm_ideas
    WHERE workspace_id = ?
    ORDER BY
      CASE status
        WHEN 'blocked' THEN 0
        WHEN 'evidence_missing' THEN 1
        WHEN 'draft' THEN 2
        WHEN 'researched' THEN 3
        ELSE 4
      END,
      CASE lane
        WHEN 'active_mvp' THEN 0
        WHEN 'hypothesis' THEN 1
        WHEN 'promotion_gate' THEN 2
        WHEN 'future' THEN 3
        ELSE 4
      END,
      title
  `).all(workspaceId) as Array<Omit<BrainstormIdea, 'details'>>

  return rows.map((idea) => ({
    ...idea,
    details: buildIdeaDetails(idea),
  }))
}

export function getBrainstormSnapshot(workspaceId = 1) {
  const ideas = listBrainstormIdeas(workspaceId)
  return {
    generatedAt: Date.now(),
    guardrails: [
      'Brainstorm Wall is read-only in this MVP slice; it does not auto-create tasks, campaigns, trades, customer actions, or memory writes.',
      'Ideas with no evidence_path stay Evidence Missing and must not be presented as active projects or verified assets.',
      'Promotion into project, campaign, design, trade, asset, or memory work requires evidence plus a scoped task/approval receipt.',
    ],
    summary: {
      totalIdeas: ideas.length,
      researchedIdeas: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'researched'`, workspaceId),
      evidenceMissing: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'evidence_missing'`, workspaceId),
      blockedIdeas: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'blocked'`, workspaceId),
      draftIdeas: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'draft'`, workspaceId),
      approvedForPromotion: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'approved_for_promotion'`, workspaceId),
      evidenceReceiptsLinked: ideas.filter((idea) => Boolean(idea.evidence_path)).length,
      promotionGatesVisible: ideas.length,
      autoPromotionEnabled: false,
      externalActionEnabled: false,
      memoryWriteEnabled: false,
      tradingExecutionEnabled: false,
    },
    ideas,
  }
}
