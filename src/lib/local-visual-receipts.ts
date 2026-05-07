import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const DEFAULT_OUTPUTS_DIR = path.join(process.cwd(), 'docs', 'outputs')
const PROOF_DIR_PREFIX = 'mission-control-ui-proof-'

export interface LocalVisualReceiptSnapshot {
  latestProofDir: string | null
  latestProofMtime: number | null
  screenshotsFound: number
  routesCovered: string[]
  summaryPath: string | null
}

function routeFromScreenshot(filename: string) {
  return filename.replace(/\.png$/, '').replace(/_/g, '/')
}

export function getLocalVisualReceiptSnapshot(outputsDir = DEFAULT_OUTPUTS_DIR): LocalVisualReceiptSnapshot {
  if (!existsSync(outputsDir)) {
    return { latestProofDir: null, latestProofMtime: null, screenshotsFound: 0, routesCovered: [], summaryPath: null }
  }

  const proofDirs = readdirSync(outputsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PROOF_DIR_PREFIX))
    .map((entry) => {
      const fullPath = path.join(outputsDir, entry.name)
      return { fullPath, mtimeMs: statSync(fullPath).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  const latest = proofDirs[0]
  if (!latest) {
    return { latestProofDir: null, latestProofMtime: null, screenshotsFound: 0, routesCovered: [], summaryPath: null }
  }

  const files = readdirSync(latest.fullPath, { withFileTypes: true })
  const screenshots = files
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => entry.name)
    .sort()

  const summaryPath = path.join(latest.fullPath, 'summary.json')
  return {
    latestProofDir: latest.fullPath,
    latestProofMtime: Math.floor(latest.mtimeMs),
    screenshotsFound: screenshots.length,
    routesCovered: screenshots.map(routeFromScreenshot),
    summaryPath: existsSync(summaryPath) ? summaryPath : null,
  }
}
