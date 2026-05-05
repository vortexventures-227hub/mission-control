import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('AI Toolkit operations matrix', () => {
  it('exposes a page/tab for skills, MCPs, webhooks, and agent hooks', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/ai-toolkit-panel.tsx'), 'utf8')

    expect(source).toContain("'ops-matrix'")
    expect(source).toContain('Ops Matrix')
    expect(source).toContain('Skills')
    expect(source).toContain('MCP Servers')
    expect(source).toContain('Webhooks')
    expect(source).toContain('Agent Hooks')
    expect(source).toContain('Approval-gated external action')
    expect(source).toContain('Not Instrumented Yet')
  })
})
