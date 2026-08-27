import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('hosted Mission Control runtime honesty', () => {
  it('grades the gateway pill from a recurring server-side reachability probe', () => {
    const header = source('src/components/layout/header-bar.tsx')

    expect(header).toContain("fetch('/api/status?action=gateway')")
    expect(header).toContain('status?.port_listening === true')
    expect(header).toContain('isConnected || gatewayAvailable')
    expect(header).toContain('window.setInterval(refreshGatewayHealth, 15_000)')
  })

  it('keeps notifications, approvals, and receipts usable in essential mode', () => {
    const nav = source('src/components/layout/nav-rail.tsx')
    const router = source('src/app/[[...panel]]/page.tsx')

    expect(nav).toContain("id: 'exec-approvals', label: 'Approvals', icon: <ApprovalsIcon />, priority: false, essential: true")
    expect(nav).toContain("id: 'documents', label: 'Receipts & Search', icon: <ContentIcon />, priority: false, essential: true")
    expect(router).toContain("'notifications', 'exec-approvals', 'documents'")
  })

  it('never silently labels a failed runtime-identity fetch as local and aligns widget agent counts', () => {
    const dashboard = source('src/components/dashboard/dashboard.tsx')
    const statusRoute = source('src/app/api/status/route.ts')

    expect(dashboard).toContain("const runtime = snapshot?.canonical.runtime || 'unknown'")
    expect(dashboard).toContain("'Runtime identity pending'")
    expect(dashboard).toContain('window.setInterval(load, 15_000)')
    expect(statusRoute).toContain('FROM agents WHERE workspace_id = ? AND hidden = 0 GROUP BY status')
  })

  it('supervises the container gateway instead of leaving a dead child down', () => {
    const entrypoint = source('docker-entrypoint.sh')

    expect(entrypoint).toContain('gateway_supervisor()')
    expect(entrypoint).toContain('OpenClaw gateway exited (%s); restarting in 2s')
    expect(entrypoint).toContain('gateway_supervisor &')
  })
})
