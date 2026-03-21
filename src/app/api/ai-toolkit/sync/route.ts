import { NextRequest, NextResponse } from 'next/server'
import { syncToolsToFile } from '@/lib/ai-toolkit/sync-tools'

/**
 * POST /api/ai-toolkit/sync
 * 
 * Regenerates embeddings and saves to tools-with-embeddings.json
 * This is the in-memory approach (no Supabase needed)
 */
export async function POST(request: NextRequest) {
  try {
    // Simple API key auth (production: use proper auth)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.ADMIN_API_KEY
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse optional path from body
    const body = await request.json().catch(() => ({}))
    const toolsJsonPath = body.path
    
    // Run sync (generates embeddings to file)
    const result = await syncToolsToFile(toolsJsonPath)
    
    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
      duration: `${result.duration}ms`,
      note: 'Embeddings saved to data/tools-with-embeddings.json. Restart server to reload.',
    }, {
      status: result.success ? 200 : 207, // 207 = Multi-Status (partial success)
    })
    
  } catch (error) {
    console.error('Sync API error:', error)
    
    return NextResponse.json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * GET /api/ai-toolkit/sync
 * 
 * Returns sync status/info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai-toolkit/sync',
    method: 'POST',
    description: 'Regenerate embeddings for AI Toolkit (in-memory approach)',
    authorization: 'Bearer <ADMIN_API_KEY> (optional)',
    body: {
      path: '(optional) Path to tools.json file',
    },
    notes: [
      'Generates embeddings using OpenAI text-embedding-3-small',
      'Saves to data/tools-with-embeddings.json',
      'Server restart required to reload embeddings',
      'Alternative: run `pnpm generate-embeddings` from CLI',
    ],
  })
}
