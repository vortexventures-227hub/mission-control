import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const INBOX_PATH = '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/Dispatch_Inbox'

export async function GET(
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

  try {
    const content = await readFile(filePath, 'utf-8')
    return NextResponse.json({ name: filename, content })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read file', detail: String(err) }, { status: 500 })
  }
}
