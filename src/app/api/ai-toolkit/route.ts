import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { requireRole } from '@/lib/auth'

function resolveToolkitPath(filename: string): string {
  const candidates = [
    join('/Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database', filename),
    join(homedir(), 'Desktop/Vortex Ventures/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database', filename),
    join(homedir(), 'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database', filename),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

// Paths to the AI Toolkit database files. Prefer the canonical Vortex Ventures root;
// keep the legacy Desktop sibling as a fallback for older workspaces.
const TOOLKIT_DB_PATH = resolveToolkitPath('tools.json')
const TEMPLATES_DB_PATH = resolveToolkitPath('stack-templates.json')

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, 'viewer')
  if (authResult instanceof NextResponse) return authResult

  try {
    // Load tools database
    const toolsContent = await readFile(TOOLKIT_DB_PATH, 'utf-8')
    const toolsDatabase = JSON.parse(toolsContent)
    
    // Try to load templates (optional, won't fail if missing)
    let templatesDatabase = { templates: [] }
    try {
      const templatesContent = await readFile(TEMPLATES_DB_PATH, 'utf-8')
      templatesDatabase = JSON.parse(templatesContent)
    } catch {
      // Templates file doesn't exist yet, use empty
    }
    
    return NextResponse.json({
      ...toolsDatabase,
      stack_templates: templatesDatabase.templates || []
    })
  } catch (error) {
    console.error('Failed to load AI Toolkit database:', error)
    return NextResponse.json(
      { error: 'Failed to load AI Toolkit database' },
      { status: 500 }
    )
  }
}
