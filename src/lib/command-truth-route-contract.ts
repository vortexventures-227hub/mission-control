import { getMissionControlMvpSnapshot } from './mission-control-mvp'

export interface CommandTruthRouteContractEntry {
  id: string
  path: string
  surface: string
  status: 'live' | 'read_only' | 'alias' | 'evidence_missing'
  requirement: string
  evidence: string
  noFakeGreenBoundary: string
}

export function getCommandTruthRouteContract(workspaceId = 1) {
  const snapshot = getMissionControlMvpSnapshot(workspaceId)
  const blackwireRoomGate = snapshot.blackwireDoneGates.find((gate) => gate.id === 'room-source-of-truth')
  const assignmentGate = snapshot.blackwireDoneGates.find((gate) => gate.id === 'assignment-board-evidence')
  const receiptGate = snapshot.blackwireDoneGates.find((gate) => gate.id === 'approval-receipt-gate')

  const routes: CommandTruthRouteContractEntry[] = [
    {
      id: 'command-truth-routes-tab',
      path: '/command-truth?tab=routes',
      surface: 'Command Truth route contract',
      status: 'live',
      requirement: 'Runbook must expose the route contract as a first-class product surface.',
      evidence: `${snapshot.surfaces.length} MVP surfaces and ${snapshot.blackwireDoneGates.length} Blackwire gates loaded from the local Mission Control dataset.`,
      noFakeGreenBoundary: 'Readiness rows still carry Evidence Missing / Not Instrumented Yet / Approval Required labels when data is absent.',
    },
    {
      id: 'blackwire-room-alias',
      path: '/rooms/blackwire-ops',
      surface: 'Blackwire Ops room alias',
      status: blackwireRoomGate?.status === 'evidence_missing' ? 'evidence_missing' : 'alias',
      requirement: 'Runbook room URL must land on the actual Blackwire group-chat room, not a generic fallback shell.',
      evidence: blackwireRoomGate?.detail || 'Evidence Missing: Blackwire room gate was not present in Command Truth snapshot.',
      noFakeGreenBoundary: 'Local room delivery states are local MVP proof only; no external Telegram/agent send is claimed.',
    },
    {
      id: 'neon-forge-tracker-alias',
      path: '/tracker?agent=neon-forge',
      surface: 'Assignment tracker alias filtered to Neon Forge',
      status: assignmentGate?.status === 'evidence_missing' ? 'evidence_missing' : 'alias',
      requirement: 'Runbook tracker URL must open the real group-chat assignment board filtered to the requested agent.',
      evidence: assignmentGate?.detail || 'Evidence Missing: assignment board gate was not present in Command Truth snapshot.',
      noFakeGreenBoundary: 'Done remains blocked without a non-empty evidence path or receipt reference.',
    },
    {
      id: 'command-truth-routes-api',
      path: '/api/command-truth/routes',
      surface: 'Command Truth routes API',
      status: 'live',
      requirement: 'Runbook and tests need a machine-readable route contract sourced from Mission Control truth data.',
      evidence: receiptGate?.detail || `${snapshot.receipts.length} decision receipt(s) visible in the Blackwire dataset.`,
      noFakeGreenBoundary: 'The API reports contract and gate status; it does not mutate operations or mark demo complete by itself.',
    },
  ]

  return {
    generatedAt: Math.floor(Date.now() / 1000),
    canonicalPath: snapshot.canonical.activePath,
    runbook: 'docs/PATCH_S4_BLACKWIRE_DEMO_RUNBOOK_2026-05-02.md',
    localMvpBoundary: 'Commercial-demo candidate only; production deploys, external sends, trades, and memory writes remain approval/instrumentation-gated.',
    routes,
    blackwireDoneGates: snapshot.blackwireDoneGates,
    truthGates: snapshot.truthGates,
    snapshot,
  }
}
