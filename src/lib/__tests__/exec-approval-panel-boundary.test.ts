import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control exec approval local boundary', () => {
  it('keeps local read-only approval receipts from rendering executable approval actions', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/exec-approval-panel.tsx'), 'utf8')

    expect(source).toContain("approvalSource === 'local-read-only'")
    expect(source).toContain("if (approvalSource === 'local-read-only') return")
    expect(source).toContain('readOnly={approvalSource ===')
    expect(source).toContain('Local proof row - gateway resolution unavailable')
    expect(source).toContain('local rows are proof/read-only and do not trigger external execution')
  })
})
