import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control notifications local queue', () => {
  it('defaults to an operator queue and exposes local-only delivery boundaries', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/panels/notifications-panel.tsx'), 'utf8')

    expect(source).toContain("window.localStorage.getItem('mc.notifications.recipient') || 'operator'")
    expect(source).toContain('Local Mission Control notification queue only')
    expect(source).toContain('No email, SMS, push, or external agent delivery is implied')
    expect(source).toContain("['operator', 'Chris', 'koda', 'herm']")
    expect(source).toContain('Delivered rows')
  })
})
