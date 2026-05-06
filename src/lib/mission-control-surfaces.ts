import { getAssetLibrarySnapshot } from './asset-library-command'
import { getBrainstormSnapshot } from './brainstorm-command'
import { getBrainMemorySnapshot } from './brain-memory-command'
import { getDesignStudioSnapshot } from './design-studio-command'
import { getMarketingCommandCenterSnapshot } from './marketing-command-center'
import { getResearchCommandSnapshot } from './research-command'
import { getSecurityCommandSnapshot } from './security-command-center'
import { getTradingOperationsSnapshot } from './trading-operations-command'

export type SurfaceStatus = 'read_only' | 'not_instrumented' | 'approval_required' | 'evidence_missing' | 'planned' | 'blocked'

export interface SurfaceCard {
  id: string
  title: string
  status: SurfaceStatus
  owner?: string
  summary: string
  evidence: string
  nextAction: string
  details?: Array<{ label: string; value: string; status?: SurfaceStatus }>
  links?: Array<{ label: string; href: string }>
}

export interface SurfaceSection {
  id: string
  title: string
  status?: SurfaceStatus
  cards: SurfaceCard[]
}

export interface MissionControlSurfaceSnapshot {
  id: string
  title: string
  eyebrow: string
  status: SurfaceStatus
  safetyMode: 'read_only'
  description: string
  generatedAt: number
  guardrails: string[]
  summary: Record<string, number | boolean | string>
  sections: SurfaceSection[]
}

const globalGuardrails = [
  'Read-only MVP surface: no external posts, sends, spend, trades, account mutation, API-key use, or Graphify/gBrain writes.',
  'Missing integrations must stay labeled Not Instrumented Yet or Evidence Missing; no fake-green metrics.',
  'External execution requires an explicit approval object with scope, blast radius, and rollback/stop plan.',
  'David / Material Solutions memory remains isolated to Material Solutions-only contexts.',
]

const card = (input: SurfaceCard): SurfaceCard => input

const tradingSurfaceDetails = (lane: string): SurfaceCard['details'] => {
  const common = {
    watchlist: [{ label: 'Market data gate', value: 'Not Instrumented Yet: no live market connector or quote receipt attached.', status: 'not_instrumented' as const }],
    signals: [{ label: 'Signal evidence gate', value: 'Evidence Missing: citations and timestamps required before actionability.', status: 'evidence_missing' as const }],
    risk: [{ label: 'Sizing input gate', value: 'Approval Required before account-affecting risk/sizing action.', status: 'approval_required' as const }],
    spread: [{ label: 'Spread data gate', value: 'Not Instrumented Yet: no cross-market quote, fee, or fill-risk source attached.', status: 'not_instrumented' as const }],
    ledger: [{ label: 'Ledger receipt gate', value: 'Evidence Missing: positions, fills, P&L, and hit rate require verified receipts.', status: 'evidence_missing' as const }],
    execution_guard: [{ label: 'Execution hard block', value: 'Blocked: no order, wallet, account mutation, API-key use, or automated execution route exists.', status: 'blocked' as const }],
  }
  return common[lane as keyof typeof common] || [{ label: 'Trading truth gate', value: 'Evidence Missing until trading source, approval, and receipt gates are linked.', status: 'evidence_missing' }]
}

const snapshots: Record<string, Omit<MissionControlSurfaceSnapshot, 'generatedAt'>> = {
  'mission-control': {
    id: 'mission-control',
    title: 'Mission Control MVP Home',
    eyebrow: 'Finish-line surfaces / truthful instrumentation',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'One user-visible home for the Mission Control MVP surface map: Command Truth, Blackwire ops, Brain/Memory, Asset Library, Brainstorm Wall, Security, Marketing, Research, Automation, Design, and Trading. It is a read-only command map; missing integrations remain visibly Not Instrumented Yet or Evidence Missing.',
    guardrails: [
      ...globalGuardrails,
      'No external marketing sends/posts/spend from Mission Control without explicit Chris approval.',
      'No real trades, order placement, wallet/account mutation, or market API-key use from Mission Control without explicit Chris approval.',
      'MiroFish paid simulations require explicit approval before paid run or external compute spend.',
    ],
    summary: { surfaces: 11, externalExecutionEnabled: false, approvalGatesVisible: true, fakeGreenAllowed: false },
    sections: [
      { id: 'live-ops', title: 'Live ops / evidence-gated Done', cards: [
        card({ id: 'command-truth', title: 'Command Truth + Blackwire flow', status: 'read_only', owner: 'Herm', summary: 'Canonical-root cockpit for Blackwire group chat, task board, approvals, receipts, evidence-gated Done, and rollback truth.', evidence: 'Command Truth panel and Blackwire group chat routes are linked from the app shell.', nextAction: 'Use Command Truth for source-of-truth checks before claiming completion.', links: [{ label: 'Command Truth', href: '/command-truth' }, { label: 'Blackwire Group Chat', href: '/group-chat' }] }),
        card({ id: 'security-command', title: 'Security Command Center', status: 'read_only', owner: 'Knox', summary: 'Security posture, audit hooks, findings, and evidence gaps without secret printing or unsafe mutation.', evidence: 'DB-backed security snapshot is included when available; missing hooks stay Evidence Missing.', nextAction: 'Open Security Command Center for current findings.', links: [{ label: 'Security Command Center', href: '/security-command' }] }),
      ]},
      { id: 'knowledge-assets', title: 'Knowledge, memory, assets, and ideation', cards: [
        card({ id: 'brain-memory', title: 'Brain / Memory', status: 'read_only', owner: 'Ledger / Knox', summary: 'Read-only memory harmony, correction requests, and David Material Solutions isolation boundary.', evidence: 'Graphify/gBrain writes are not enabled here; corrections require approved ingestion/correction receipts.', nextAction: 'Browse only; stage corrections with evidence before any write.', links: [{ label: 'Brain / Memory', href: '/brain-memory' }] }),
        card({ id: 'asset-library', title: 'Asset Library', status: 'read_only', summary: 'Reusable receipts, screenshots, documents, prompts, and proof-file library without invented inventory.', evidence: 'Links to existing Documents/Office sources; assets without links stay Evidence Missing.', nextAction: 'Attach proof files before promoting an asset claim.', links: [{ label: 'Asset Library', href: '/asset-library' }] }),
        card({ id: 'think-tank', title: 'Think Tank', status: 'read_only', summary: 'Treasure-audit workspace that mines old Axis/OpenClaw/App Factory/Carpathia research into ranked, source-backed opportunity cards.', evidence: 'Seeded from scout_post.txt, mushroom_ideas.md, Dispatch brainstorms, AxeVault topics, and App Factory Mr. Blanc research.', nextAction: 'Audit more source folders, attach provenance, then promote only through Research Command/approval gates.', links: [{ label: 'Think Tank', href: '/think-tank' }] }),
        card({ id: 'brainstorm', title: 'Brainstorm Wall', status: 'read_only', summary: 'Idea intake and parking lot with evidence/approval gates before promotion to tasks, campaigns, designs, trades, or memory.', evidence: 'Ideas are unverified until researched and receipt-backed.', nextAction: 'Promote only through Research Command Center or scoped approvals.', links: [{ label: 'Brainstorm Wall', href: '/brainstorm' }] }),
      ]},
      { id: 'growth-research-design-trading', title: 'Growth, research, design, and markets', cards: [
        card({ id: 'marketing', title: 'Marketing Command Center', status: 'approval_required', summary: 'Global and per-project marketing tabs, playbooks, templates, experiment board, and approval gates.', evidence: 'External sends/posts/spend remain approval-gated; analytics missing stays Not Instrumented Yet.', nextAction: 'Prepare drafts and approval requests only; do not send/post/spend.', links: [{ label: 'Marketing Command Center', href: '/marketing' }] }),
        card({ id: 'research-command', title: 'Research Command Center', status: 'read_only', owner: 'Karpathia / MiroFish', summary: 'Research queue, citation vault, findings board, Karpathia Auto-Research shell, and MiroFish Simulation Lab approval gate.', evidence: 'Karpathia connector is Not Instrumented Yet; MiroFish paid simulations require approval.', nextAction: 'Stage source-backed research plans and simulation briefs.', links: [{ label: 'Research Command Center', href: '/research-command' }] }),
        card({ id: 'automation-command', title: 'Automation / n8n MCP Command Center', status: 'approval_required', owner: 'Herm / Knox', summary: 'Read-only workflow registry for n8n MCP automations across Research, Marketing, Security, Trading, and Design.', evidence: 'n8n host, credentials, MCP execution, and approval model are Not Instrumented Yet; no live workflow execution path is enabled.', nextAction: 'Use as planning/approval surface only until read-only auth, credential scoping, and receipts are proven.', links: [{ label: 'Automation Command Center', href: '/automation-command' }] }),
        card({ id: 'design', title: 'Design Studio', status: 'read_only', summary: 'Brand systems, UI QA, visual receipts, color/language psychology, and design decisions.', evidence: 'Visual QA remains Evidence Missing until screenshot receipts are linked.', nextAction: 'Capture and attach visual receipts before approving design claims.', links: [{ label: 'Design Studio', href: '/design' }] }),
        card({ id: 'trading', title: 'Trading Operations Cockpit', status: 'blocked', owner: 'Herald / Atlas / Knox / Spread / Ledger', summary: 'Polymarket/approved-market watchlist, signals, risk shell, spread monitor, ledger placeholders, and no-execution guardrails.', evidence: 'No trading connector, positions, fills, P&L, orders, or wallet/API mutation path exists in this MVP surface.', nextAction: 'Use as read-only research/watch surface only.', links: [{ label: 'Trading Cockpit', href: '/trading' }] }),
      ]},
    ],
  },
  'security-command': {
    id: 'security-command',
    title: 'Security Command Center',
    eyebrow: 'Security posture / audit receipts',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Security command surface for posture, audit receipts, secrets hygiene, approval-sensitive actions, and evidence gaps. It links to existing Security Audit without mutating settings or exposing secrets.',
    guardrails: [
      ...globalGuardrails,
      'Do not print secrets, .env values, API keys, .data contents, or .local-proof-api-key.',
      'Security fixes remain approval-gated unless already covered by existing safe local scan contracts.',
    ],
    summary: { secretPrintingAllowed: false, mutationEnabled: false, auditPanelLinked: true, posture: 'Evidence Missing until scanned' },
    sections: [
      { id: 'posture', title: 'Security posture lanes', cards: [
        card({ id: 'audit', title: 'Security audit receipts', status: 'read_only', owner: 'Knox', summary: 'Review audit output, scanner status, and remediations through the existing Security Audit page.', evidence: 'Existing Security Audit panel linked; this snapshot does not run scans.', nextAction: 'Open Security Audit for current scan data.', links: [{ label: 'Security Audit', href: '/security' }] }),
        card({ id: 'secrets', title: 'Secrets hygiene', status: 'blocked', owner: 'Knox', summary: 'Never display or exfiltrate secrets from env/data/local proof files.', evidence: 'Policy boundary visible; no secret reader is implemented here.', nextAction: 'Keep diagnostics redacted.' }),
        card({ id: 'approval-sensitive-fixes', title: 'Approval-sensitive fixes', status: 'approval_required', owner: 'Ledger', summary: 'Config changes, credential rotation, network exposure changes, and destructive cleanup require scoped approval.', evidence: 'No mutation controls on this page.', nextAction: 'Use approval workflow with rollback notes.' }),
        card({ id: 'evidence-gaps', title: 'Evidence gaps', status: 'evidence_missing', summary: 'Unknown scanner state or stale receipts stay labeled Evidence Missing.', evidence: 'Evidence Missing until fresh scan/receipt is linked.', nextAction: 'Run approved security audit flow if needed.' }),
      ]},
    ],
  },
  'automation-command': {
    id: 'automation-command',
    title: 'Automation / n8n MCP Command Center',
    eyebrow: 'Workflow registry / approval-gated automation',
    status: 'approval_required',
    safetyMode: 'read_only',
    description: 'Read-only Mission Control surface for planned n8n MCP automations: workflow catalog, trigger state, last-execution receipts, failed execution queue, owner/project mapping, and approval gates. It is not a live n8n connector and cannot execute workflows.',
    guardrails: [
      ...globalGuardrails,
      'n8n host, MCP tool execution, credential access, and workflow mutation are Not Instrumented Yet until auth, scoping, receipts, and approval models are reviewed.',
      'No email/SMS/social sends, marketplace posts, paid ads/spend, trades/orders/wallet/account mutation, production deploys/env changes, or database writes outside approved receipt stores from this surface.',
      'Secrets stay in n8n/MCP credential stores; Mission Control must never print or persist credentials.',
    ],
    summary: { workflowsTracked: 6, readOnlyRegistry: true, liveExecutionEnabled: false, credentialAccessEnabled: false, approvalsRequired: 6, evidenceMissing: 6, failedQueueInstrumented: false },
    sections: [
      { id: 'workflow-catalog', title: 'Workflow catalog / project mapping', status: 'approval_required', cards: [
        card({ id: 'research-intake-workflows', title: 'Research intake and citation workflows', status: 'not_instrumented', owner: 'Karpathia / Atlas', summary: 'RSS/feed/news collection, source aggregation, daily digest, and citation vault intake planned as n8n workflows.', evidence: 'Not Instrumented Yet: no source connector, n8n host receipt, workflow ID, or citation execution receipt linked.', nextAction: 'Stage workflow specs and citation receipt schema before enabling connectors.', details: [{ label: 'Allowed class', value: 'Read-only source collection and draft digest preparation only.', status: 'read_only' }, { label: 'Execution gate', value: 'Not Instrumented Yet until read-only auth and source receipts are proven.', status: 'not_instrumented' }, { label: 'Promotion boundary', value: 'No research output promotes to tasks, marketing, trading, or memory without evidence plus scoped approval.', status: 'approval_required' }], links: [{ label: 'Research Command Center', href: '/research-command' }] }),
        card({ id: 'marketing-draft-workflows', title: 'Marketing draft workflows', status: 'approval_required', owner: 'Growth / Knox', summary: 'Draft generation, campaign research, asset/brief aggregation, and approval packet preparation only.', evidence: 'Approval Required: no external sends/posts/spend or campaign mutation receipts exist.', nextAction: 'Keep workflows draft-only and create scoped approval packets before any public or paid action.', details: [{ label: 'Allowed class', value: 'Internal drafts, research, asset grouping, and approval packet assembly.', status: 'read_only' }, { label: 'Blocked external action', value: 'Email/SMS/social/marketplace/ad sends, posts, spend, and settings mutation require explicit Chris approval.', status: 'approval_required' }, { label: 'Analytics gate', value: 'Not Instrumented Yet until real analytics/source receipts are attached.', status: 'not_instrumented' }], links: [{ label: 'Marketing Command Center', href: '/marketing' }] }),
        card({ id: 'security-audit-workflows', title: 'Security audit and hygiene workflows', status: 'evidence_missing', owner: 'Knox', summary: 'Scheduled security checks, workflow failure/stall detection, secret hygiene checks, and audit receipt generation.', evidence: 'Evidence Missing: no last execution receipt, failed queue hook, or redacted scan receipt is linked.', nextAction: 'Wire only redacted, read-only audit receipts; do not expose secrets or mutate credentials.', details: [{ label: 'Allowed class', value: 'Redacted receipt generation and failure/stall detection.', status: 'read_only' }, { label: 'Secrets boundary', value: 'Secrets must stay in credential stores; no .env/API key printing in UI or receipts.', status: 'blocked' }, { label: 'Failure queue', value: 'Not Instrumented Yet until failed execution queue source is linked.', status: 'not_instrumented' }], links: [{ label: 'Security Command Center', href: '/security-command' }] }),
      ]},
      { id: 'execution-boundaries', title: 'Trigger state / execution boundaries', status: 'blocked', cards: [
        card({ id: 'trading-watch-workflows', title: 'Trading market/news watch workflows', status: 'blocked', owner: 'Herald / Atlas / Ledger', summary: 'Market/news feed ingest, watchlist update, and signal research aggregation may be planned, but execution stays hard-blocked.', evidence: 'Blocked: no trading connector, order path, wallet/account mutation, API-key access, positions, fills, or P&L receipt exists.', nextAction: 'Use read-only research/watch workflows only after source receipts; never trade from Mission Control without explicit approval.', details: [{ label: 'Allowed class', value: 'Read-only market/news research and watchlist draft updates.', status: 'read_only' }, { label: 'Hard block', value: 'No orders, cancellations, wallet movement, account mutation, API-key use, positions/fills/P&L claims, or automated execution.', status: 'blocked' }, { label: 'Approval gate', value: 'Any account-affecting or financial action requires explicit Chris approval with scope and stop plan.', status: 'approval_required' }], links: [{ label: 'Trading Operations Cockpit', href: '/trading' }] }),
        card({ id: 'design-qa-workflows', title: 'Design QA and visual receipt workflows', status: 'evidence_missing', owner: 'Patch / Design', summary: 'Open Design/Noxu Labs hooks, screenshot capture, visual QA, and design receipt generation planned after install/review.', evidence: 'Evidence Missing: no screenshot workflow, visual QA run, or receipt capture is linked.', nextAction: 'Keep screenshots/QA read-only; attach visual receipts before claiming design proof.', details: [{ label: 'Allowed class', value: 'Screenshot capture and visual QA receipt generation only.', status: 'read_only' }, { label: 'Evidence gate', value: 'Evidence Missing until browser screenshots or design receipts are attached.', status: 'evidence_missing' }, { label: 'Authority boundary', value: 'No deploy, env, external publish, or customer-facing mutation authority.', status: 'approval_required' }], links: [{ label: 'Design Studio', href: '/design' }] }),
        card({ id: 'receipt-and-failure-queue', title: 'Receipts and failed execution queue', status: 'not_instrumented', owner: 'Herm / Ledger', summary: 'Every workflow must emit a receipt and failed/stalled executions must surface in Command Truth and Security.', evidence: 'Not Instrumented Yet: no n8n execution log source, failure queue, or Mission Control receipt ingestion path connected.', nextAction: 'Define receipt schema and failed-execution source before enabling any live workflow.', details: [{ label: 'Receipt requirement', value: 'Each workflow needs workflow ID, owner, project, trigger, approval object, run result, evidence link, and rollback/stop note.', status: 'approval_required' }, { label: 'Failed queue', value: 'Not Instrumented Yet until n8n failure/stall queue is readable by Mission Control.', status: 'not_instrumented' }, { label: 'Done boundary', value: 'No workflow can mark Done without attached evidence/receipt.', status: 'blocked' }], links: [{ label: 'Command Truth', href: '/command-truth' }] }),
      ]},
    ],
  },
  'research-command': {
    id: 'research-command',
    title: 'Research Command Center',
    eyebrow: 'Research OS',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Queue, source vault, findings board, Karpathia Auto-Research, MiroFish Simulation Lab, memory harmony, and research-to-action pipeline. The surface organizes work only; it does not fetch paid tools or write memory without approval.',
    guardrails: [
      ...globalGuardrails,
      'Karpathia Auto-Research is a queue/orchestration shell until source connectors are instrumented.',
      'MiroFish paid simulations require explicit approval before any paid run or external compute spend.',
    ],
    summary: { queues: 4, sourceVaults: 3, findingsLanes: 4, paidSimulationGuarded: true },
    sections: [
      { id: 'queue', title: 'Research queue', cards: [
        card({ id: 'intake-triage', title: 'Intake triage', status: 'read_only', owner: 'Herald', summary: 'Prioritize questions, hypotheses, and operator asks before assigning agents.', evidence: 'Local UI surface only; queue persistence not instrumented yet.', nextAction: 'Use as manual triage board until task-backed research intake is wired.', links: [{ label: 'Brainstorm Wall', href: '/brainstorm' }] }),
        card({ id: 'citation-vault', title: 'Source / citation vault', status: 'evidence_missing', owner: 'Atlas', summary: 'Track source URLs, excerpts, confidence, and citation gaps.', evidence: 'Evidence Missing for external citation ingestion; no web/source connector used here.', nextAction: 'Attach findings to receipts before promoting into actions.' }),
        card({ id: 'findings-board', title: 'Findings board', status: 'read_only', owner: 'Knox', summary: 'Separate findings, assumptions, risks, and decisions.', evidence: 'Manual board; no automatic claims should be treated as verified.', nextAction: 'Require evidence receipts for each promoted finding.' }),
      ]},
      { id: 'labs', title: 'Karpathia + MiroFish labs', cards: [
        card({ id: 'karpathia', title: 'Karpathia Auto-Research', status: 'not_instrumented', owner: 'Karpathia', summary: 'Auto-research module shell for source planning, collection plan, confidence, and citation coverage.', evidence: 'Not Instrumented Yet: no autonomous external research connector active.', nextAction: 'Keep generated plans in draft state until citations are attached.' }),
        card({ id: 'mirofish', title: 'MiroFish Simulation Lab', status: 'approval_required', owner: 'MiroFish', summary: 'Simulation request board for scenario, assumptions, cost class, approval, and results receipt.', evidence: 'Paid simulation execution is blocked without explicit approval.', nextAction: 'Prepare simulation briefs only; do not run paid simulations.' }),
        card({ id: 'memory-harmony', title: 'Memory harmony', status: 'blocked', owner: 'Ledger / Knox', summary: 'Reconcile research outputs against Brain/Memory without unsafe Graphify/gBrain writes.', evidence: 'Writes forbidden except approved ingestion/correction.', nextAction: 'Stage corrections as review requests with evidence.' }),
      ]},
      { id: 'pipeline', title: 'Research-to-action pipeline', cards: [
        card({ id: 'action-gate', title: 'Action approval gate', status: 'approval_required', summary: 'Promote research into tasks, marketing drafts, designs, or trading watchlist only after evidence review.', evidence: 'Approval surface exists; automated promotion not instrumented.', nextAction: 'Create scoped approvals for external/paid/account-affecting actions.' }),
      ]},
    ],
  },
  trading: {
    id: 'trading',
    title: 'Trading Operations Cockpit',
    eyebrow: 'Markets watch / no execution',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Polymarket and approved-market watchlist, signal board, risk/sizing shell, execution guardrails, spread monitor, ledger/performance placeholders, research/simulation links, and agent mapping. It never displays fake positions, fills, or P&L.',
    guardrails: [
      ...globalGuardrails,
      'No real trades, order placement, cancellation, account mutation, wallet action, or API-key use from this MVP surface.',
      'Positions/fills/P&L remain Evidence Missing unless imported from a verified ledger receipt.',
    ],
    summary: { watchlistItems: 0, livePositions: 'Evidence Missing', fills: 'Evidence Missing', pnl: 'Evidence Missing', executionEnabled: false },
    sections: [
      { id: 'markets', title: 'Watchlist + signals', cards: [
        card({ id: 'approved-watchlist', title: 'Approved markets watchlist', status: 'not_instrumented', owner: 'Herald', summary: 'Manual watchlist shell for Polymarket/approved markets with thesis, source, liquidity, and resolution notes.', evidence: 'Not Instrumented Yet: no market connector or live quotes.', nextAction: 'Add markets only as manual research references.' }),
        card({ id: 'signal-board', title: 'Signal board', status: 'evidence_missing', owner: 'Atlas', summary: 'Signals must cite research, simulation, and timing assumptions.', evidence: 'Evidence Missing until citations/simulation receipts are linked.', nextAction: 'Link every signal to Research Command Center findings.', links: [{ label: 'Research Command Center', href: '/research-command' }] }),
        card({ id: 'spread-monitor', title: 'Spread monitor', status: 'not_instrumented', owner: 'Spread', summary: 'Placeholder for spread, depth, and slippage observations.', evidence: 'Not Instrumented Yet: no exchange/order book integration.', nextAction: 'Keep as manual notes only.' }),
      ]},
      { id: 'risk', title: 'Risk, sizing, execution guardrails', cards: [
        card({ id: 'risk-sizing', title: 'Risk / sizing panel', status: 'approval_required', owner: 'Knox', summary: 'Sizing checklist shell: bankroll cap, max loss, confidence, edge source, and stop condition.', evidence: 'No bankroll/account data loaded.', nextAction: 'Require operator-entered figures and approval before any external action.' }),
        card({ id: 'execution-guard', title: 'Execution approval guardrails', status: 'blocked', owner: 'Ledger', summary: 'Execution is blocked in this app surface.', evidence: 'No execution route is implemented.', nextAction: 'Use external manual workflow only after explicit approval.' }),
        card({ id: 'ledger-performance', title: 'Ledger / performance', status: 'evidence_missing', owner: 'Ledger', summary: 'No fake positions, fills, or P&L; only verified receipts may appear.', evidence: 'Evidence Missing: no verified trading ledger imported.', nextAction: 'Import read-only receipts before showing performance.' }),
      ]},
      { id: 'agent-map', title: 'Agent mapping', cards: [
        card({ id: 'herald-atlas-knox-spread-ledger', title: 'Herald / Atlas / Knox / Spread / Ledger', status: 'read_only', summary: 'Herald: watchlist intake; Atlas: research; Knox: risk; Spread: market microstructure; Ledger: receipts/performance.', evidence: 'Role map only; no autonomous execution.', nextAction: 'Use role map for review assignment.' }),
      ]},
    ],
  },
  design: {
    id: 'design',
    title: 'Design Studio',
    eyebrow: 'Product + brand system',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Brand systems, UI QA, component status, screenshots/visual receipts, color/language psychology, and design decisions. No claim of completed QA without screenshots or receipts.',
    guardrails: [...globalGuardrails, 'Visual QA must cite screenshot receipts or stay Evidence Missing.'],
    summary: { brandSystems: 3, componentLanes: 4, visualReceipts: 'Evidence Missing', externalPublishEnabled: false },
    sections: [
      { id: 'brand', title: 'Brand systems + psychology', cards: [
        card({ id: 'vortex-brand', title: 'Vortex / Mission Control brand system', status: 'planned', summary: 'Command-center aesthetic with trust, clarity, proof, and operator calm.', evidence: 'Design language exists in app; formal token audit not complete.', nextAction: 'Collect screenshots and token decisions into receipts.' }),
        card({ id: 'color-language', title: 'Color / language psychology', status: 'read_only', summary: 'Map colors and copy tone to trust, urgency, risk, premium, and proof contexts.', evidence: 'Guidance only; no A/B evidence instrumented.', nextAction: 'Attach marketing/design experiment results when available.' }),
      ]},
      { id: 'qa', title: 'UI QA + visual receipts', cards: [
        card({ id: 'component-status', title: 'Component status board', status: 'planned', summary: 'Track panels/components as Draft, Needs QA, Receipt Captured, Approved.', evidence: 'Manual status only.', nextAction: 'Wire component inventory from repo metadata later.' }),
        card({ id: 'screenshots', title: 'Screenshots / visual receipts', status: 'evidence_missing', summary: 'Collect before/after screenshots and QA notes.', evidence: 'Evidence Missing until screenshots are captured and linked.', nextAction: 'Capture receipts during focused QA pass.' }),
        card({ id: 'decisions', title: 'Design decisions', status: 'read_only', summary: 'Record decision, rationale, alternatives, and owner.', evidence: 'Read-only static decision board.', nextAction: 'Promote decisions into docs after review.' }),
      ]},
    ],
  },
  marketing: {
    id: 'marketing',
    title: 'Marketing Command Center',
    eyebrow: 'Growth OS / approval-gated execution',
    status: 'approval_required',
    safetyMode: 'read_only',
    description: 'Global marketing operating system plus per-project marketing tabs for principles, playbooks, tools, templates, experiments, and project profiles. It prepares drafts and approval requests only; it cannot send, post, spend, mutate campaigns, or fake analytics.',
    guardrails: [
      ...globalGuardrails,
      'No auto-send email/SMS/customer/dealer outreach without explicit approval object.',
      'No social post, marketplace listing, paid ad, campaign setting mutation, or spend without explicit approval/scope.',
      'Missing analytics must say Not Instrumented Yet; campaign status must not imply live results.',
    ],
    summary: { externalActionsApprovalGated: true, analyticsLive: false, projectTabs: 0 },
    sections: [
      { id: 'marketing-placeholder', title: 'Marketing command lanes', cards: [
        card({ id: 'external-action-guard', title: 'External action guard', status: 'approval_required', summary: 'Email, SMS, social, marketplace, ad, and campaign-setting actions are blocked until scoped approval exists.', evidence: 'Guardrail visible in Marketing Command Center snapshot.', nextAction: 'Create approval requests with scope, blast radius, and proof plan before any external action.' }),
      ]},
    ],
  },
  'brain-memory': {
    id: 'brain-memory',
    title: 'Brain / Memory Command',
    eyebrow: 'Memory harmony / read-only',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Usable honest Brain/Memory surface for browsing domains, isolation boundaries, correction requests, and ingestion gates.',
    guardrails: [...globalGuardrails, 'Graphify/gBrain writes forbidden except approved ingestion/correction.'],
    summary: { writeEnabled: false, isolationBoundary: 'David Material Solutions-only', correctionQueue: 'Manual' },
    sections: [
      { id: 'memory', title: 'Memory operating lanes', cards: [
        card({ id: 'browse', title: 'Browse / recall', status: 'read_only', summary: 'Read-only doorway to existing Memory Browser and knowledge receipts.', evidence: 'Existing memory browser available.', nextAction: 'Use Memory Browser for current records.', links: [{ label: 'Existing Memory Browser', href: '/memory' }] }),
        card({ id: 'corrections', title: 'Correction requests', status: 'approval_required', summary: 'Stage memory fixes with source, reason, and approval before write.', evidence: 'No automatic write path here.', nextAction: 'Submit corrections as tasks with evidence.' }),
        card({ id: 'david-isolation', title: 'David / Material Solutions isolation', status: 'blocked', summary: 'David memory must not mix with Vortex/Blackwire internal memory.', evidence: 'Policy boundary shown; enforcement connector not instrumented in this surface.', nextAction: 'Keep Material Solutions notes isolated and labeled.' }),
      ]},
    ],
  },
  'asset-library': {
    id: 'asset-library',
    title: 'Asset Library',
    eyebrow: 'Receipts + reusable assets',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Usable asset index for screenshots, visual receipts, copy blocks, documents, prompts, and proof files. This surface links to existing Office/Documents without inventing inventory.',
    guardrails: [...globalGuardrails, 'Do not claim an asset exists unless it is linked or manually entered with evidence.'],
    summary: { linkedLibraries: 2, unverifiedAssets: 0, publishEnabled: false },
    sections: [
      { id: 'assets', title: 'Asset lanes', cards: [
        card({ id: 'documents', title: 'Receipts & Search', status: 'read_only', summary: 'Existing documents/search panel for files and receipts.', evidence: 'Existing Documents panel linked.', nextAction: 'Use as verified receipt source.', links: [{ label: 'Receipts & Search', href: '/documents' }] }),
        card({ id: 'office-assets', title: 'Office assets', status: 'read_only', summary: 'Existing Office panel for operational assets.', evidence: 'Existing Office panel linked.', nextAction: 'Keep asset claims tied to files.', links: [{ label: 'Office / Assets', href: '/office' }] }),
        card({ id: 'visual-receipts', title: 'Visual receipt shelf', status: 'evidence_missing', summary: 'Screenshots/design receipts are tracked here once captured.', evidence: 'Evidence Missing until screenshots are linked.', nextAction: 'Capture and attach receipts from Design Studio.', links: [{ label: 'Design Studio', href: '/design' }] }),
      ]},
    ],
  },
  'think-tank': {
    id: 'think-tank',
    title: 'Think Tank',
    eyebrow: 'Workspace treasure audit / opportunity mining',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Mission Control idea-mining room for turning buried Axis/OpenClaw/App Factory/Carpathia research into ranked, evidence-backed opportunity cards before any build or promotion.',
    guardrails: [
      ...globalGuardrails,
      'Think Tank is read-only: no automatic task creation, campaign launch, memory write, trading action, customer message, or external send.',
      'Every opportunity must preserve source path, workspace owner, migration class, and evidence before promotion.',
      'OpenClaw/Axis sources are mined as documents only; runtime configs and secrets stay out of Mission Control.',
    ],
    summary: {
      sourceDocsSeeded: 7,
      opportunityCardsSeeded: 12,
      workspacesMapped: 5,
      autoPromotionEnabled: false,
      migrationReady: true,
      axisAuditStatus: 'seeded_not_complete',
    },
    sections: [
      { id: 'seed-sources', title: 'Seed source inventory', status: 'read_only', cards: [
        card({ id: 'source-scout-post', title: 'scout_post.txt — Agentic ecosystem, 50 app ideas', status: 'read_only', owner: 'Axis / Scout', summary: 'OpenClaw workspace source with agentic business/app concepts: Agent Hive Mind, Agent Court, Agent Dashboard, Agent Morning Brief, Agent Superstore, Try-Before-You-Buy, and resale/marketplace patterns.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:1-3, 45-52, 147-150, 301-304', nextAction: 'Parse all 50 ideas into ranked opportunity cards with category, commercial lane, and buildability score.' }),
        card({ id: 'source-mushroom-ideas', title: 'mushroom_ideas.md — Mushroom ecosystem app concepts', status: 'read_only', owner: 'Axis / Scout', summary: 'OpenClaw workspace source for mushroom/cat-daddy app concepts including Strain Savers, Mushroom Twins, Harvest Moon, Supplement Stack, Myco Mentions, Wild Table, and Mushroom Medicine.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/mushroom_ideas.md:152-160, 162-170, 172-190, 216-229', nextAction: 'Cluster cultivation, marketplace, foraging, supplements, and media-monitoring product lanes.' }),
        card({ id: 'source-mushroom-research', title: 'Mushroom_Ecosystem_Research.md', status: 'read_only', owner: 'AxeVault', summary: 'Research layer for market gaps: expert verification, foraged-to-table, supplement tracking, predictive foraging, and cultivation marketplace.', evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/AxeVault/30_PROJECTS/MushroomEcosystem/Mushroom_Ecosystem_Research.md', nextAction: 'Use as evidence/market-gap backing for mushroom opportunity scores.' }),
        card({ id: 'source-dispatch-brainstorm', title: 'BRAINSTORM_APRIL_6.md', status: 'read_only', owner: 'DispatchVault / Strategy', summary: 'Vortex brainstorm source for Warehouse Intelligence Database, 3PL Connect, Social Media Management Agent, Opportunity Engine, App Factory Quality Reset, Forklift Technician App, Marketing Ops Division, and productized LLM knowledge-base service.', evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVDispatchOps/DispatchVault/30_STRATEGY/BRAINSTORM_APRIL_6.md', nextAction: 'Split into Vortex internal tools vs commercial SaaS/app candidates.' }),
        card({ id: 'source-appfactory-mrblanc', title: 'Mr. Blanc / App Factory research', status: 'read_only', owner: 'App Factory', summary: 'App Factory idea research and roster-adjacent concepts for future iOS/app product lanes.', evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/AppFactory/research/2026-04-22-mr-blanc-app-ideas.md and mrblanc-2026-04-21-app-ideas.md', nextAction: 'Extract candidate apps and connect each to App Factory build/readiness gate.' }),
        card({ id: 'source-topic-lookup', title: 'AxeVault TOPIC_LOOKUP.md — Carpathia/Karpathia map', status: 'read_only', owner: 'AxeVault', summary: 'Workspace map that points Mission Control, mushroom ecosystem, and Karpathia/Carpathia references to canonical project folders.', evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/AxeVault/TOPIC_LOOKUP.md:222-224', nextAction: 'Use as routing map for deeper Axis workspace audit without relying on fuzzy memory.' }),
      ]},
      { id: 'opportunity-cards', title: 'First ranked opportunity cards', status: 'read_only', cards: [
        card({ id: 'opp-agent-dashboard', title: 'Agent Dashboard / Mission Control for owned agents', status: 'read_only', owner: 'Mission Control / Axis', summary: 'Every agent on one screen: status, tasks, mood/energy, receipts, and operator intervention gates. Directly reinforces Mission Control daily-driver value.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:147-150', nextAction: 'Merge with existing Group Chat, Agents, Tasks, and receipts panels; score as high-priority internal-to-commercial bridge.', details: [{ label: 'Commercial potential', value: 'High: agent fleet control plane / daily-driver OS', status: 'read_only' }, { label: 'Buildability', value: 'High: existing Mission Control panels already provide primitives', status: 'read_only' }] }),
        card({ id: 'opp-agent-morning-brief', title: 'Agent Morning Brief', status: 'read_only', owner: 'Mission Control', summary: 'Agent-generated overnight and morning digest before Chris wakes up; fits quiet-hours and batch-update operating style.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:301-304', nextAction: 'Tie into receipts, cron output, and operator approval rules before enabling sends.', details: [{ label: 'Guardrail', value: 'One morning batch unless true blocker/approval/major milestone.', status: 'approval_required' }] }),
        card({ id: 'opp-agent-hive-mind', title: 'Agent Hive Mind', status: 'read_only', owner: 'Axis / OpenClaw', summary: 'Shared multi-agent coordination layer: ideas, roles, status, evidence, and bounded collaboration without cross-runtime secret bleed.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:45-52', nextAction: 'Model as read-only graph/map first; require tenant/runtime isolation before any shared memory write.' }),
        card({ id: 'opp-agent-court', title: 'Agent Court', status: 'read_only', owner: 'Mission Control / Safety', summary: 'Structured dispute/review system for conflicting agent outputs, false-green claims, and promotion decisions.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:36-43', nextAction: 'Prototype as approval/review workflow backed by receipts and audit logs.' }),
        card({ id: 'opp-agent-superstore', title: 'Agent Superstore / Agent Try-Before-You-Buy', status: 'read_only', owner: 'App Factory', summary: 'Marketplace and demo pattern for packaged agents, skills, workflows, and app/service bundles.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/scout_post.txt:103-120', nextAction: 'Separate commercial marketplace concept from internal skill catalog; score regulatory/trust boundaries.' }),
        card({ id: 'opp-strain-savers', title: 'Strain Savers', status: 'read_only', owner: 'Mushroom Ecosystem', summary: 'Personal mushroom strain library with inventory tracker, profile cards, availability/trade sharing, and preservation alerts.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/mushroom_ideas.md:152-160', nextAction: 'Validate against Mushroom Ecosystem research gaps and App Factory iOS readiness.' }),
        card({ id: 'opp-mushroom-twins', title: 'Mushroom Twins', status: 'read_only', owner: 'Mushroom Ecosystem', summary: 'Twin/clone concept for mushroom cultivation tracking, genetics, harvest comparison, and experiment records.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/mushroom_ideas.md:162-170', nextAction: 'Cluster with Strain Savers as cultivator notebook / genetics module.' }),
        card({ id: 'opp-supplement-stack', title: 'Supplement Stack', status: 'read_only', owner: 'Mushroom Ecosystem', summary: 'Functional mushroom supplement tracker that links effects, stacks, brands, dosage, and research-backed claims.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/mushroom_ideas.md:182-190', nextAction: 'Require medical-claim disclaimer and citation gate before commercial packaging.' }),
        card({ id: 'opp-wild-table', title: 'Wild Table', status: 'read_only', owner: 'Mushroom Ecosystem', summary: 'Foraged-to-table discovery/cooking/market concept connected to expert verification and local availability.', evidence: '/Users/vortexventures/.openclaw/workspace/docs/mushroom_ideas.md:216-224', nextAction: 'Pair with expert verification and safety gate; no edible claim without source authority.' }),
      ]},
      { id: 'audit-pipeline', title: 'Axis workspace treasure-audit pipeline', status: 'planned', cards: [
        card({ id: 'audit-pass-1', title: 'Pass 1 — Known high-signal docs', status: 'read_only', owner: 'Herm', summary: 'Seeded exact files Chris called out plus Dispatch/AxeVault/AppFactory documents already discovered.', evidence: 'This surface registry; no full every-file audit claimed yet.', nextAction: 'Generate a manifest of source path, owner workspace, project lane, idea count, extraction status, migration class, and proof line ranges.' }),
        card({ id: 'audit-pass-2', title: 'Pass 2 — Every-file Axis/OpenClaw audit', status: 'planned', owner: 'Axis workspace audit', summary: 'Crawl allowed document roots only; ignore secrets/configs/runtime state; classify valuable concepts and stale/noise separately.', evidence: 'Planned gate; not run in this slice.', nextAction: 'Implement bounded local scanner for .md/.txt/.json notes under approved docs/research roots.' }),
        card({ id: 'migration-packaging', title: 'Mac Studio migration-ready inventory', status: 'read_only', owner: 'Mission Control', summary: 'Each Think Tank record must carry canonical path, owner/workspace, dependencies, env/secrets boundary, regenerate command if any, verification proof, and absolute-path assumptions.', evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Strategy/MAC_STUDIO_MIGRATION_PACKAGING_STANDARD_2026-05-05.md', nextAction: 'Export Think Tank manifest to a durable package before cluster migration.' }),
      ]},
    ],
  },
  brainstorm: {
    id: 'brainstorm',
    title: 'Brainstorm Wall',
    eyebrow: 'Idea intake / safe staging',
    status: 'read_only',
    safetyMode: 'read_only',
    description: 'Usable idea wall for raw ideas, prompts, hypotheses, parking lot, and promotion gates into research/actions. Read-only shell; no automatic external action.',
    guardrails: [...globalGuardrails, 'Brainstorm items are unverified until moved through Research Command Center with evidence.'],
    summary: { lanes: 5, autoPromotionEnabled: false, verificationRequired: true },
    sections: [
      { id: 'lanes', title: 'Brainstorm lanes', cards: [
        card({ id: 'raw-ideas', title: 'Raw ideas', status: 'read_only', summary: 'Capture concepts without implying truth or priority.', evidence: 'Manual/static lane.', nextAction: 'Move promising ideas into research queue.' }),
        card({ id: 'hypotheses', title: 'Hypotheses', status: 'evidence_missing', summary: 'Frame testable claims with success metric and required evidence.', evidence: 'Evidence Missing until citations/receipts are attached.', nextAction: 'Send to Research Command Center.', links: [{ label: 'Research Command Center', href: '/research-command' }] }),
        card({ id: 'parking-lot', title: 'Parking lot', status: 'planned', summary: 'Hold not-now ideas without losing context.', evidence: 'Manual/static lane.', nextAction: 'Review weekly.' }),
        card({ id: 'promotion-gate', title: 'Promotion gate', status: 'approval_required', summary: 'Promotion to task, campaign, design, trade, or memory requires evidence and approvals.', evidence: 'Gate policy visible; automation not instrumented.', nextAction: 'Create a scoped task/approval with receipts.' }),
      ]},
    ],
  },
}

export function getMissionControlSurfaceSnapshot(id: string): MissionControlSurfaceSnapshot | null {
  const snapshot = snapshots[id]
  if (!snapshot) return null
  if (id === 'security-command') {
    const security = getSecurityCommandSnapshot()
    const securitySystems = security.systems || []
    const securityFindings = security.findings || []
    const securityAuditHooks = security.auditHooks || []
    return {
      ...snapshot,
      generatedAt: security.generatedAt,
      summary: {
        ...snapshot.summary,
        systemsTracked: security.posture.systems,
        openFindings: security.posture.openFindings,
        criticalFindings: security.posture.severityCounts.critical || 0,
        highFindings: security.posture.severityCounts.high || 0,
        auditHooks: security.posture.auditHooks,
        notInstrumentedHooks: security.posture.notInstrumentedHooks,
        evidenceMissingHooks: security.posture.evidenceMissingHooks,
        approvalRequiredHooks: security.posture.approvalRequiredHooks,
        posture: security.posture.label === 'green' && security.posture.openFindings > 0 ? 'watch' : security.posture.label,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...security.guardrails])),
      sections: [
        {
          id: 'live-systems',
          title: 'DB-backed security systems',
          status: security.posture.label === 'green' ? 'read_only' : 'evidence_missing',
          cards: securitySystems.map((system) => card({
            id: `system-${system.system_key}`,
            title: system.label,
            status: system.posture === 'green' ? 'read_only' : system.posture === 'watch' ? 'evidence_missing' : system.posture,
            owner: system.owner_agent_id,
            summary: `${system.open_findings} open finding(s); ${system.critical_findings} critical / ${system.high_findings} high.`,
            evidence: system.evidence_path || 'Evidence Missing: no receipt linked.',
            nextAction: system.next_action,
            details: system.details,
          })),
        },

        {
          id: 'audit-hook-inventory',
          title: 'Daily / periodic audit hook inventory',
          status: security.posture.notInstrumentedHooks > 0 || security.posture.evidenceMissingHooks > 0 ? 'evidence_missing' : 'read_only',
          cards: securityAuditHooks.map((hook) => card({
            id: `security-hook-${hook.id}`,
            title: hook.title,
            status: hook.status,
            owner: 'Knox / Security',
            summary: `${hook.cadence.replace(/_/g, ' ')} hook triggered by ${hook.trigger}.`,
            evidence: hook.evidence,
            nextAction: hook.nextAction,
            details: hook.details,
          })),
        },
        {
          id: 'live-findings',
          title: 'Open findings / hooks',
          status: security.posture.openFindings > 0 ? 'evidence_missing' : 'read_only',
          cards: securityFindings.map((finding) => card({
            id: `finding-${finding.id}`,
            title: finding.title,
            status: finding.status === 'resolved' ? 'read_only' : finding.status === 'needs_verification' ? 'evidence_missing' : finding.status === 'triage' ? 'planned' : 'blocked',
            owner: finding.owner_agent_id,
            summary: `${finding.severity.toUpperCase()} / ${finding.status.replace(/_/g, ' ')} on ${finding.system_key}.`,
            evidence: finding.evidence_path || 'Evidence Missing: no receipt linked.',
            nextAction: finding.next_action,
            details: finding.details,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'research-command') {
    const research = getResearchCommandSnapshot()
    const researchNextAction = research.summary.evidenceMissing > 0
      ? 'Attach source/citation receipts to evidence-missing briefs before any promotion.'
      : research.summary.approvalRequired > 0
        ? 'Review approval-required simulation or promotion briefs with explicit scope and spend/account boundaries.'
        : 'Use researched briefs as read-only support; keep external/paid/memory actions approval-gated.'
    return {
      ...snapshot,
      generatedAt: research.generatedAt,
      summary: {
        ...snapshot.summary,
        ...research.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...research.guardrails])),
      sections: [
        {
          id: 'daily-research-triage',
          title: 'Daily research triage',
          status: research.summary.evidenceMissing > 0 ? 'evidence_missing' : research.summary.approvalRequired > 0 ? 'approval_required' : 'read_only',
          cards: [
            card({
              id: 'research-evidence-gaps',
              title: 'Evidence gaps',
              status: research.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
              owner: 'Atlas',
              summary: `${research.summary.evidenceMissing} briefs still need source, citation, or simulation receipts before they can support action.`,
              evidence: `${research.summary.citationReceiptsAttached} citation receipts attached across ${research.summary.totalBriefs} briefs.`,
              nextAction: researchNextAction,
              details: [
                { label: 'Citation receipt coverage', value: `${research.summary.citationReceiptsAttached}/${research.summary.totalBriefs} briefs have evidence paths.`, status: research.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only' },
                { label: 'Promotion gates visible', value: research.summary.promotionGatesVisible ? 'Every DB-backed brief exposes a promotion gate.' : 'Promotion gate visibility is incomplete.', status: research.summary.promotionGatesVisible ? 'read_only' : 'blocked' },
              ],
            }),
            card({
              id: 'research-approval-queue',
              title: 'Approval queue',
              status: research.summary.approvalRequired > 0 || research.summary.paidSimulationApprovalRequired ? 'approval_required' : 'read_only',
              owner: 'MiroFish / Chris',
              summary: `${research.summary.approvalRequired} briefs explicitly require approval; paid simulation approval remains ${research.summary.paidSimulationApprovalRequired ? 'required' : 'not required'}.`,
              evidence: `approvalBlockedBriefs=${research.summary.approvalBlockedBriefs}; paidSimulationApprovalRequired=${research.summary.paidSimulationApprovalRequired ? 'true' : 'false'}.`,
              nextAction: 'Prepare scoped approval packets before any paid simulation, external compute spend, or account-affecting promotion.',
              details: [
                { label: 'Paid simulation gate', value: 'MiroFish simulation runs are brief-only until Chris approves spend and scope.', status: 'approval_required' },
                { label: 'Auto-promotion gate', value: `autoPromotionEnabled=${research.summary.autoPromotionEnabled ? 'true' : 'false'}.`, status: research.summary.autoPromotionEnabled ? 'blocked' : 'read_only' },
              ],
            }),
            card({
              id: 'research-instrumentation-boundary',
              title: 'Instrumentation boundary',
              status: research.summary.karpathiaConnectorInstrumented ? 'read_only' : 'not_instrumented',
              owner: 'Karpathia',
              summary: `Karpathia connector instrumented: ${research.summary.karpathiaConnectorInstrumented ? 'yes' : 'no'}; not-instrumented lanes visible: ${research.summary.notInstrumentedLanes}.`,
              evidence: 'No autonomous external research connector receipt is attached in this MVP slice.',
              nextAction: 'Keep Karpathia as source-planning/read-only orchestration until connector receipts exist.',
              details: [
                { label: 'Connector truth', value: 'Not Instrumented Yet means no live autonomous fetch is claimed.', status: research.summary.karpathiaConnectorInstrumented ? 'read_only' : 'not_instrumented' },
                { label: 'External action boundary', value: 'No tasks, marketing sends, trades, or Graphify/gBrain writes can be promoted without evidence plus scoped approval.', status: 'approval_required' },
              ],
            }),
          ],
        },
        {
          id: 'db-backed-research-briefs',
          title: 'DB-backed research briefs',
          status: research.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: research.briefs.map((brief) => card({
            id: `research-${brief.research_key}`,
            title: brief.title,
            status: brief.status === 'researched' ? 'read_only' : brief.status === 'draft' ? 'planned' : brief.status,
            owner: brief.owner_agent,
            summary: `${brief.lane.replace(/_/g, ' ')} brief owned by ${brief.owner_agent}. ${brief.readinessGate}`,
            evidence: brief.evidence_path || 'Evidence Missing: no source/citation/simulation receipt attached.',
            nextAction: brief.next_action,
            details: brief.details,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'trading') {
    const trading = getTradingOperationsSnapshot()
    const tradingNextAction = trading.summary.blockedItems > 0
      ? 'Keep execution blocked; use watchlist and risk cards as read-only research until explicit approval and external receipts exist.'
      : trading.summary.evidenceMissing > 0
        ? 'Attach timestamped market sources, research citations, risk notes, or ledger receipts before treating signals as actionable.'
        : 'Continue read-only monitoring; real trading still requires scoped approval and an external execution receipt.'
    return {
      ...snapshot,
      generatedAt: trading.generatedAt,
      summary: {
        ...snapshot.summary,
        ...trading.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...trading.guardrails])),
      sections: [
        {
          id: 'trading-readiness-triage',
          title: 'Trading readiness triage',
          status: trading.summary.executionEnabled || trading.summary.walletMutationEnabled ? 'blocked' : trading.summary.blockedItems > 0 ? 'blocked' : trading.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: [
            card({
              id: 'trading-market-evidence',
              title: 'Market evidence coverage',
              status: trading.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
              owner: 'Herald / Atlas',
              summary: `${trading.summary.sourceReceiptsLinked} source receipts linked across ${trading.summary.totalWatchItems} watch items; ${trading.summary.evidenceMissing} items still need evidence.`,
              evidence: `detailGatesVisible=${trading.summary.detailGatesVisible}; connectorInstrumented=${trading.summary.connectorInstrumented ? 'true' : 'false'}.`,
              nextAction: tradingNextAction,
              details: [
                { label: 'Connector truth', value: 'No live market connector, quote feed, order book, or paid data source is claimed unless instrumented with receipts.', status: trading.summary.connectorInstrumented ? 'read_only' : 'not_instrumented' },
                { label: 'Research promotion gate', value: 'Signals need timestamped sources plus Research Command/MiroFish receipts before review.', status: 'approval_required' },
              ],
            }),
            card({
              id: 'trading-execution-boundary',
              title: 'Execution boundary',
              status: trading.summary.executionEnabled || trading.summary.walletMutationEnabled ? 'blocked' : 'read_only',
              owner: 'Knox / Ledger',
              summary: `executionEnabled=${trading.summary.executionEnabled ? 'true' : 'false'}; walletMutationEnabled=${trading.summary.walletMutationEnabled ? 'true' : 'false'}; approvalRequiredForTrades=${trading.summary.approvalRequiredForTrades ? 'true' : 'false'}.`,
              evidence: `livePositionsImported=${trading.summary.livePositionsImported ? 'true' : 'false'}; fillsImported=${trading.summary.fillsImported ? 'true' : 'false'}; pnlImported=${trading.summary.pnlImported ? 'true' : 'false'}; ledgerReceiptsLinked=${trading.summary.ledgerReceiptsLinked}.`,
              nextAction: 'No orders, cancellations, wallet actions, positions, fills, P&L, or account-affecting changes from Mission Control.',
              details: [
                { label: 'No fake performance', value: 'Positions, fills, P&L, bankroll, hit rate, and drawdown remain Evidence Missing unless imported from verified receipts.', status: 'blocked' },
                { label: 'Approval object requirement', value: 'Any real trade needs Chris approval with venue, order, size, slippage/spread guard, stop plan, and execution receipt path.', status: 'approval_required' },
              ],
            }),
          ],
        },
        {
          id: 'db-backed-trading-watch-items',
          title: 'DB-backed trading watchlist / signals / risk gates',
          status: trading.summary.blockedItems > 0 ? 'blocked' : trading.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: trading.watchItems.map((item) => card({
            id: `trading-${item.item_key}`,
            title: item.title,
            status: item.status === 'watching' || item.status === 'researched' ? 'read_only' : item.status,
            owner: item.owner_agent,
            summary: `${item.lane.replace(/_/g, ' ')} lane for ${item.owner_agent}; ${item.next_action}`,
            evidence: item.evidence_path || item.market_url || 'Evidence Missing: no timestamped market URL, source citation, approval, or ledger receipt attached.',
            nextAction: item.next_action,
            details: item.details || tradingSurfaceDetails(item.lane),
            links: item.market_url ? [{ label: 'Market source', href: item.market_url }] : undefined,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'design') {
    const design = getDesignStudioSnapshot()
    const designNextAction = design.summary.evidenceMissing > 0
      ? 'Capture browser proof or screenshot receipts before claiming visual QA is complete.'
      : design.summary.blockedDesignItems > 0
        ? 'Resolve blocked design items before any external publish or customer-facing mutation.'
        : 'Use receipt-backed design items as read-only QA baselines; keep deploy/publish authority approval-gated.'
    return {
      ...snapshot,
      generatedAt: design.generatedAt,
      summary: {
        ...snapshot.summary,
        ...design.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...design.guardrails])),
      sections: [
        {
          id: 'visual-receipt-triage',
          title: 'Visual receipt triage',
          status: design.summary.evidenceMissing > 0 ? 'evidence_missing' : design.summary.blockedDesignItems > 0 ? 'blocked' : 'read_only',
          cards: [
            card({
              id: 'design-visual-qa-coverage',
              title: 'Visual QA coverage',
              status: design.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
              owner: 'Design / QA',
              summary: `${design.summary.visualReceiptsLinked} visual receipts linked across ${design.summary.totalDesignItems} design items.`,
              evidence: `${design.summary.evidenceMissing} items are Evidence Missing; visualQaProven=${design.summary.visualQaProven ? 'true' : 'false'}.`,
              nextAction: designNextAction,
              details: [
                { label: 'QA gates visible', value: `${design.summary.qaGatesVisible} visual QA gates are visible.`, status: design.summary.qaGatesVisible >= design.summary.totalDesignItems ? 'read_only' : 'evidence_missing' },
                { label: 'Design receipts linked', value: `${design.summary.designReceiptsLinked} design decision/receipt paths are linked.`, status: design.summary.designReceiptsLinked > 0 ? 'read_only' : 'evidence_missing' },
              ],
            }),
            card({
              id: 'design-authority-boundary',
              title: 'Authority boundary',
              status: design.summary.externalPublishEnabled || design.summary.patchRuntimeAuthority ? 'blocked' : 'read_only',
              owner: 'Knox / Patch',
              summary: `externalPublishEnabled=${design.summary.externalPublishEnabled ? 'true' : 'false'}; patchRuntimeAuthority=${design.summary.patchRuntimeAuthority ? 'true' : 'false'}.`,
              evidence: `${design.summary.blockedDesignItems} blocked design items; ${design.summary.approvalRequiredItems} items explicitly require approval.`,
              nextAction: 'Keep Design Studio as read-only QA/planning unless Chris scopes deploy, publish, env, customer-facing, or memory-write authority.',
              details: [
                { label: 'Allowed use', value: 'Internal screenshots, QA receipts, component status, brand decisions, and design planning.', status: 'read_only' },
                { label: 'Blocked authority', value: 'No deploy, env mutation, external publish, customer-facing change, trading action, or Graphify/gBrain write from this surface.', status: 'blocked' },
              ],
            }),
          ],
        },
        {
          id: 'db-backed-design-items',
          title: 'DB-backed design inventory / visual receipt gates',
          status: design.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: design.items.map((item) => card({
            id: `design-${item.item_key}`,
            title: item.title,
            status: item.status === 'receipt_backed' || item.status === 'qa_ready' ? 'read_only' : item.status,
            owner: item.owner_agent,
            summary: `${item.lane.replace(/_/g, ' ')} item owned by ${item.owner_agent}.`,
            evidence: item.evidence_path || item.screenshot_path || 'Evidence Missing: no screenshot, browser proof, decision receipt, or design QA receipt attached.',
            nextAction: item.next_action,
            details: item.details,
            links: item.screenshot_path ? [{ label: 'Visual receipt', href: item.screenshot_path }] : undefined,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'marketing') {
    const marketing = getMarketingCommandCenterSnapshot()
    const marketingNextAction = marketing.summary.publicLaunchBlocked
      ? 'Keep marketing internal/draft-only until Security Command Center evidence and explicit approval clear the launch gate.'
      : marketing.summary.projectsWithEvidenceMissing > 0
        ? 'Attach proof receipts and analytics source notes before requesting external-action approval.'
        : 'Prepare scoped approval packets before any send, post, listing, campaign mutation, or spend.'
    return {
      ...snapshot,
      generatedAt: marketing.generatedAt,
      summary: {
        ...snapshot.summary,
        ...marketing.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...marketing.externalActionGuardrails])),
      sections: [
        {
          id: 'daily-marketing-triage',
          title: 'Daily marketing triage',
          status: marketing.summary.publicLaunchBlocked ? 'blocked' : 'approval_required',
          cards: [
            card({
              id: 'marketing-draft-readiness',
              title: 'Draft readiness',
              status: marketing.summary.projectsWithEvidenceMissing > 0 ? 'evidence_missing' : 'planned',
              owner: 'Growth / Chris',
              summary: `${marketing.summary.safeDraftsReady} safe internal drafts across ${marketing.summary.projectProfiles} project profiles; ${marketing.summary.projectsWithEvidenceMissing} projects still need proof or instrumentation.`,
              evidence: `${marketing.summary.projectTabCount} project tabs; analytics live is not implied by draft readiness.`,
              nextAction: marketingNextAction,
              details: [
                { label: 'Proof gate', value: 'Public copy must lag product proof, screenshots, route receipts, analytics, or approved operator notes.', status: marketing.summary.projectsWithEvidenceMissing > 0 ? 'evidence_missing' : 'read_only' },
                { label: 'Analytics gate', value: 'Missing analytics must remain Not Instrumented Yet; do not show fake campaign results.', status: 'not_instrumented' },
              ],
            }),
            card({
              id: 'marketing-external-action-boundary',
              title: 'External action boundary',
              status: marketing.summary.externalActionsApprovalGated ? 'approval_required' : 'blocked',
              owner: 'Knox / Growth',
              summary: 'Email, SMS, social, marketplace, ad, and campaign-setting actions remain approval-gated.',
              evidence: `publicLaunchBlocked=${marketing.summary.publicLaunchBlocked ? 'true' : 'false'}; securityOpenFindings=${marketing.summary.securityOpenFindings}; securityCriticalFindings=${marketing.summary.securityCriticalFindings}.`,
              nextAction: 'Create an approval packet with channel, audience, spend/send/post scope, blast radius, proof plan, and rollback/stop plan.',
              details: [
                { label: 'Allowed use', value: 'Internal drafting, research, offer/ICP work, experiment cards, and approval-packet preparation.', status: 'read_only' },
                { label: 'Blocked without approval', value: 'No external send, post, marketplace listing, paid campaign, spend, or campaign-setting mutation.', status: 'approval_required' },
              ],
            }),
          ],
        },
        {
          id: 'security-launch-gate',
          title: 'Security Command Center launch gate',
          status: marketing.launchSecurityGate.status === 'blocked' ? 'blocked' : marketing.launchSecurityGate.status === 'not_instrumented' ? 'not_instrumented' : marketing.launchSecurityGate.status === 'approval_required' ? 'approval_required' : 'read_only',
          cards: [card({
            id: marketing.launchSecurityGate.id,
            title: marketing.launchSecurityGate.title,
            status: marketing.launchSecurityGate.status === 'blocked' ? 'blocked' : marketing.launchSecurityGate.status === 'not_instrumented' ? 'not_instrumented' : marketing.launchSecurityGate.status === 'approval_required' ? 'approval_required' : 'read_only',
            owner: 'Knox / Growth',
            summary: marketing.launchSecurityGate.reason,
            evidence: marketing.launchSecurityGate.evidence,
            nextAction: marketing.launchSecurityGate.nextAction,
            links: [{ label: 'Security Command Center', href: '/security-command' }],
          })],
        },
        {
          id: 'principles',
          title: 'Psychology / persuasion library',
          cards: marketing.principles.map((principle) => card({
            id: principle.id,
            title: principle.title,
            status: principle.status === 'live' ? 'read_only' : principle.status,
            summary: principle.guidance,
            evidence: `Ethical boundary: ${principle.ethicalBoundary}`,
            nextAction: 'Use as a draft/planning aid only until campaign evidence exists.',
          })),
        },
        {
          id: 'playbooks-tools',
          title: 'Playbooks, tools, and instrumentation',
          cards: [
            ...marketing.playbooks.map((playbook) => card({
              id: playbook.id,
              title: playbook.channel,
              status: playbook.status === 'live' ? 'read_only' : playbook.status,
              summary: playbook.goal,
              evidence: playbook.guardrail,
              nextAction: playbook.nextAction,
            })),
            ...marketing.tools.map((tool) => card({
              id: tool.id,
              title: tool.name,
              status: tool.id === 'analytics-sources' ? 'not_instrumented' : tool.status === 'installed' || tool.status === 'staged' || tool.status === 'approved' ? 'read_only' : tool.status === 'blocked' ? 'blocked' : 'not_instrumented',
              summary: `${tool.category}: ${tool.status.replace(/_/g, ' ')}`,
              evidence: tool.safetyNote,
              nextAction: tool.id === 'analytics-sources' ? 'Instrument analytics before showing live charts.' : 'Use only within internal drafting/research scope.',
            })),
          ],
        },
        {
          id: 'project-tabs',
          title: 'Per-project Marketing tabs',
          cards: marketing.projectProfiles.map((profile) => card({
            id: profile.id,
            title: profile.project,
            status: profile.analyticsStatus === 'Not Instrumented Yet' ? 'not_instrumented' : profile.status === 'live' ? 'read_only' : profile.status,
            summary: `${profile.offer} — ${profile.audience}; proof: ${profile.proofStatus}; safe drafts: ${profile.safeDraftsReady}.`,
            evidence: `Analytics: ${profile.analyticsStatus}; approvals required: ${profile.approvalsRequired.join(', ') || 'none listed'}`,
            nextAction: profile.nextAction,
          })),
        },
        {
          id: 'project-tab-details',
          title: 'Per-project tab details / proof gates',
          cards: marketing.projectProfiles.flatMap((profile) => profile.tabs.map((tab) => card({
            id: `${profile.id}-${tab.id}`,
            title: `${profile.project}: ${tab.label}`,
            status: tab.status === 'live' ? 'read_only' : tab.status,
            summary: tab.detail,
            evidence: tab.evidence,
            nextAction: profile.nextAction,
          }))),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'brain-memory') {
    const brainMemory = getBrainMemorySnapshot()
    return {
      ...snapshot,
      generatedAt: brainMemory.generatedAt,
      summary: {
        ...snapshot.summary,
        ...brainMemory.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...brainMemory.guardrails])),
      sections: [
        {
          id: 'db-backed-memory-layers',
          title: 'DB-backed memory layers',
          status: brainMemory.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: brainMemory.layers.map((layer) => card({
            id: `memory-layer-${layer.layer_key}`,
            title: layer.label,
            status: layer.status === 'isolated' ? 'blocked' : layer.status === 'runtime_backed' || layer.status === 'operationally_adopted' || layer.status === 'queried_manually' ? 'read_only' : layer.status === 'present_only' || layer.status === 'refreshing' ? 'planned' : layer.status,
            owner: layer.domain,
            summary: `${layer.layer_type.replace(/_/g, ' ')} layer for ${layer.domain}; runtime adoption: ${layer.runtime_adoption.replace(/_/g, ' ')}.`,
            evidence: layer.evidence_path || 'Evidence Missing: no storage, freshness, read-path, or runtime-adoption receipt linked.',
            nextAction: layer.next_action,
            details: layer.details,
          })),
        },
        {
          id: 'db-backed-memory-corrections',
          title: 'Correction requests / write gate',
          status: brainMemory.correctionRequests.length > 0 ? 'approval_required' : 'read_only',
          cards: brainMemory.correctionRequests.map((request) => card({
            id: `memory-correction-${request.request_key}`,
            title: request.title,
            status: request.status === 'applied' ? 'read_only' : request.status === 'rejected' || request.status === 'blocked' ? 'blocked' : 'approval_required',
            owner: request.domain,
            summary: request.requested_change,
            evidence: request.evidence_path || 'Evidence Missing: correction cannot be applied without evidence.',
            nextAction: request.next_action,
            details: request.details,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'asset-library') {
    const assetLibrary = getAssetLibrarySnapshot()
    const assetNextAction = assetLibrary.summary.evidenceMissing > 0
      ? 'Attach source files, receipt paths, screenshots, or source URLs before treating assets as verified.'
      : assetLibrary.summary.blockedAssets > 0
        ? 'Resolve blocked assets with a receipt and scoped approval before promotion.'
        : 'Use verified assets as read-only references; keep external publishing approval-gated.'
    return {
      ...snapshot,
      generatedAt: assetLibrary.generatedAt,
      summary: {
        ...snapshot.summary,
        ...assetLibrary.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...assetLibrary.guardrails])),
      sections: [
        {
          id: 'asset-readiness-triage',
          title: 'Asset readiness triage',
          status: assetLibrary.summary.evidenceMissing > 0 ? 'evidence_missing' : assetLibrary.summary.blockedAssets > 0 ? 'blocked' : 'read_only',
          cards: [
            card({
              id: 'asset-receipt-coverage',
              title: 'Receipt coverage',
              status: assetLibrary.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
              owner: 'Ledger / Design',
              summary: `${assetLibrary.summary.sourceReceiptsLinked} of ${assetLibrary.summary.totalAssets} assets have a linked source, receipt, screenshot, or URL.`,
              evidence: `${assetLibrary.summary.evidenceMissing} assets are Evidence Missing; ${assetLibrary.summary.verifiedAssets} are verified read-only references.`,
              nextAction: assetNextAction,
              details: [
                { label: 'Promotion gates visible', value: `${assetLibrary.summary.promotionGatesVisible} asset promotion boundaries are visible.`, status: assetLibrary.summary.promotionGatesVisible >= assetLibrary.summary.totalAssets ? 'read_only' : 'evidence_missing' },
                { label: 'Verification boundary', value: 'Assets without evidence_path or source_url stay Evidence Missing and must not be presented as verified inventory.', status: 'evidence_missing' },
              ],
            }),
            card({
              id: 'asset-publish-boundary',
              title: 'External publish boundary',
              status: assetLibrary.summary.externalPublishEnabled ? 'blocked' : 'read_only',
              owner: 'Knox',
              summary: `External publishing enabled: ${assetLibrary.summary.externalPublishEnabled ? 'yes' : 'no'}. Asset Library is internal reference only.`,
              evidence: `blockedAssets=${assetLibrary.summary.blockedAssets}; externalPublishEnabled=${assetLibrary.summary.externalPublishEnabled ? 'true' : 'false'}.`,
              nextAction: 'Require scoped approval before any campaign, design publish, customer-facing use, spend, trade, or memory write.',
              details: [
                { label: 'Allowed use', value: 'Read-only asset lookup, receipt review, and internal planning.', status: 'read_only' },
                { label: 'Blocked use', value: 'No external post, send, spend, deploy, trade, or Graphify/gBrain write from this surface.', status: assetLibrary.summary.externalPublishEnabled ? 'blocked' : 'approval_required' },
              ],
            }),
          ],
        },
        {
          id: 'db-backed-assets',
          title: 'DB-backed asset inventory',
          status: assetLibrary.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: assetLibrary.assets.map((asset) => card({
            id: `asset-${asset.asset_key}`,
            title: asset.title,
            status: asset.status === 'verified' ? 'read_only' : asset.status === 'draft' ? 'planned' : asset.status,
            owner: asset.owner_project,
            summary: `${asset.asset_type} asset for ${asset.owner_project}.`,
            evidence: asset.evidence_path || asset.source_url || 'Evidence Missing: no source file, receipt, or URL attached.',
            nextAction: asset.next_action,
            details: asset.details,
            links: asset.source_url ? [{ label: 'Source', href: asset.source_url }] : undefined,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  if (id === 'brainstorm') {
    const brainstorm = getBrainstormSnapshot()
    return {
      ...snapshot,
      generatedAt: brainstorm.generatedAt,
      summary: {
        ...snapshot.summary,
        ...brainstorm.summary,
      },
      guardrails: Array.from(new Set([...snapshot.guardrails, ...brainstorm.guardrails])),
      sections: [
        {
          id: 'db-backed-ideas',
          title: 'DB-backed idea wall',
          status: brainstorm.summary.evidenceMissing > 0 ? 'evidence_missing' : 'read_only',
          cards: brainstorm.ideas.map((idea) => card({
            id: `idea-${idea.idea_key}`,
            title: idea.title,
            status: idea.status === 'researched' || idea.status === 'approved_for_promotion' ? 'read_only' : idea.status === 'draft' ? 'planned' : idea.status,
            owner: idea.owner_project,
            summary: `${idea.lane.replace(/_/g, ' ')} idea for ${idea.owner_project}.`,
            evidence: idea.evidence_path || 'Evidence Missing: no research receipt or source attached.',
            nextAction: idea.next_action,
            details: idea.details,
          })),
        },
        ...snapshot.sections,
      ],
    }
  }
  return { ...snapshot, generatedAt: Date.now() }
}

export function getMissionControlSurfaceIndex() {
  return Object.values(snapshots).map(({ id, title, eyebrow, status, description }) => ({ id, title, eyebrow, status, description }))
}
