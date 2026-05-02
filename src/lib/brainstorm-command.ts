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
}

function countBy(sql: string, ...params: unknown[]): number {
  const row = getDatabase().prepare(sql).get(...params) as { count?: number } | undefined
  return Number(row?.count || 0)
}

export function listBrainstormIdeas(workspaceId = 1): BrainstormIdea[] {
  return getDatabase().prepare(`
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
  `).all(workspaceId) as BrainstormIdea[]
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
      approvedForPromotion: countBy(`SELECT COUNT(*) as count FROM mission_control_brainstorm_ideas WHERE workspace_id = ? AND status = 'approved_for_promotion'`, workspaceId),
      autoPromotionEnabled: false,
    },
    ideas,
  }
}
