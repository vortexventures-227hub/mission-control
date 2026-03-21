import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { requireRole } from '@/lib/auth'

// Paths to the AI Toolkit database files
const TOOLKIT_DB_PATH = join(
  homedir(),
  'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/tools.json'
)

const TEMPLATES_DB_PATH = join(
  homedir(),
  'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/stack-templates.json'
)

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
