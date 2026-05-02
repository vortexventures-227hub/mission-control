import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface ProjectEntry {
  name: string
  path: string
  roadmapContent?: string
  roadmapLastModified?: number
  status?: string
  phases?: string[]
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const fs = require('fs')
    const path = require('path')

    // Where projects are tracked
    const projectsMemoryDir = path.join(process.env.HOME || '/Users/vortexventures', '.openclaw', 'workspace', 'memory', 'projects')

    // Also scan VVAxeOps root for ROADMAP.md files
    const vvaDir = path.join(process.env.HOME || '/Users/vortexventures', 'Desktop', 'VVAxeOps')

    const projects: ProjectEntry[] = []

    // Scan the memory/projects directory
    if (fs.existsSync(projectsMemoryDir)) {
      const projectDirs = fs.readdirSync(projectsMemoryDir)
      for (const dir of projectDirs) {
        const projectPath = path.join(projectsMemoryDir, dir)
        const stat = fs.statSync(projectPath)

        if (stat.isDirectory()) {
          const entry: ProjectEntry = {
            name: dir,
            path: projectPath,
          }

          // Check for project-specific markdown files
          const projectFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.md'))
          if (projectFiles.length > 0) {
            // Use the most recently modified file
            const sorted = projectFiles.map(f => ({
              file: f,
              mtime: fs.statSync(path.join(projectPath, f)).mtimeMs
            })).sort((a, b) => b.mtime - a.mtime)

            const latestFile = sorted[0].file
            const content = fs.readFileSync(path.join(projectPath, latestFile), 'utf-8')
            entry.roadmapContent = content.slice(0, 2000) // First 2000 chars
            entry.roadmapLastModified = sorted[0].mtime

            // Extract status from content
            const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n*]+)/i)
            if (statusMatch) entry.status = statusMatch[1].trim()

            // Extract phases
            const phaseMatches = content.match(/Phase\s+(\d+[A-Z]?)/gi) || []
            entry.phases = Array.from(new Set<string>(phaseMatches.map(p => p.replace(/phase\s+/i, ''))))
          }

          projects.push(entry)
        }
      }
    }

    // Also scan VVAxeOps root for notable ROADMAP.md files
    const vvaReadmeFiles = [
      'AppFactory/ROADMAP.md',
      'GekkoEngine/ROADMAP.md',
      'material-solutions-app/ROADMAP.md',
      'mission-control/ROADMAP.md',
    ]

    for (const file of vvaReadmeFiles) {
      const fullPath = path.join(vvaDir, file)
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath)
        const content = fs.readFileSync(fullPath, 'utf-8')
        const projectName = file.split('/')[0]

        // Extract status
        const statusMatch = content.match(/\*\*Status:\*\*\s*([^\n*]+)/i)
        const phaseMatches = content.match(/Phase\s+(\d+[A-Z]?)/gi) || []

        projects.push({
          name: projectName,
          path: fullPath,
          roadmapContent: content.slice(0, 2000),
          roadmapLastModified: stat.mtimeMs,
          status: statusMatch ? statusMatch[1].trim() : undefined,
          phases: Array.from(new Set<string>(phaseMatches.map(p => p.replace(/phase\s+/i, '')))),
        })
      }
    }

    // Sort by name
    projects.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      projects: projects.map(p => ({
        name: p.name,
        status: p.status || 'unknown',
        phases: p.phases || [],
        lastModified: p.roadmapLastModified ? new Date(p.roadmapLastModified).toISOString() : null,
        hasRoadmap: !!p.roadmapContent,
        preview: p.roadmapContent?.slice(0, 300) || null,
      }))
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/history/projects error')
    return NextResponse.json({ error: 'Failed to fetch project history', projects: [] }, { status: 500 })
  }
}
