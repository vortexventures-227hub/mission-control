import { NextRequest, NextResponse } from 'next/server'
import { syncToolsToSupabase } from '@/lib/ai-toolkit/sync-tools'

/**
 * POST /api/ai-toolkit/sync
 * 
 * Triggers a sync of tools.json to Supabase with embeddings
 * Requires admin authentication (check for API key or session)
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
    
    // Run sync
    const result = await syncToolsToSupabase(toolsJsonPath)
    
    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
      duration: `${result.duration}ms`,
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
    description: 'Sync tools.json to Supabase with embeddings',
    authorization: 'Bearer <ADMIN_API_KEY>',
    body: {
      path: '(optional) Path to tools.json file',
    },
    notes: [
      'Generates embeddings using OpenAI text-embedding-3-small',
      'Upserts all tools to Supabase ai_tools table',
      'Processing ~93 tools takes ~30-60 seconds',
    ],
  })
}
