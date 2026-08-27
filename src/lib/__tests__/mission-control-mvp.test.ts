import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => ({
      get: () => {
        if (sql.includes('projects')) return { count: 2 }
        if (sql.includes('tasks')) return { count: 8 }
        if (sql.includes('FROM agents')) return { count: 2 }
        if (sql.includes("status = 'done' AND evidence IS NOT NULL")) return { count: 1 }
        if (sql.includes("status = 'done' AND (evidence IS NULL")) return { count: 0 }
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
  listGroupChatAgentProfiles: () => [
    { id: 1, status: 'online_proven' },
    { id: 2, status: 'offline' },
    { id: 3, status: 'offline' },
    { id: 4, status: 'offline' },
    { id: 5, status: 'offline' },
  ],
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

import { getCommandTruthRouteContract } from '../command-truth-route-contract'
import { getMissionControlMvpSnapshot } from '../mission-control-mvp'

describe('Mission Control MVP snapshot', () => {
  it('uses the visible registered-agent count and identifies hosted runtime truth', () => {
    const previousApp = process.env.FLY_APP_NAME
    process.env.FLY_APP_NAME = 'vv-mission-control'
    try {
      const snapshot = getMissionControlMvpSnapshot(1)
      expect(snapshot.metrics.agents).toBe(2)
      expect(snapshot.canonical.runtime).toBe('hosted')
      expect(snapshot.canonical.activePath).toBe('fly://vv-mission-control')
      expect(snapshot.canonical.sourceOfTruth).toContain('production SQLite volume')
      expect(snapshot.surfaces.find((surface) => surface.id === 'agent-registry')?.detail).toContain('2 visible registered agents')
    } finally {
      if (previousApp === undefined) delete process.env.FLY_APP_NAME
      else process.env.FLY_APP_NAME = previousApp
    }
  })

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
    expect(byId['local-app-packaging'].status).toBe('partial')
    expect(byId['local-app-packaging'].detail).toContain('static-asset-only')
    expect(byId['design-studio'].status).toBe('partial')
    expect(byId['design-studio'].detail).toContain('4 design inventory rows')
  })

  it('exposes Blackwire group-chat and evidence-gated Done gates without treating receipts as completion', () => {
    const snapshot = getMissionControlMvpSnapshot(1)
    const gates = Object.fromEntries(snapshot.blackwireDoneGates.map((gate) => [gate.id, gate]))

    expect(snapshot.metrics.doneWithEvidence).toBe(1)
    expect(snapshot.metrics.doneWithoutEvidence).toBe(0)
    expect(gates['room-source-of-truth'].status).toBe('read_only')
    expect(gates['assignment-board-evidence'].status).toBe('read_only')
    expect(gates['assignment-board-evidence'].requiredEvidence).toContain('Done without evidence is blocked')
    expect(gates['approval-receipt-gate'].requiredEvidence).toContain('scoped decision receipt')
    expect(gates['recipient-delivery-proof'].detail).toContain('sent / delivered / seen')
  })



  it('locks the Blackwire runbook route contract without fake-green completion claims', () => {
    const contract = getCommandTruthRouteContract(1)
    const byPath = Object.fromEntries(contract.routes.map((route) => [route.path, route]))

    expect(Object.keys(byPath)).toEqual(expect.arrayContaining([
      '/command-truth?tab=routes',
      '/rooms/blackwire-ops',
      '/tracker?agent=neon-forge',
      '/api/command-truth/routes',
    ]))
    expect(contract.localMvpBoundary).toContain('Commercial-demo candidate only')
    expect(contract.localMvpBoundary).toContain('approval/instrumentation-gated')
    expect(['alias', 'evidence_missing']).toContain(byPath['/rooms/blackwire-ops'].status)
    expect(['alias', 'evidence_missing']).toContain(byPath['/tracker?agent=neon-forge'].status)
    expect(byPath['/command-truth?tab=routes'].noFakeGreenBoundary).toContain('Evidence Missing')
    expect(byPath['/command-truth?tab=routes'].noFakeGreenBoundary).toContain('Not Instrumented Yet')
    expect(byPath['/command-truth?tab=routes'].noFakeGreenBoundary).toContain('Approval Required')
    expect(byPath['/tracker?agent=neon-forge'].noFakeGreenBoundary).toContain('Done remains blocked')
  })

  it('keeps the Blackwire receipt composer Chris-explicit and linked to route evidence', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/group-chat-panel.tsx'), 'utf8')

    expect(source).toContain("approvalTier: 'chris_explicit'")
    expect(source).toContain('Chris-explicit linked receipt')
    expect(source).toContain('/command-truth?tab=routes')
    expect(source).toContain('/api/command-truth/routes')
  })

  it('exposes explicit no-fake-green truth gates for approval and missing integrations', () => {
    const snapshot = getMissionControlMvpSnapshot(1)
    const gates = Object.fromEntries(snapshot.truthGates.map((gate) => [gate.id, gate]))

    expect(gates['external-marketing-actions'].status).toBe('approval_required')
    expect(gates['karpathia-auto-research'].status).toBe('not_instrumented')
    expect(gates['mirofish-paid-simulations'].status).toBe('approval_required')
    expect(gates['trading-execution'].status).toBe('blocked')
    expect(gates['graphify-gbrain-writes'].detail).toContain('approved ingestion/correction receipts')
    expect(gates['david-memory-isolation'].detail).toContain('Material Solutions-only')
  })
})
