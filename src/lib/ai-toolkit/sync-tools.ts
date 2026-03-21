/**
 * AI Toolkit - Tool Sync Utility (DEPRECATED)
 * 
 * This file is deprecated. We now use in-memory vector search.
 * See: scripts/generate-embeddings.mjs
 * 
 * For programmatic embedding regeneration, use the generate-embeddings script:
 *   pnpm generate-embeddings
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

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
  pricing_tiers?: Record<string, unknown>
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

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
  duration: number
}

// =============================================================================
// Configuration
// =============================================================================

const BATCH_SIZE = 20
const EMBEDDING_MODEL = 'text-embedding-3-small'

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
  
  return parts.filter(Boolean).join(' ').slice(0, 8000)
}

/**
 * Generate embeddings via OpenAI API
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.data.map((item: { embedding: number[] }) => item.embedding)
}

// =============================================================================
// Main Sync Function (In-Memory)
// =============================================================================

/**
 * Generate embeddings and save to tools-with-embeddings.json
 * This replaces the old Supabase sync approach
 */
export async function syncToolsToFile(
  toolsJsonPath?: string,
  outputPath?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<SyncResult> {
  const startTime = Date.now()
  
  // Default paths
  const jsonPath = toolsJsonPath || join(
    process.env.HOME || '~',
    'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/tools.json'
  )
  
  const outPath = outputPath || join(process.cwd(), 'data', 'tools-with-embeddings.json')
  
  // Read tools.json
  let database: ToolsDatabase
  try {
    const content = await readFile(jsonPath, 'utf-8')
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
  console.log(`Starting embedding generation for ${tools.length} tools...`)
  
  const errors: string[] = []
  const embeddings: number[][] = []
  
  // Process in batches
  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(tools.length / BATCH_SIZE)
    
    console.log(`Processing batch ${batchNum}/${totalBatches}...`)
    
    try {
      const texts = batch.map(buildSearchableText)
      const batchEmbeddings = await generateEmbeddings(texts)
      embeddings.push(...batchEmbeddings)
      
      onProgress?.(i + batch.length, tools.length)
    } catch (error) {
      errors.push(`Batch ${batchNum} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Fill with empty embeddings for failed batch
      batch.forEach(() => embeddings.push([]))
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < tools.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Build output
  const toolsWithEmbeddings = {
    metadata: {
      ...database.metadata,
      embeddings_generated: new Date().toISOString(),
      embedding_model: EMBEDDING_MODEL,
      embedding_dimensions: embeddings[0]?.length || 1536,
    },
    tools: tools.map((tool, idx) => ({
      ...tool,
      embedding: embeddings[idx] || [],
    })),
  }
  
  // Write output
  try {
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, JSON.stringify(toolsWithEmbeddings, null, 2))
  } catch (error) {
    errors.push(`Failed to write output: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  const duration = Date.now() - startTime
  const synced = embeddings.filter(e => e.length > 0).length
  const failed = tools.length - synced
  
  console.log(`Sync complete: ${synced} synced, ${failed} failed in ${duration}ms`)
  
  return {
    success: errors.length === 0,
    synced,
    failed,
    errors,
    duration,
  }
}

// Alias for backwards compatibility (deprecated)
export const syncToolsToSupabase = syncToolsToFile
