import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control task board Done gate visibility', () => {
  it('surfaces the Aegis approval requirement before tasks can look Done', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/task-board-panel.tsx'), 'utf8')

    expect(source).toContain('Aegis approval is required before moving to done')
    expect(source).toContain('awaitingAegis')
    expect(source).toContain('Done gate')
    expect(source).toContain('Aegis approval required')
  })
})
