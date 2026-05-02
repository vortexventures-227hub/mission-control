import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, rename, mkdir, writeFile } from 'fs/promises'
import { stat } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const INBOX_PATH = '/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/Dispatch_Inbox'
const PROCESSED_PATH = join(INBOX_PATH, '_processed')

export type FileStatus = 'NEW' | 'PROCESSED' | 'FLAGGED'

export interface InboxFile {
  name: string
  path: string
  size: number
  modifiedMs: number
  status: FileStatus
  preview: string
  projectTag: string | null
  processedAt?: number // ms timestamp when moved to processed
}

export interface InboxResponse {
  inbox: InboxFile[]
  processed: InboxFile[]
  total: number
  unprocessedCount: number
}

/** Ensure _processed folder exists */
async function ensureProcessedFolder() {
  try {
    await mkdir(PROCESSED_PATH, { recursive: true })
  } catch {
    // already exists
  }
}

/** Read the status tag from the top of a file */
async function extractFileMeta(filePath: string): Promise<{ preview: string; projectTag: string | null }> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    const projectMatch = content.match(/^Project:\s*(.+)/m)
    const projectTag = projectMatch ? projectMatch[1].trim() : null

    const preview = lines.slice(0, 3).join(' ').substring(0, 120)

    return { preview, projectTag }
  } catch {
    return { preview: '', projectTag: null }
  }
}

async function getFileStatus(filePath: string): Promise<FileStatus> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lower = content.toLowerCase()
    if (lower.includes('[flagged]') || lower.includes('[ flagged ]')) return 'FLAGGED'
    if (lower.includes('[processed]') || lower.includes('[ processed ]')) return 'PROCESSED'
    return 'NEW'
  } catch {
    return 'NEW'
  }
}

async function buildFileEntry(name: string, basePath: string): Promise<InboxFile> {
  const filePath = join(basePath, name)
  const st = await stat(filePath)
  const { preview, projectTag } = await extractFileMeta(filePath)
  const status = await getFileStatus(filePath)

  const entry: InboxFile = {
    name,
    path: filePath,
    size: st.size,
    modifiedMs: st.mtimeMs,
    status,
    preview,
    projectTag,
  }

  // If in _processed/, read the processed timestamp from a sidecar file
  if (basePath === PROCESSED_PATH) {
    try {
      const metaContent = await readFile(join(PROCESSED_PATH, `.${name}.meta`), 'utf-8')
      const meta = JSON.parse(metaContent)
      entry.processedAt = meta.processedAt
    } catch {
      // Use file mtime as fallback
      entry.processedAt = st.mtimeMs
    }
  }

  return entry
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Return single file content if ?file= is provided
  const fileName = searchParams.get('file')
  if (fileName) {
    // Support both inbox and _processed files
    let filePath = join(INBOX_PATH, fileName)
    try {
      await stat(filePath)
    } catch {
      filePath = join(PROCESSED_PATH, fileName)
    }
    try {
      const content = await readFile(filePath, 'utf-8')
      return NextResponse.json({ content, name: fileName })
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
  }

  try {
    await ensureProcessedFolder()

    // Read inbox files (exclude _processed, dotfiles)
    const inboxFiles = await readdir(INBOX_PATH)
    const inboxEntries: InboxFile[] = []
    for (const name of inboxFiles) {
      if (name === '_processed' || name.startsWith('.')) continue
      const entry = await buildFileEntry(name, INBOX_PATH)
      inboxEntries.push(entry)
    }

    // Read processed files
    const processedFiles = await readdir(PROCESSED_PATH)
    const processedEntries: InboxFile[] = []
    for (const name of processedFiles) {
      if (name.startsWith('.')) continue // skip sidecar meta files
      const entry = await buildFileEntry(name, PROCESSED_PATH)
      processedEntries.push(entry)
    }

    // Sort inbox: NEW first, then FLAGGED, oldest first within status
    const statusOrder: Record<FileStatus, number> = { NEW: 0, FLAGGED: 1, PROCESSED: 2 }
    inboxEntries.sort((a, b) => {
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status]
      return a.modifiedMs - b.modifiedMs
    })

    // Sort processed: most recently processed first
    processedEntries.sort((a, b) => (b.processedAt ?? b.modifiedMs) - (a.processedAt ?? a.modifiedMs))

    const unprocessedCount = inboxEntries.filter(f => f.status !== 'PROCESSED').length

    const response: InboxResponse = {
      inbox: inboxEntries,
      processed: processedEntries,
      total: inboxEntries.length + processedEntries.length,
      unprocessedCount,
    }

    return NextResponse.json(response)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read inbox', detail: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, action } = body as { name: string; action: 'flag' | 'unflag' | 'process' | 'unprocess' }

    if (!name || !action) {
      return NextResponse.json({ error: 'Missing name or action' }, { status: 400 })
    }

    await ensureProcessedFolder()

    if (action === 'flag') {
      // Add [FLAGGED] tag to file in inbox
      const filePath = join(INBOX_PATH, name)
      const content = await readFile(filePath, 'utf-8')
      const cleaned = content
        .replace(/^\[PROCESSED\]\s*/gim, '')
        .replace(/^\[FLAGGED\]\s*/gim, '')
      const updated = `[FLAGGED]\n${cleaned}`
      await writeFile(filePath, updated, 'utf-8')
      return NextResponse.json({ success: true, name, status: 'FLAGGED' })
    }

    if (action === 'unflag') {
      // Remove [FLAGGED] tag
      const filePath = join(INBOX_PATH, name)
      const content = await readFile(filePath, 'utf-8')
      const cleaned = content.replace(/^\[FLAGGED\]\s*/gim, '')
      await writeFile(filePath, cleaned, 'utf-8')
      return NextResponse.json({ success: true, name, status: 'NEW' })
    }

    if (action === 'process') {
      // Move file to _processed/ with timestamp sidecar
      const srcPath = join(INBOX_PATH, name)
      const dstPath = join(PROCESSED_PATH, name)
      const content = await readFile(srcPath, 'utf-8')

      // Clean tags and add [PROCESSED]
      const cleaned = content
        .replace(/^\[PROCESSED\]\s*/gim, '')
        .replace(/^\[FLAGGED\]\s*/gim, '')
      const processed = `[PROCESSED]\n${cleaned}`

      // Write to _processed/
      await writeFile(dstPath, processed, 'utf-8')

      // Write sidecar meta
      const metaPath = join(PROCESSED_PATH, `.${name}.meta`)
      await writeFile(metaPath, JSON.stringify({ processedAt: Date.now(), originalName: name }), 'utf-8')

      // Delete original
      const { unlink } = await import('fs/promises')
      await unlink(srcPath)

      return NextResponse.json({ success: true, name, status: 'PROCESSED' })
    }

    if (action === 'unprocess') {
      // Move file back from _processed/ to inbox
      const srcPath = join(PROCESSED_PATH, name)
      const dstPath = join(INBOX_PATH, name)
      const content = await readFile(srcPath, 'utf-8')

      // Remove [PROCESSED] tag
      const cleaned = content.replace(/^\[PROCESSED\]\s*/gim, '')
      await writeFile(dstPath, cleaned, 'utf-8')

      // Delete original + sidecar
      const { unlink } = await import('fs/promises')
      await unlink(srcPath)
      try { await unlink(join(PROCESSED_PATH, `.${name}.meta`)) } catch { /* ok */ }

      return NextResponse.json({ success: true, name, status: 'NEW' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update file', detail: String(err) }, { status: 500 })
  }
}
