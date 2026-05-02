import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => ({
      get: () => {
        if (sql.includes('projects')) return { count: 2 }
        if (sql.includes('tasks')) return { count: 8 }
        if (sql.includes('group_chat_assignment_tracker_items')) return { count: 1 }
        if (sql.includes('exec_approval_requests')) return { count: 0 }
        if (sql.includes('artifacts')) return { count: 0 }
        if (sql.includes('agent_artifacts')) return { count: 0 }
        if (sql.includes('memory_items')) return { count: 0 }
        if (sql.includes('memories')) return { count: 0 }
        return { count: 0 }
      },
    }),
  }),
}))

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: () => true,
  statSync: () => ({ mtimeMs: 1700000000000 }),
}))

vi.mock('../group-chat', () => ({
  getGroupChatRoomBySlug: (slug: string) => slug === 'blackwire-ops'
    ? { id: 10, slug: 'blackwire-ops', name: 'Blackwire Ops', kind: 'project' }
    : { id: 11, slug: 'command', name: 'Command', kind: 'command' },
  listGroupChatAgentProfiles: () => [{ id: 1, status: 'online_proven' }, { id: 2, status: 'offline' }],
  listGroupChatAssignments: () => [{ id: 1, status: 'done', evidence: '/receipt.md' }],
  listGroupChatDecisionReceipts: () => [{ id: 1 }],
  listGroupChatMessages: (slug: string) => slug === 'blackwire-ops'
    ? [{ id: 1, delivery: [{ state: 'sent' }, { state: 'delivered' }, { state: 'seen' }] }]
    : [{ id: 2, delivery: [] }],
  listGroupChatQueuedAlerts: () => [{ id: 1 }],
  listGroupChatRooms: () => [{ id: 10, slug: 'blackwire-ops', name: 'Blackwire Ops', kind: 'project' }],
}))

vi.mock('../security-command-center', () => ({
  getSecurityCommandSnapshot: () => ({
    posture: { systems: 2, openFindings: 1 },
  }),
}))

vi.mock('../asset-library-command', () => ({
  getAssetLibrarySnapshot: () => ({ summary: { totalAssets: 5, evidenceMissing: 1, externalPublishEnabled: false } }),
}))
vi.mock('../brainstorm-command', () => ({
  getBrainstormSnapshot: () => ({ summary: { totalIdeas: 5, evidenceMissing: 1, approvedForPromotion: 0, autoPromotionEnabled: false } }),
}))
vi.mock('../brain-memory-command', () => ({
  getBrainMemorySnapshot: () => ({ summary: { totalLayers: 5, evidenceMissing: 1, writeEnabled: false, davidIsolationEnforced: true, correctionRequests: 1 } }),
}))
vi.mock('../research-command', () => ({
  getResearchCommandSnapshot: () => ({ summary: { totalBriefs: 4, evidenceMissing: 1, paidSimulationApprovalRequired: true, karpathiaConnectorInstrumented: false, autoPromotionEnabled: false } }),
}))
vi.mock('../trading-operations-command', () => ({
  getTradingOperationsSnapshot: () => ({ summary: { totalWatchItems: 4, evidenceMissing: 1, executionEnabled: false, connectorInstrumented: false, walletMutationEnabled: false, approvalRequiredForTrades: true } }),
}))
vi.mock('../design-studio-command', () => ({
  getDesignStudioSnapshot: () => ({ summary: { totalDesignItems: 4, evidenceMissing: 1, visualReceiptsLinked: 1, externalPublishEnabled: false, patchRuntimeAuthority: false } }),
}))

import { getMissionControlMvpSnapshot } from '../mission-control-mvp'

describe('Mission Control MVP snapshot', () => {
  it('surfaces the DB-backed MVP command surfaces in Command Truth without fake green execution', () => {
    const snapshot = getMissionControlMvpSnapshot(1)
    const byId = Object.fromEntries(snapshot.surfaces.map((surface) => [surface.id, surface]))

    expect(snapshot.metrics.dbBackedCommandSurfaces).toBe(6)
    expect(byId['brain-memory'].status).toBe('partial')
    expect(byId['brain-memory'].detail).toContain('5 memory layers')
    expect(byId['asset-library'].status).toBe('partial')
    expect(byId['asset-library'].detail).toContain('5 asset records')
    expect(byId['brainstorm-wall'].status).toBe('partial')
    expect(byId['brainstorm-wall'].detail).toContain('5 ideas')
    expect(byId['research-command'].status).toBe('partial')
    expect(byId['research-command'].detail).toContain('Karpathia connector Not Instrumented Yet')
    expect(byId['trading-operations'].status).toBe('partial')
    expect(byId['trading-operations'].detail).toContain('execution blocked')
    expect(byId['design-studio'].status).toBe('partial')
    expect(byId['design-studio'].detail).toContain('4 design inventory rows')
  })
})
