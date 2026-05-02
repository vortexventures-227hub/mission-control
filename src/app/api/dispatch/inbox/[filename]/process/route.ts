import { NextRequest, NextResponse } from 'next/server'
import { rename, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const INBOX_PATH = '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/Dispatch_Inbox'
const PROCESSED_PATH = join(INBOX_PATH, '_processed')

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const srcPath = join(INBOX_PATH, filename)

  if (!existsSync(srcPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  try {
    // Ensure _processed directory exists
    await mkdir(PROCESSED_PATH, { recursive: true })

    const destPath = join(PROCESSED_PATH, filename)
    await rename(srcPath, destPath)

    // Also remove any flagged marker if it exists
    const flagPath = join(INBOX_PATH, `.${filename}.flagged`)
    if (existsSync(flagPath)) {
      const { unlink } = await import('fs/promises')
      await unlink(flagPath).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      name: filename,
      processedAt: new Date().toISOString(),
      destination: destPath,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process file', detail: String(err) }, { status: 500 })
  }
}
