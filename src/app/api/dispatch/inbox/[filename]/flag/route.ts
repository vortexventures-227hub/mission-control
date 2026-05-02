import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const INBOX_PATH = '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/Dispatch_Inbox'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const filePath = join(INBOX_PATH, filename)

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const flagPath = join(INBOX_PATH, `.${filename}.flagged`)

  try {
    if (existsSync(flagPath)) {
      // Toggle: remove flag if already flagged
      await unlink(flagPath)
      return NextResponse.json({ success: true, name: filename, flagged: false })
    } else {
      // Create flagged marker
      await writeFile(flagPath, `Flagged at: ${new Date().toISOString()}\n`, 'utf-8')
      return NextResponse.json({ success: true, name: filename, flagged: true })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to flag file', detail: String(err) }, { status: 500 })
  }
}
