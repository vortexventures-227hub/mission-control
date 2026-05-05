import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control expense ledger tabs', () => {
  it('keeps subscriptions and one-off expenses as explicit in-product tabs, not scattered files', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/expenses-panel.tsx'), 'utf8')

    expect(source).toContain("useState<'overview' | 'subscriptions' | 'one_off'>('subscriptions')")
    expect(source).toContain('Expense Ledger')
    expect(source).toContain('Canonical Mission Control ledger')
    expect(source).toContain('Subscriptions')
    expect(source).toContain('One-off Expenses')
    expect(source).toContain('/api/expenses?days=365&kind=one_off')
    expect(source).toContain('Recurring subscriptions belong on the Subscriptions tab')
  })

  it('keeps API summary and listing support separated one-off expense reads', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/api/expenses/route.ts'), 'utf8')

    expect(source).toContain("const kind = searchParams.get('kind')")
    expect(source).toContain('oneOffTotal')
    expect(source).toContain("kind === 'one_off'")
    expect(source).toContain('COALESCE(is_recurring, 0) = 0')
    expect(source).toContain("billing_cycle='annual' THEN amount/12.0")
  })
})
