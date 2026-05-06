import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Marketing Command Center panel triage', () => {
  it('shows daily draft readiness and external-action approval boundaries on the dedicated route panel', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/marketing-command-center-panel.tsx'), 'utf8')

    expect(source).toContain('Daily marketing triage')
    expect(source).toContain('Draft readiness')
    expect(source).toContain('External action boundary')
    expect(source).toContain('safe internal drafts')
    expect(source).toContain('Analytics live is not implied by draft readiness')
    expect(source).toContain('Missing analytics must remain Not Instrumented Yet')
    expect(source).toContain('Email, SMS, social, marketplace, ads, campaign settings, public launch, and spend')
    expect(source).toContain('approval packet with channel, audience, spend/send/post scope')
  })
})
