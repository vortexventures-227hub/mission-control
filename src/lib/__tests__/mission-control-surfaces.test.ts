import { describe, expect, it, vi } from 'vitest'

vi.mock('../security-command-center', () => ({
  getSecurityCommandSnapshot: () => ({
    generatedAt: 1700000000000,
    guardrails: ['Mock security guardrail'],
    posture: {
      systems: 0,
      openFindings: 0,
      severityCounts: {},
      label: 'green',
    },
    systems: [],
    findings: [],
  }),
}))

vi.mock('../asset-library-command', () => ({
  getAssetLibrarySnapshot: () => ({
    generatedAt: 1700000005000,
    guardrails: ['Mock asset guardrail'],
    summary: {
      totalAssets: 3,
      evidenceMissing: 1,
      externalPublishEnabled: false,
    },
    assets: [
      { id: 1, asset_key: 'mission-control-local-mvp-proof', title: 'Mission Control local MVP proof', asset_type: 'receipt', status: 'verified', owner_project: 'Mission Control', evidence_path: '/receipts/mvp.md', source_url: null, next_action: 'Use as local proof baseline.' },
      { id: 2, asset_key: 'design-visual-receipts', title: 'Design visual receipts', asset_type: 'screenshot', status: 'evidence_missing', owner_project: 'Mission Control', evidence_path: null, source_url: null, next_action: 'Capture visual receipt.' },
    ],
  }),
}))

vi.mock('../brainstorm-command', () => ({
  getBrainstormSnapshot: () => ({
    generatedAt: 1700000010000,
    guardrails: ['Mock brainstorm guardrail'],
    summary: {
      totalIdeas: 4,
      evidenceMissing: 1,
      approvedForPromotion: 0,
      autoPromotionEnabled: false,
    },
    ideas: [
      { id: 1, idea_key: 'blackwire-room-demo', title: 'Blackwire room demo', lane: 'active_mvp', status: 'researched', owner_project: 'Mission Control', evidence_path: '/receipts/blackwire.md', next_action: 'Keep as visible MVP anchor.' },
      { id: 2, idea_key: 'unverified-marketplace-app', title: 'Marketplace app idea', lane: 'future', status: 'evidence_missing', owner_project: 'App Factory', evidence_path: null, next_action: 'Research before promotion.' },
    ],
  }),
}))

vi.mock('../brain-memory-command', () => ({
  getBrainMemorySnapshot: () => ({
    generatedAt: 1700000015000,
    guardrails: ['Mock brain memory guardrail'],
    summary: {
      totalLayers: 4,
      runtimeBackedLayers: 1,
      evidenceMissing: 1,
      writeEnabled: false,
      correctionRequests: 1,
      davidIsolationEnforced: true,
    },
    layers: [
      { id: 1, layer_key: 'graphify-internal', label: 'Graphify internal project graph', layer_type: 'graphify', status: 'queried_manually', domain: 'Vortex / Blackwire', evidence_path: '/receipts/graphify.md', runtime_adoption: 'manual', next_action: 'Keep writes receipt-gated.' },
      { id: 2, layer_key: 'david-msnj-brain', label: 'David Material Solutions brain', layer_type: 'david_brain', status: 'isolated', domain: 'Material Solutions / David', evidence_path: '/receipts/david.md', runtime_adoption: 'isolated', next_action: 'Never mix with Vortex project memory.' },
      { id: 3, layer_key: 'unverified-memory-tool', label: 'Unverified memory tool', layer_type: 'candidate_tool', status: 'evidence_missing', domain: 'Candidate', evidence_path: null, runtime_adoption: 'not_adopted', next_action: 'Research before adoption.' },
    ],
    correctionRequests: [
      { id: 1, request_key: 'blackwire-false-green-correction', title: 'Blackwire false-green correction', status: 'staged', domain: 'Mission Control', evidence_path: '/receipts/false-green.md', requested_change: 'Keep done evidence-gated.', next_action: 'Review and ingest through approved correction flow.' },
    ],
  }),
}))

vi.mock('../research-command', () => ({
  getResearchCommandSnapshot: () => ({
    generatedAt: 1700000020000,
    guardrails: ['Mock research guardrail'],
    summary: {
      totalBriefs: 4,
      evidenceMissing: 1,
      paidSimulationApprovalRequired: true,
      karpathiaConnectorInstrumented: false,
      autoPromotionEnabled: false,
    },
    briefs: [
      { id: 1, research_key: 'karpathia-source-plan', title: 'Karpathia source plan', lane: 'karpathia', status: 'planned', owner_agent: 'Karpathia', evidence_path: '/receipts/karpathia.md', next_action: 'Attach citations before action.' },
      { id: 2, research_key: 'mirofish-paid-sim', title: 'MiroFish paid simulation brief', lane: 'mirofish', status: 'approval_required', owner_agent: 'MiroFish', evidence_path: '/receipts/mirofish.md', next_action: 'Ask Chris before paid simulation.' },
      { id: 3, research_key: 'unverified-market-signal', title: 'Unverified market signal', lane: 'trading_research', status: 'evidence_missing', owner_agent: 'Atlas', evidence_path: null, next_action: 'Cite sources before promotion.' },
    ],
  }),
}))

vi.mock('../trading-operations-command', () => ({
  getTradingOperationsSnapshot: () => ({
    generatedAt: 1700000025000,
    guardrails: ['Mock trading guardrail'],
    summary: {
      totalWatchItems: 4,
      evidenceMissing: 1,
      executionEnabled: false,
      connectorInstrumented: false,
      walletMutationEnabled: false,
      approvalRequiredForTrades: true,
    },
    watchItems: [
      { id: 1, item_key: 'polymarket-watchlist-shell', title: 'Polymarket watchlist shell', lane: 'watchlist', status: 'planned', owner_agent: 'Herald', market_url: null, evidence_path: '/receipts/watch.md', next_action: 'Add sourced watch items only.' },
      { id: 2, item_key: 'execution-hard-block', title: 'Execution hard block', lane: 'execution_guard', status: 'blocked', owner_agent: 'Ledger', market_url: null, evidence_path: '/receipts/block.md', next_action: 'No trades from Mission Control.' },
      { id: 3, item_key: 'approval-gated-risk-note', title: 'Approval-gated risk note', lane: 'risk', status: 'approval_required', owner_agent: 'Knox', market_url: null, evidence_path: '/receipts/risk.md', next_action: 'Ask Chris before account-affecting action.' },
      { id: 4, item_key: 'uncited-market-signal', title: 'Uncited market signal', lane: 'signals', status: 'evidence_missing', owner_agent: 'Atlas', market_url: null, evidence_path: null, next_action: 'Attach citations.' },
    ],
  }),
}))

vi.mock('../design-studio-command', () => ({
  getDesignStudioSnapshot: () => ({
    generatedAt: 1700000030000,
    guardrails: ['Mock design guardrail'],
    summary: {
      totalDesignItems: 4,
      evidenceMissing: 1,
      visualReceiptsLinked: 1,
      externalPublishEnabled: false,
      visualQaProven: true,
      patchRuntimeAuthority: false,
    },
    items: [
      { id: 1, item_key: 'mission-control-brand-system', title: 'Mission Control brand system', lane: 'brand', status: 'planned', owner_agent: 'Patch / Claw Design', evidence_path: '/receipts/design.md', screenshot_path: null, next_action: 'Attach token audit.' },
      { id: 2, item_key: 'blackwire-room-visual-receipt', title: 'Blackwire room visual receipt', lane: 'visual_receipts', status: 'receipt_backed', owner_agent: 'Herm', evidence_path: '/receipts/blackwire-visual.md', screenshot_path: '/screenshots/blackwire.png', next_action: 'Use as QA baseline.' },
      { id: 3, item_key: 'unproven-design-claim', title: 'Unproven design claim', lane: 'ui_qa', status: 'evidence_missing', owner_agent: 'Neon Forge', evidence_path: null, screenshot_path: null, next_action: 'Capture browser proof.' },
      { id: 4, item_key: 'external-publish-guard', title: 'External publish guard', lane: 'publish_guard', status: 'blocked', owner_agent: 'Knox', evidence_path: '/receipts/no-publish.md', screenshot_path: null, next_action: 'Do not publish externally.' },
    ],
  }),
}))

import { getMissionControlSurfaceIndex, getMissionControlSurfaceSnapshot } from '../mission-control-surfaces'

describe('mission control surface snapshots', () => {
  it('exposes all requested MVP command surfaces through the surface index', () => {
    const ids = getMissionControlSurfaceIndex().map((surface) => surface.id)

    expect(ids).toEqual(expect.arrayContaining([
      'mission-control',
      'research-command',
      'trading',
      'design',
      'brain-memory',
      'asset-library',
      'brainstorm',
      'marketing',
      'security-command',
    ]))
  })

  it('exposes Marketing as a surface snapshot with external action and analytics guardrails', () => {
    const marketing = getMissionControlSurfaceSnapshot('marketing')

    expect(marketing?.status).toBe('approval_required')
    expect(marketing?.summary.externalActionsApprovalGated).toBe(true)
    expect(marketing?.summary.publicLaunchBlocked).toBe(true)
    expect(marketing?.guardrails.join(' ')).toContain('No auto-send')
    expect(marketing?.guardrails.join(' ')).toContain('Security Command Center posture')
    expect(marketing?.sections.flatMap((section) => section.cards).find((card) => card.id === 'security-launch-gate')?.status).toBe('not_instrumented')
    expect(marketing?.sections.flatMap((section) => section.cards).find((card) => card.id === 'analytics-sources')?.status).toBe('not_instrumented')
  })

  it('keeps paid simulations and trading execution approval-gated or blocked instead of fake green', () => {
    const missionControl = getMissionControlSurfaceSnapshot('mission-control')
    const research = getMissionControlSurfaceSnapshot('research-command')
    const trading = getMissionControlSurfaceSnapshot('trading')

    expect(missionControl?.guardrails.join(' ')).toContain('No real trades')
    expect(missionControl?.sections.flatMap((section) => section.cards).some((card) => card.id === 'research-command')).toBe(true)
    expect(research?.sections.flatMap((section) => section.cards).find((card) => card.id === 'mirofish')?.status).toBe('approval_required')
    expect(trading?.sections.flatMap((section) => section.cards).find((card) => card.id === 'execution-guard')?.status).toBe('blocked')
  })

  it('merges DB-backed Asset Library rows into the shared surface without hiding evidence gaps', () => {
    const assetLibrary = getMissionControlSurfaceSnapshot('asset-library')
    const cards = assetLibrary?.sections.flatMap((section) => section.cards) || []

    expect(assetLibrary?.summary.totalAssets).toBe(3)
    expect(assetLibrary?.summary.evidenceMissing).toBe(1)
    expect(assetLibrary?.summary.externalPublishEnabled).toBe(false)
    expect(assetLibrary?.guardrails.join(' ')).toContain('Mock asset guardrail')
    expect(cards.find((card) => card.id === 'asset-mission-control-local-mvp-proof')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'asset-design-visual-receipts')?.status).toBe('evidence_missing')
  })

  it('merges DB-backed Brainstorm Wall ideas into the shared surface with promotion gates visible', () => {
    const brainstorm = getMissionControlSurfaceSnapshot('brainstorm')
    const cards = brainstorm?.sections.flatMap((section) => section.cards) || []

    expect(brainstorm?.summary.totalIdeas).toBe(4)
    expect(brainstorm?.summary.evidenceMissing).toBe(1)
    expect(brainstorm?.summary.approvedForPromotion).toBe(0)
    expect(brainstorm?.summary.autoPromotionEnabled).toBe(false)
    expect(brainstorm?.guardrails.join(' ')).toContain('Mock brainstorm guardrail')
    expect(cards.find((card) => card.id === 'idea-blackwire-room-demo')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'idea-unverified-marketplace-app')?.status).toBe('evidence_missing')
  })

  it('merges DB-backed Brain / Memory layers into the shared surface with isolation and write gates visible', () => {
    const brainMemory = getMissionControlSurfaceSnapshot('brain-memory')
    const cards = brainMemory?.sections.flatMap((section) => section.cards) || []

    expect(brainMemory?.summary.totalLayers).toBe(4)
    expect(brainMemory?.summary.writeEnabled).toBe(false)
    expect(brainMemory?.summary.davidIsolationEnforced).toBe(true)
    expect(brainMemory?.guardrails.join(' ')).toContain('Mock brain memory guardrail')
    expect(cards.find((card) => card.id === 'memory-layer-graphify-internal')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'memory-layer-david-msnj-brain')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'memory-layer-unverified-memory-tool')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'memory-correction-blackwire-false-green-correction')?.status).toBe('approval_required')
  })

  it('merges DB-backed Research Command briefs while keeping Karpathia/MiroFish no-fake-green gates visible', () => {
    const research = getMissionControlSurfaceSnapshot('research-command')
    const cards = research?.sections.flatMap((section) => section.cards) || []

    expect(research?.summary.totalBriefs).toBe(4)
    expect(research?.summary.paidSimulationApprovalRequired).toBe(true)
    expect(research?.summary.karpathiaConnectorInstrumented).toBe(false)
    expect(research?.summary.autoPromotionEnabled).toBe(false)
    expect(research?.guardrails.join(' ')).toContain('Mock research guardrail')
    expect(cards.find((card) => card.id === 'research-karpathia-source-plan')?.status).toBe('planned')
    expect(cards.find((card) => card.id === 'research-mirofish-paid-sim')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'research-unverified-market-signal')?.status).toBe('evidence_missing')
  })

  it('merges DB-backed Trading Operations watch items while keeping execution and wallet mutation blocked', () => {
    const trading = getMissionControlSurfaceSnapshot('trading')
    const cards = trading?.sections.flatMap((section) => section.cards) || []

    expect(trading?.summary.totalWatchItems).toBe(4)
    expect(trading?.summary.executionEnabled).toBe(false)
    expect(trading?.summary.connectorInstrumented).toBe(false)
    expect(trading?.summary.walletMutationEnabled).toBe(false)
    expect(trading?.summary.approvalRequiredForTrades).toBe(true)
    expect(trading?.guardrails.join(' ')).toContain('Mock trading guardrail')
    expect(cards.find((card) => card.id === 'trading-polymarket-watchlist-shell')?.status).toBe('planned')
    expect(cards.find((card) => card.id === 'trading-execution-hard-block')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'trading-approval-gated-risk-note')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'trading-uncited-market-signal')?.status).toBe('evidence_missing')
  })

  it('merges DB-backed Design Studio items while keeping visual QA and external publish gates honest', () => {
    const design = getMissionControlSurfaceSnapshot('design')
    const cards = design?.sections.flatMap((section) => section.cards) || []

    expect(design?.summary.totalDesignItems).toBe(4)
    expect(design?.summary.evidenceMissing).toBe(1)
    expect(design?.summary.visualReceiptsLinked).toBe(1)
    expect(design?.summary.externalPublishEnabled).toBe(false)
    expect(design?.summary.patchRuntimeAuthority).toBe(false)
    expect(design?.guardrails.join(' ')).toContain('Mock design guardrail')
    expect(cards.find((card) => card.id === 'design-mission-control-brand-system')?.status).toBe('planned')
    expect(cards.find((card) => card.id === 'design-blackwire-room-visual-receipt')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'design-unproven-design-claim')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'design-external-publish-guard')?.status).toBe('blocked')
  })
})
