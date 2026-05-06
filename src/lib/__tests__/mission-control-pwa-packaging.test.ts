import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('Mission Control local app packaging', () => {
  it('uses Blackwire HQ install metadata and command shortcuts', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/manifest.json'), 'utf8')) as {
      description: string
      display: string
      display_override?: string[]
      shortcuts?: Array<{ url: string }>
    }

    expect(manifest.description).toContain('Blackwire Ops HQ')
    expect(manifest.display).toBe('standalone')
    expect(manifest.display_override).toContain('standalone')
    expect(manifest.shortcuts?.map((shortcut) => shortcut.url)).toEqual(expect.arrayContaining([
      '/command-truth',
      '/rooms/blackwire-ops',
      '/tasks',
    ]))
  })

  it('keeps service-worker caching limited to static install assets', () => {
    const sw = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')

    expect(sw).toContain('mission-control-static-v1')
    expect(sw).toContain('STATIC_ASSETS.includes(requestUrl.pathname)')
    expect(sw).toContain("requestUrl.pathname.startsWith('/api/')")
    expect(sw).toContain("event.request.mode === 'navigate'")
    expect(sw).toContain("event.request.destination === 'document'")
    expect(sw).toContain('dynamic command-center data is never stored')
  })
})
