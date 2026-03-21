/**
 * AI Toolkit - Tool Sync Utility
 * 
 * Syncs tools.json to Supabase with embedding generation
 * Run with: npx ts-node src/lib/ai-toolkit/sync-tools.ts
 * Or via API: POST /api/ai-toolkit/sync
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// Types
// =============================================================================

interface Tool {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  pricing_model: string
  pricing_tiers?: Record<string, any>
  free_tier?: { available: boolean; details?: string; limits?: string }
  key_features?: string[]
  pros?: string[]
  cons?: string[]
  skills?: string[]
  tags?: string[]
  forklift_relevance?: { score: number; notes?: string; use_cases?: string[] }
  api_available?: boolean
  local_deployment?: { available: boolean; requirements?: string; notes?: string }
  video_links?: Array<{ title: string; url: string; type?: string }>
  integrations?: string[]
  status?: string
  recommendation_tier?: string
  source_file?: string
  last_updated?: string
}

interface ToolsDatabase {
  metadata: {
    total_tools: number
    last_updated: string
    version: string
    categories: string[]
  }
  tools: Tool[]
}

interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
  duration: number
}

// =============================================================================
// Configuration
// =============================================================================

const BATCH_SIZE = 10 // Process tools in batches to avoid rate limits
const EMBEDDING_MODEL = 'text-embedding-3-small'

// =============================================================================
// Clients
// =============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false }
  }
)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build searchable text from tool data for embedding
 */
function buildSearchableText(tool: Tool): string {
  const parts = [
    tool.name,
    tool.description || '',
    tool.category,
    tool.subcategory || '',
    ...(tool.key_features || []),
    ...(tool.skills || []),
    ...(tool.tags || []),
    tool.forklift_relevance?.notes || '',
    ...(tool.forklift_relevance?.use_cases || []),
    ...(tool.pros || []),
  ]
  
  return parts.filter(Boolean).join(' ').slice(0, 8000) // OpenAI limit
}

/**
 * Generate embeddings for multiple texts in batch
 */
async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float',
  })
  
  return response.data.map(item => item.embedding)
}

/**
 * Upsert a tool to Supabase
 */
async function upsertTool(tool: Tool, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from('ai_tools')
    .upsert({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      subcategory: tool.subcategory || null,
      description: tool.description || null,
      pricing_model: tool.pricing_model,
      pricing_tiers: tool.pricing_tiers || {},
      free_tier: tool.free_tier || { available: false },
      key_features: tool.key_features || [],
      pros: tool.pros || [],
      cons: tool.cons || [],
      skills: tool.skills || [],
      tags: tool.tags || [],
      forklift_relevance: tool.forklift_relevance || { score: 0 },
      api_available: tool.api_available || false,
      local_deployment: tool.local_deployment || { available: false },
      video_links: tool.video_links || [],
      integrations: tool.integrations || [],
      status: tool.status || null,
      recommendation_tier: tool.recommendation_tier || null,
      source_file: tool.source_file || null,
      last_updated: tool.last_updated || null,
      embedding: embedding,
    }, {
      onConflict: 'id',
    })
  
  if (error) {
    throw new Error(`Failed to upsert ${tool.id}: ${error.message}`)
  }
}

/**
 * Process tools in batches
 */
async function processBatch(
  tools: Tool[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ synced: number; failed: number; errors: string[] }> {
  let synced = 0
  let failed = 0
  const errors: string[] = []
  
  // Generate searchable texts
  const searchableTexts = tools.map(buildSearchableText)
  
  try {
    // Generate embeddings in batch
    const embeddings = await generateEmbeddingsBatch(searchableTexts)
    
    // Upsert each tool
    for (let i = 0; i < tools.length; i++) {
      try {
        await upsertTool(tools[i], embeddings[i])
        synced++
      } catch (error) {
        failed++
        errors.push(`${tools[i].id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      onProgress?.(synced + failed, tools.length)
    }
  } catch (error) {
    // Embedding batch failed, try individually
    console.error('Batch embedding failed, trying individually:', error)
    
    for (const tool of tools) {
      try {
        const text = buildSearchableText(tool)
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: text,
          encoding_format: 'float',
        })
        
        await upsertTool(tool, response.data[0].embedding)
        synced++
      } catch (individualError) {
        failed++
        errors.push(`${tool.id}: ${individualError instanceof Error ? individualError.message : 'Unknown error'}`)
      }
      
      onProgress?.(synced + failed, tools.length)
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return { synced, failed, errors }
}

// =============================================================================
// Main Sync Function
// =============================================================================

export async function syncToolsToSupabase(
  toolsJsonPath?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<SyncResult> {
  const startTime = Date.now()
  
  // Default path
  const jsonPath = toolsJsonPath || path.join(
    process.env.HOME || '~',
    'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/tools.json'
  )
  
  // Read tools.json
  let database: ToolsDatabase
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8')
    database = JSON.parse(content)
  } catch (error) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: [`Failed to read tools.json: ${error instanceof Error ? error.message : 'Unknown error'}`],
      duration: Date.now() - startTime,
    }
  }
  
  const tools = database.tools
  console.log(`Starting sync of ${tools.length} tools...`)
  
  let totalSynced = 0
  let totalFailed = 0
  const allErrors: string[] = []
  
  // Process in batches
  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tools.length / BATCH_SIZE)}...`)
    
    const result = await processBatch(batch, (processed, total) => {
      onProgress?.(i + processed, tools.length)
    })
    
    totalSynced += result.synced
    totalFailed += result.failed
    allErrors.push(...result.errors)
    
    // Rate limit protection between batches
    if (i + BATCH_SIZE < tools.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  const duration = Date.now() - startTime
  
  console.log(`Sync complete: ${totalSynced} synced, ${totalFailed} failed in ${duration}ms`)
  
  return {
    success: totalFailed === 0,
    synced: totalSynced,
    failed: totalFailed,
    errors: allErrors,
    duration,
  }
}

// =============================================================================
// CLI Entry Point
// =============================================================================

if (require.main === module) {
  // Running directly via CLI
  const args = process.argv.slice(2)
  const jsonPath = args[0]
  
  syncToolsToSupabase(jsonPath, (processed, total) => {
    process.stdout.write(`\rProgress: ${processed}/${total} (${Math.round(processed / total * 100)}%)`)
  }).then(result => {
    console.log('\n')
    console.log('='.repeat(60))
    console.log('Sync Result:')
    console.log(`  Success: ${result.success}`)
    console.log(`  Synced: ${result.synced}`)
    console.log(`  Failed: ${result.failed}`)
    console.log(`  Duration: ${result.duration}ms`)
    
    if (result.errors.length > 0) {
      console.log('\nErrors:')
      result.errors.forEach(err => console.log(`  - ${err}`))
    }
    
    process.exit(result.success ? 0 : 1)
  }).catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
