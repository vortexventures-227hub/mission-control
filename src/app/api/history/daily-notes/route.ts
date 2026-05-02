import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date') // YYYY-MM-DD format
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 90)

    // Dynamically require fs/path to avoid top-level import issues
    const fs = require('fs')
    const path = require('path')

    const memoryDir = path.join(process.env.HOME || '/Users/vortexventures', '.openclaw', 'workspace', 'memory')

    if (!fs.existsSync(memoryDir)) {
      return NextResponse.json({ notes: [], error: 'Memory directory not found' })
    }

    // Get all .md files sorted by date
    const files = fs.readdirSync(memoryDir)
      .filter((f: string) => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}/.test(f))
      .sort()
      .reverse()
      .slice(0, limit)

    const notes: Array<{
      date: string
      filename: string
      summary: string
      preview: string
      wordCount: number
      projects: string[]
      hasProjectStatus: boolean
    }> = []

    for (const file of files) {
      const filePath = path.join(memoryDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')

      // Extract date from filename (e.g., "2026-04-01.md")
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/)
      const date = dateMatch ? dateMatch[1] : file.replace('.md', '')

      // If filtering by specific date, skip non-matching
      if (dateParam && date !== dateParam) continue

      // Extract project mentions from content
      const projectMatches = content.match(/###\s+([A-Za-z0-9]+)/g) || []
      const projects: string[] = [...new Set<string>(projectMatches.map((m: string) => m.replace('### ', '')).filter((p: string) => p.length > 2 && p.length < 30))]

      // Extract summary (first heading content)
      const summaryMatch = content.match(/^#.*?\n+([^#\n]+)/m)
      const summary = summaryMatch ? summaryMatch[1].trim().slice(0, 120) : content.split('\n').find((l: string) => l.trim().length > 20)?.trim().slice(0, 120) || ''

      // Count words
      const wordCount = content.split(/\s+/).filter(Boolean).length

      notes.push({
        date,
        filename: file,
        summary: summary || `${wordCount} words logged`,
        preview: content.slice(0, 300),
        wordCount,
        projects,
        hasProjectStatus: content.includes('| Project |'),
      })
    }

    return NextResponse.json({ notes })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/history/daily-notes error')
    return NextResponse.json({ error: 'Failed to fetch daily notes', notes: [] }, { status: 500 })
  }
}
