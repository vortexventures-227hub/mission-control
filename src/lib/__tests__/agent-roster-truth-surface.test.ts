import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control agent roster truth surface', () => {
  it('shows roster truth and last proof/activity boundaries on agent cards', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/agent-squad-panel-phase3.tsx'), 'utf8')

    expect(source).toContain('Roster truth')
    expect(source).toContain('not external delivery proof')
    expect(source).toContain('Current work')
    expect(source).toContain('Proof boundary')
    expect(source).toContain('Last proof/activity:')
    expect(source).toContain('agent.last_activity')
  })
})
