import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getLocalVisualReceiptSnapshot } from '@/lib/local-visual-receipts'

let tempDir: string | null = null

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('local visual receipt discovery', () => {
  it('returns an empty read-only snapshot when no proof output exists', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'mc-no-receipts-'))

    const snapshot = getLocalVisualReceiptSnapshot(path.join(tempDir, 'missing'))

    expect(snapshot.latestProofDir).toBeNull()
    expect(snapshot.screenshotsFound).toBe(0)
    expect(snapshot.routesCovered).toEqual([])
    expect(snapshot.summaryPath).toBeNull()
  })

  it('discovers the newest Mission Control proof screenshots', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'mc-receipts-'))
    const oldProof = path.join(tempDir, 'mission-control-ui-proof-old')
    const latestProof = path.join(tempDir, 'mission-control-ui-proof-new')
    mkdirSync(oldProof)
    mkdirSync(latestProof)
    writeFileSync(path.join(oldProof, 'login.png'), '')
    writeFileSync(path.join(latestProof, 'mission-control.png'), '')
    writeFileSync(path.join(latestProof, 'rooms_blackwire-ops.png'), '')
    writeFileSync(path.join(latestProof, 'summary.json'), '{}')

    const snapshot = getLocalVisualReceiptSnapshot(tempDir)

    expect(snapshot.latestProofDir).toBe(latestProof)
    expect(snapshot.screenshotsFound).toBe(2)
    expect(snapshot.routesCovered).toEqual(['mission-control', 'rooms/blackwire-ops'])
    expect(snapshot.summaryPath).toBe(path.join(latestProof, 'summary.json'))
  })
})
