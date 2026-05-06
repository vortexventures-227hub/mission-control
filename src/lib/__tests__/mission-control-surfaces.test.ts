import { describe, expect, it, vi } from 'vitest'

vi.mock('../security-command-center', () => ({
  getSecurityCommandSnapshot: () => ({
    generatedAt: 1700000000000,
    guardrails: ['Mock security guardrail'],
    posture: {
      systems: 0,
      openFindings: 1,
      severityCounts: {},
      statusCounts: {},
      hookCounts: { not_instrumented: 2, evidence_missing: 1 },
      auditHooks: 3,
      notInstrumentedHooks: 2,
      evidenceMissingHooks: 1,
      approvalRequiredHooks: 0,
      label: 'green',
    },
    auditHooks: [
      { id: 'secret-scan', title: 'Secret scan hook', status: 'evidence_missing', cadence: 'daily', trigger: 'daily audit', evidence: 'Evidence Missing: no scan receipt.', nextAction: 'Attach redacted scan receipt.', details: [{ label: 'Secret boundary', value: 'Never print raw secrets.', status: 'blocked' }] },
      { id: 'auth-approval-boundary', title: 'Auth and approval bypass hook', status: 'not_instrumented', cadence: 'daily', trigger: 'protected API', evidence: 'Not Instrumented Yet.', nextAction: 'Probe protected APIs.', details: [{ label: 'Tier 2 boundary', value: 'Deploy/env/customer mutations need approval.', status: 'approval_required' }] },
    ],
    systems: [
      { id: 1, workspace_id: 1, system_key: 'mission-control', label: 'Mission Control Runtime', posture: 'watch', owner_agent_id: 'Knox', last_audit_at: 1700000000, last_dependency_scan_at: null, last_secret_scan_at: null, last_auth_review_at: 1700000000, last_path_drift_check_at: 1700000000, evidence_path: '/receipts/security.md', next_action: 'Attach missing scan receipts.', open_findings: 1, critical_findings: 0, high_findings: 0, details: [{ label: 'Secret/dependency scan gate', value: 'Evidence Missing: scan receipts incomplete.', status: 'evidence_missing' }] },
    ],
    findings: [
      { id: 1, workspace_id: 1, system_key: 'mission-control', title: 'Security hooks not fully instrumented', severity: 'medium', status: 'needs_verification', owner_agent_id: 'Knox', evidence_path: null, next_action: 'Keep Not Instrumented Yet until receipts attach.', created_at: 1700000000, updated_at: 1700000000, details: [{ label: 'False-green boundary', value: 'Not green without receipt-backed evidence.', status: 'evidence_missing' }] },
    ],
  }),
}))

vi.mock('../asset-library-command', () => ({
  getAssetLibrarySnapshot: () => ({
    generatedAt: 1700000005000,
    guardrails: ['Mock asset guardrail'],
    summary: {
      totalAssets: 3,
      verifiedAssets: 1,
      evidenceMissing: 1,
      blockedAssets: 0,
      promotionGatesVisible: 2,
      sourceReceiptsLinked: 1,
      externalPublishEnabled: false,
    },
    assets: [
      { id: 1, asset_key: 'mission-control-local-mvp-proof', title: 'Mission Control local MVP proof', asset_type: 'receipt', status: 'verified', owner_project: 'Mission Control', evidence_path: '/receipts/mvp.md', source_url: null, next_action: 'Use as local proof baseline.', details: [{ label: 'Verification gate', value: 'Verified read-only receipt.', status: 'read_only' }, { label: 'Promotion boundary', value: 'No external action without approval.', status: 'approval_required' }] },
      { id: 2, asset_key: 'design-visual-receipts', title: 'Design visual receipts', asset_type: 'screenshot', status: 'evidence_missing', owner_project: 'Mission Control', evidence_path: null, source_url: null, next_action: 'Capture visual receipt.', details: [{ label: 'Verification gate', value: 'Evidence Missing: no screenshot attached.', status: 'evidence_missing' }, { label: 'Promotion boundary', value: 'No external action without approval.', status: 'approval_required' }] },
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
      { id: 1, idea_key: 'blackwire-room-demo', title: 'Blackwire room demo', lane: 'active_mvp', status: 'researched', owner_project: 'Mission Control', evidence_path: '/receipts/blackwire.md', next_action: 'Keep as visible MVP anchor.', details: [{ label: 'Research / evidence gate', value: 'Evidence attached: /receipts/blackwire.md', status: 'read_only' }, { label: 'Promotion boundary', value: 'No automatic external action; scoped approval required.', status: 'approval_required' }] },
      { id: 2, idea_key: 'unverified-marketplace-app', title: 'Marketplace app idea', lane: 'future', status: 'evidence_missing', owner_project: 'App Factory', evidence_path: null, next_action: 'Research before promotion.', details: [{ label: 'Research / evidence gate', value: 'Evidence Missing: no research receipt attached.', status: 'evidence_missing' }, { label: 'Promotion boundary', value: 'No automatic promotion into tasks, campaigns, trades, or memory.', status: 'approval_required' }] },
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
      stagedCorrections: 1,
      approvedCorrections: 0,
      appliedCorrections: 0,
      blockedCorrections: 0,
      isolatedLayers: 1,
      writeGatesVisible: 4,
      davidIsolationEnforced: true,
    },
    layers: [
      { id: 1, layer_key: 'graphify-internal', label: 'Graphify internal project graph', layer_type: 'graphify', status: 'queried_manually', domain: 'Vortex / Blackwire', evidence_path: '/receipts/graphify.md', runtime_adoption: 'manual', next_action: 'Keep writes receipt-gated.', details: [{ label: 'Read-path gate', value: 'Read path visible; writes receipt-gated.', status: 'read_only' }, { label: 'Write authority boundary', value: 'Graphify/gBrain writes disabled without approval.', status: 'approval_required' }] },
      { id: 2, layer_key: 'david-msnj-brain', label: 'David Material Solutions brain', layer_type: 'david_brain', status: 'isolated', domain: 'Material Solutions / David', evidence_path: '/receipts/david.md', runtime_adoption: 'isolated', next_action: 'Never mix with Vortex project memory.', details: [{ label: 'Isolation / block gate', value: 'David memory remains Material Solutions-only isolated.', status: 'blocked' }, { label: 'Write authority boundary', value: 'No Vortex/Blackwire/trading writes.', status: 'blocked' }] },
      { id: 3, layer_key: 'unverified-memory-tool', label: 'Unverified memory tool', layer_type: 'candidate_tool', status: 'evidence_missing', domain: 'Candidate', evidence_path: null, runtime_adoption: 'not_adopted', next_action: 'Research before adoption.', details: [{ label: 'Evidence gate', value: 'Evidence Missing: storage proof absent.', status: 'evidence_missing' }, { label: 'Runtime adoption', value: 'Not Instrumented Yet.', status: 'not_instrumented' }] },
    ],
    correctionRequests: [
      { id: 1, request_key: 'blackwire-false-green-correction', title: 'Blackwire false-green correction', status: 'staged', domain: 'Mission Control', evidence_path: '/receipts/false-green.md', requested_change: 'Keep done evidence-gated.', next_action: 'Review and ingest through approved correction flow.', details: [{ label: 'Evidence requirement', value: 'Receipt attached: /receipts/false-green.md', status: 'read_only' }, { label: 'Approval / application gate', value: 'Approval Required: staged corrections cannot write memory.', status: 'approval_required' }, { label: 'Destination boundary', value: 'Cross-project corrections stay receipt-gated.', status: 'approval_required' }] },
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
      approvalRequired: 1,
      researchedBriefs: 1,
      citationReceiptsAttached: 2,
      promotionGatesVisible: true,
      notInstrumentedLanes: 1,
      approvalBlockedBriefs: 1,
      paidSimulationApprovalRequired: true,
      karpathiaConnectorInstrumented: false,
      autoPromotionEnabled: false,
    },
    briefs: [
      { id: 1, research_key: 'karpathia-source-plan', title: 'Karpathia source plan', lane: 'karpathia', status: 'planned', owner_agent: 'Karpathia', evidence_path: '/receipts/karpathia.md', next_action: 'Attach citations before action.', readinessGate: 'Not Instrumented Yet: source connector not active.', details: [{ label: 'Readiness gate', value: 'Not Instrumented Yet: source connector not active.', status: 'not_instrumented' }, { label: 'Promotion gate', value: 'Citations required before promotion.', status: 'planned' }] },
      { id: 2, research_key: 'mirofish-paid-sim', title: 'MiroFish paid simulation brief', lane: 'mirofish', status: 'approval_required', owner_agent: 'MiroFish', evidence_path: '/receipts/mirofish.md', next_action: 'Ask Chris before paid simulation.', readinessGate: 'Approval Required: paid simulation blocked.', details: [{ label: 'Readiness gate', value: 'Approval Required: paid simulation blocked.', status: 'approval_required' }] },
      { id: 3, research_key: 'unverified-market-signal', title: 'Unverified market signal', lane: 'trading_research', status: 'evidence_missing', owner_agent: 'Atlas', evidence_path: null, next_action: 'Cite sources before promotion.', readinessGate: 'Evidence Missing: citations absent.', details: [{ label: 'Citation plan', value: 'Market signal needs sources.', status: 'evidence_missing' }, { label: 'Promotion gate', value: 'No trades without approval.', status: 'planned' }] },
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
      blockedItems: 1,
      detailGatesVisible: 12,
      sourceReceiptsLinked: 3,
      ledgerReceiptsLinked: 0,
      livePositionsImported: false,
      fillsImported: false,
      pnlImported: false,
      executionEnabled: false,
      connectorInstrumented: false,
      walletMutationEnabled: false,
      approvalRequiredForTrades: true,
    },
    watchItems: [
      { id: 1, item_key: 'polymarket-watchlist-shell', title: 'Polymarket watchlist shell', lane: 'watchlist', status: 'planned', owner_agent: 'Herald', market_url: null, evidence_path: '/receipts/watch.md', next_action: 'Add sourced watch items only.', details: [{ label: 'Market data gate', value: 'Not Instrumented Yet: no live quotes.', status: 'not_instrumented' }, { label: 'Execution boundary', value: 'No orders or API-key use.', status: 'blocked' }] },
      { id: 2, item_key: 'execution-hard-block', title: 'Execution hard block', lane: 'execution_guard', status: 'blocked', owner_agent: 'Ledger', market_url: null, evidence_path: '/receipts/block.md', next_action: 'No trades from Mission Control.', details: [{ label: 'Execution hard block', value: 'Blocked: no order placement or account mutation route exists.', status: 'blocked' }, { label: 'Approval object requirement', value: 'Explicit Chris approval required.', status: 'approval_required' }] },
      { id: 3, item_key: 'approval-gated-risk-note', title: 'Approval-gated risk note', lane: 'risk', status: 'approval_required', owner_agent: 'Knox', market_url: null, evidence_path: '/receipts/risk.md', next_action: 'Ask Chris before account-affecting action.', details: [{ label: 'Sizing input gate', value: 'Approval Required before account-affecting action.', status: 'approval_required' }, { label: 'Balance / position truth', value: 'Evidence Missing: no balance imported.', status: 'evidence_missing' }] },
      { id: 4, item_key: 'uncited-market-signal', title: 'Uncited market signal', lane: 'signals', status: 'evidence_missing', owner_agent: 'Atlas', market_url: null, evidence_path: null, next_action: 'Attach citations.', details: [{ label: 'Signal evidence gate', value: 'Evidence Missing: citations absent.', status: 'evidence_missing' }, { label: 'Actionability boundary', value: 'No signal can trigger a trade.', status: 'blocked' }] },
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
      qaGatesVisible: 4,
      designReceiptsLinked: 3,
      externalPublishEnabled: false,
      visualQaProven: true,
      patchRuntimeAuthority: false,
    },
    items: [
      { id: 1, item_key: 'mission-control-brand-system', title: 'Mission Control brand system', lane: 'brand', status: 'planned', owner_agent: 'Patch / Claw Design', evidence_path: '/receipts/design.md', screenshot_path: null, next_action: 'Attach token audit.', details: [{ label: 'Visual QA gate', value: 'Evidence Missing: capture screenshot.', status: 'evidence_missing' }, { label: 'Authority boundary', value: 'No deploy authority.', status: 'approval_required' }] },
      { id: 2, item_key: 'blackwire-room-visual-receipt', title: 'Blackwire room visual receipt', lane: 'visual_receipts', status: 'receipt_backed', owner_agent: 'Herm', evidence_path: '/receipts/blackwire-visual.md', screenshot_path: '/screenshots/blackwire.png', next_action: 'Use as QA baseline.', details: [{ label: 'Visual QA gate', value: 'Visual receipt linked.', status: 'read_only' }, { label: 'Authority boundary', value: 'No deploy authority.', status: 'approval_required' }] },
      { id: 3, item_key: 'unproven-design-claim', title: 'Unproven design claim', lane: 'ui_qa', status: 'evidence_missing', owner_agent: 'Neon Forge', evidence_path: null, screenshot_path: null, next_action: 'Capture browser proof.', details: [{ label: 'Visual QA gate', value: 'Evidence Missing: no screenshot.', status: 'evidence_missing' }, { label: 'Authority boundary', value: 'No deploy authority.', status: 'approval_required' }] },
      { id: 4, item_key: 'external-publish-guard', title: 'External publish guard', lane: 'publish_guard', status: 'blocked', owner_agent: 'Knox', evidence_path: '/receipts/no-publish.md', screenshot_path: null, next_action: 'Do not publish externally.', details: [{ label: 'Visual QA gate', value: 'Blocked from external publish.', status: 'blocked' }, { label: 'Authority boundary', value: 'No external publish authority.', status: 'blocked' }] },
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
      'automation-command',
      'trading',
      'design',
      'brain-memory',
      'asset-library',
      'think-tank',
      'brainstorm',
      'marketing',
      'security-command',
    ]))
  })

  it('exposes Think Tank as a read-only source-backed opportunity mining surface', () => {
    const thinkTank = getMissionControlSurfaceSnapshot('think-tank')
    const cards = thinkTank?.sections.flatMap((section) => section.cards) || []

    expect(thinkTank?.status).toBe('read_only')
    expect(thinkTank?.summary.autoPromotionEnabled).toBe(false)
    expect(thinkTank?.summary.sourceDocsSeeded).toBe(7)
    expect(thinkTank?.summary.axisAuditStatus).toBe('seeded_not_complete')
    expect(thinkTank?.guardrails.join(' ')).toContain('no automatic task creation')
    expect(cards.find((card) => card.id === 'source-scout-post')?.evidence).toContain('scout_post.txt')
    expect(cards.find((card) => card.id === 'source-mushroom-ideas')?.evidence).toContain('mushroom_ideas.md')
    expect(cards.find((card) => card.id === 'opp-agent-dashboard')?.summary).toContain('Every agent on one screen')
    expect(cards.find((card) => card.id === 'opp-strain-savers')?.summary).toContain('Personal mushroom strain library')
    expect(cards.find((card) => card.id === 'audit-pass-2')?.status).toBe('planned')
  })

  it('surfaces Security Command audit hooks and false-green evidence gates', () => {
    const security = getMissionControlSurfaceSnapshot('security-command')
    const cards = security?.sections.flatMap((section) => section.cards) || []

    expect(security?.summary.auditHooks).toBe(3)
    expect(security?.summary.notInstrumentedHooks).toBe(2)
    expect(security?.summary.evidenceMissingHooks).toBe(1)
    expect(security?.guardrails.join(' ')).toContain('Mock security guardrail')
    expect(cards.find((card) => card.id === 'security-hook-secret-scan')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'security-hook-secret-scan')?.details?.find((detail) => detail.label === 'Secret boundary')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'system-mission-control')?.details?.find((detail) => detail.label === 'Secret/dependency scan gate')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'finding-1')?.details?.find((detail) => detail.label === 'False-green boundary')?.value).toContain('Not green')
  })

  it('exposes n8n MCP automations as read-only approval-gated workflows without live execution', () => {
    const automation = getMissionControlSurfaceSnapshot('automation-command')
    const cards = automation?.sections.flatMap((section) => section.cards) || []

    expect(automation?.status).toBe('approval_required')
    expect(automation?.summary.readOnlyRegistry).toBe(true)
    expect(automation?.summary.liveExecutionEnabled).toBe(false)
    expect(automation?.summary.credentialAccessEnabled).toBe(false)
    expect(automation?.summary.failedQueueInstrumented).toBe(false)
    expect(automation?.guardrails.join(' ')).toContain('credential stores')
    expect(cards.find((card) => card.id === 'research-intake-workflows')?.status).toBe('not_instrumented')
    expect(cards.find((card) => card.id === 'marketing-draft-workflows')?.details?.find((detail) => detail.label === 'Blocked external action')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'security-audit-workflows')?.details?.find((detail) => detail.label === 'Secrets boundary')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'trading-watch-workflows')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'receipt-and-failure-queue')?.details?.find((detail) => detail.label === 'Done boundary')?.value).toContain('No workflow can mark Done')
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

  it('projects Trading Operations DB rows with source, execution, ledger, and approval gates visible', () => {
    const trading = getMissionControlSurfaceSnapshot('trading')
    const cards = trading?.sections.flatMap((section) => section.cards) || []

    expect(trading?.summary.totalWatchItems).toBe(4)
    expect(trading?.summary.executionEnabled).toBe(false)
    expect(trading?.summary.walletMutationEnabled).toBe(false)
    expect(trading?.summary.livePositionsImported).toBe(false)
    expect(trading?.summary.pnlImported).toBe(false)
    expect(trading?.summary.detailGatesVisible).toBe(12)
    expect(trading?.guardrails.join(' ')).toContain('No real trades')
    expect(cards.find((card) => card.id === 'trading-polymarket-watchlist-shell')?.details?.find((detail) => detail.label === 'Market data gate')?.status).toBe('not_instrumented')
    expect(cards.find((card) => card.id === 'trading-uncited-market-signal')?.details?.find((detail) => detail.label === 'Signal evidence gate')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'trading-approval-gated-risk-note')?.details?.find((detail) => detail.label === 'Sizing input gate')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'trading-execution-hard-block')?.details?.find((detail) => detail.label === 'Execution hard block')?.value).toContain('Blocked')
  })

  it('merges DB-backed Asset Library rows into the shared surface without hiding evidence gaps', () => {
    const assetLibrary = getMissionControlSurfaceSnapshot('asset-library')
    const cards = assetLibrary?.sections.flatMap((section) => section.cards) || []

    expect(assetLibrary?.summary.totalAssets).toBe(3)
    expect(assetLibrary?.summary.evidenceMissing).toBe(1)
    expect(assetLibrary?.summary.promotionGatesVisible).toBe(2)
    expect(assetLibrary?.summary.sourceReceiptsLinked).toBe(1)
    expect(assetLibrary?.summary.externalPublishEnabled).toBe(false)
    expect(assetLibrary?.guardrails.join(' ')).toContain('Mock asset guardrail')
    expect(assetLibrary?.sections[0]?.id).toBe('asset-readiness-triage')
    expect(cards.find((card) => card.id === 'asset-receipt-coverage')?.summary).toContain('1 of 3 assets')
    expect(cards.find((card) => card.id === 'asset-publish-boundary')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'asset-publish-boundary')?.details?.find((detail) => detail.label === 'Blocked use')?.value).toContain('No external post')
    expect(cards.find((card) => card.id === 'asset-mission-control-local-mvp-proof')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'asset-design-visual-receipts')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'asset-design-visual-receipts')?.details?.find((detail) => detail.label === 'Verification gate')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'asset-mission-control-local-mvp-proof')?.details?.find((detail) => detail.label === 'Promotion boundary')?.value).toContain('No external action')
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
    expect(cards.find((card) => card.id === 'idea-blackwire-room-demo')?.details?.find((detail) => detail.label === 'Promotion boundary')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'idea-unverified-marketplace-app')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'idea-unverified-marketplace-app')?.details?.find((detail) => detail.label === 'Research / evidence gate')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'idea-unverified-marketplace-app')?.details?.find((detail) => detail.label === 'Promotion boundary')?.value).toContain('No automatic promotion')
  })

  it('merges DB-backed Brain / Memory layers into the shared surface with isolation and write gates visible', () => {
    const brainMemory = getMissionControlSurfaceSnapshot('brain-memory')
    const cards = brainMemory?.sections.flatMap((section) => section.cards) || []

    expect(brainMemory?.summary.totalLayers).toBe(4)
    expect(brainMemory?.summary.writeEnabled).toBe(false)
    expect(brainMemory?.summary.davidIsolationEnforced).toBe(true)
    expect(brainMemory?.summary.stagedCorrections).toBe(1)
    expect(brainMemory?.summary.writeGatesVisible).toBe(4)
    expect(brainMemory?.summary.isolatedLayers).toBe(1)
    expect(brainMemory?.guardrails.join(' ')).toContain('Mock brain memory guardrail')
    expect(cards.find((card) => card.id === 'memory-layer-graphify-internal')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'memory-layer-graphify-internal')?.details?.find((detail) => detail.label === 'Write authority boundary')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'memory-layer-david-msnj-brain')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'memory-layer-david-msnj-brain')?.details?.find((detail) => detail.label === 'Isolation / block gate')?.value).toContain('Material Solutions-only')
    expect(cards.find((card) => card.id === 'memory-layer-unverified-memory-tool')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'memory-layer-unverified-memory-tool')?.details?.find((detail) => detail.label === 'Runtime adoption')?.status).toBe('not_instrumented')
    expect(cards.find((card) => card.id === 'memory-correction-blackwire-false-green-correction')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'memory-correction-blackwire-false-green-correction')?.details?.find((detail) => detail.label === 'Approval / application gate')?.status).toBe('approval_required')
  })

  it('merges DB-backed Research Command briefs while keeping Karpathia/MiroFish no-fake-green gates visible', () => {
    const research = getMissionControlSurfaceSnapshot('research-command')
    const cards = research?.sections.flatMap((section) => section.cards) || []

    expect(research?.summary.totalBriefs).toBe(4)
    expect(research?.summary.paidSimulationApprovalRequired).toBe(true)
    expect(research?.summary.karpathiaConnectorInstrumented).toBe(false)
    expect(research?.summary.autoPromotionEnabled).toBe(false)
    expect(research?.guardrails.join(' ')).toContain('Mock research guardrail')
    expect(research?.sections[0]?.id).toBe('daily-research-triage')
    expect(cards.find((card) => card.id === 'research-evidence-gaps')?.evidence).toContain('2 citation receipts')
    expect(cards.find((card) => card.id === 'research-approval-queue')?.nextAction).toContain('paid simulation')
    expect(cards.find((card) => card.id === 'research-instrumentation-boundary')?.status).toBe('not_instrumented')
    expect(cards.find((card) => card.id === 'research-karpathia-source-plan')?.status).toBe('planned')
    expect(cards.find((card) => card.id === 'research-karpathia-source-plan')?.summary).toContain('Not Instrumented Yet')
    expect(cards.find((card) => card.id === 'research-karpathia-source-plan')?.details?.find((detail) => detail.label === 'Readiness gate')?.status).toBe('not_instrumented')
    expect(cards.find((card) => card.id === 'research-mirofish-paid-sim')?.status).toBe('approval_required')
    expect(cards.find((card) => card.id === 'research-unverified-market-signal')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'research-unverified-market-signal')?.details?.find((detail) => detail.label === 'Promotion gate')?.value).toContain('No trades')
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
    expect(design?.summary.qaGatesVisible).toBe(4)
    expect(design?.summary.designReceiptsLinked).toBe(3)
    expect(design?.summary.externalPublishEnabled).toBe(false)
    expect(design?.summary.patchRuntimeAuthority).toBe(false)
    expect(design?.guardrails.join(' ')).toContain('Mock design guardrail')
    expect(cards.find((card) => card.id === 'design-mission-control-brand-system')?.status).toBe('planned')
    expect(cards.find((card) => card.id === 'design-blackwire-room-visual-receipt')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'design-unproven-design-claim')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'design-external-publish-guard')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'design-blackwire-room-visual-receipt')?.details?.find((detail) => detail.label === 'Visual QA gate')?.status).toBe('read_only')
    expect(cards.find((card) => card.id === 'design-unproven-design-claim')?.details?.find((detail) => detail.label === 'Visual QA gate')?.value).toContain('Evidence Missing')
    expect(cards.find((card) => card.id === 'design-external-publish-guard')?.details?.find((detail) => detail.label === 'Authority boundary')?.status).toBe('blocked')
  })
})
