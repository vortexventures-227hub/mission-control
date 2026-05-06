import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Knowledge Intake operator triage surface', () => {
  it('exposes queue readiness, citation, and approval-gate indicators without durable writes', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/knowledge-intake-panel.tsx'), 'utf8')

    expect(source).toContain('Review Queue')
    expect(source).toContain('Operator triage')
    expect(source).toContain('Review-ready')
    expect(source).toContain('Needs input')
    expect(source).toContain('Citations')
    expect(source).toContain('Approval gates')
    expect(source).toContain('Next operator move')
    expect(source).toContain('stage destination approval only when citations look clean')
    expect(source).toContain('before asking Memory to learn')
  })
})
