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

import { getMarketingCommandCenterSnapshot } from '../marketing-command-center'
import { getMissionControlSurfaceSnapshot } from '../mission-control-surfaces'

describe('marketing command center', () => {
  it('surfaces per-project tab depth with evidence and approval gates instead of fake green', () => {
    const snapshot = getMarketingCommandCenterSnapshot()
    const blackwire = snapshot.projectProfiles.find((profile) => profile.id === 'blackwire')
    const materialSolutions = snapshot.projectProfiles.find((profile) => profile.id === 'material-solutions')

    expect(snapshot.summary.projectTabCount).toBe(9)
    expect(snapshot.summary.safeDraftsReady).toBe(6)
    expect(snapshot.summary.projectsWithEvidenceMissing).toBe(2)
    expect(blackwire?.tabs.find((tab) => tab.id === 'blackwire-proof')?.status).toBe('evidence_missing')
    expect(materialSolutions?.tabs.find((tab) => tab.id === 'material-solutions-outreach')?.status).toBe('approval_required')
    expect(materialSolutions?.tabs.find((tab) => tab.id === 'material-solutions-david-isolation')?.status).toBe('blocked')
    expect(snapshot.externalActionGuardrails.join(' ')).toContain('No social post')
  })

  it('projects per-project tab details into the shared Marketing surface snapshot', () => {
    const marketing = getMissionControlSurfaceSnapshot('marketing')
    const cards = marketing?.sections.flatMap((section) => section.cards) || []

    expect(marketing?.summary.projectTabCount).toBe(9)
    expect(cards.find((card) => card.id === 'blackwire-blackwire-proof')?.status).toBe('evidence_missing')
    expect(cards.find((card) => card.id === 'material-solutions-material-solutions-david-isolation')?.status).toBe('blocked')
    expect(cards.find((card) => card.id === 'mission-control-mission-control-public-launch')?.status).toBe('approval_required')
  })
})
