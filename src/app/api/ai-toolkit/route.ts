import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { requireRole } from '@/lib/auth'

// Path to the AI Toolkit database
const TOOLKIT_DB_PATH = join(
  homedir(),
  'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/tools.json'
)

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, 'viewer')
  if (authResult instanceof NextResponse) return authResult

  try {
    const content = await readFile(TOOLKIT_DB_PATH, 'utf-8')
    const database = JSON.parse(content)
    
    return NextResponse.json(database)
  } catch (error) {
    console.error('Failed to load AI Toolkit database:', error)
    return NextResponse.json(
      { error: 'Failed to load AI Toolkit database' },
      { status: 500 }
    )
  }
}
