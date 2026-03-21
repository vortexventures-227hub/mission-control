/**
 * In-memory vector search for AI Toolkit
 * 
 * Zero external dependencies - just OpenAI for query embeddings
 * Pre-computed tool embeddings are loaded from tools-with-embeddings.json
 */

import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { join } from 'path'

// =============================================================================
// Types
// =============================================================================

export interface ToolWithEmbedding {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  pricing_model: string
  pricing_tiers?: Record<string, unknown>
  free_tier?: { available: boolean; details?: string }
  key_features?: string[]
  pros?: string[]
  cons?: string[]
  skills?: string[]
  tags?: string[]
  forklift_relevance?: { score: number; notes?: string; use_cases?: string[] }
  api_available?: boolean
  local_deployment?: { available: boolean; requirements?: string }
  video_links?: Array<{ title: string; url: string; type?: string }>
  integrations?: string[]
  status?: string
  recommendation_tier?: string
  source_file?: string
  last_updated?: string
  embedding: number[]
}

export interface ToolsDatabase {
  metadata: {
    total_tools: number
    last_updated: string
    version: string
    categories: string[]
    embeddings_generated?: string
    embedding_model?: string
    embedding_dimensions?: number
  }
  tools: ToolWithEmbedding[]
}

export interface SearchFilters {
  category?: string
  pricingModel?: string
  recommendationTier?: string
  hasFreeTier?: boolean
  hasApi?: boolean
  tags?: string[]
}

export interface SearchResult {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  pricing_model: string
  pricing_tiers?: Record<string, unknown>
  free_tier?: { available: boolean; details?: string }
  key_features?: string[]
  pros?: string[]
  cons?: string[]
  skills?: string[]
  tags?: string[]
  forklift_relevance?: { score: number; notes?: string; use_cases?: string[] }
  api_available?: boolean
  local_deployment?: { available: boolean; requirements?: string }
  video_links?: Array<{ title: string; url: string; type?: string }>
  integrations?: string[]
  status?: string
  recommendation_tier?: string
  source_file?: string
  last_updated?: string
  similarity: number
  match_reasons: string[]
}

// =============================================================================
// In-Memory Vector Store
// =============================================================================

let toolsCache: ToolsDatabase | null = null
let loadPromise: Promise<ToolsDatabase> | null = null

/**
 * Load tools with embeddings from the JSON file
 * Cached in memory for fast access
 */
async function loadToolsWithEmbeddings(): Promise<ToolsDatabase> {
  if (toolsCache) {
    return toolsCache
  }
  
  // Prevent concurrent loading
  if (loadPromise) {
    return loadPromise
  }
  
  loadPromise = (async () => {
    const dataPath = join(process.cwd(), 'data', 'tools-with-embeddings.json')
    
    try {
      const content = await readFile(dataPath, 'utf-8')
      toolsCache = JSON.parse(content)
      console.log(`[VectorSearch] Loaded ${toolsCache!.tools.length} tools with embeddings`)
      return toolsCache!
    } catch (error) {
      console.error('[VectorSearch] Failed to load embeddings:', error)
      throw new Error(
        'tools-with-embeddings.json not found. Run `pnpm generate-embeddings` first.'
      )
    }
  })()
  
  return loadPromise
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension')
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  
  if (magnitude === 0) return 0
  
  return dotProduct / magnitude
}

/**
 * Generate match reasons based on the tool and query
 */
function generateMatchReasons(tool: ToolWithEmbedding, queryLower: string): string[] {
  const reasons: string[] = []
  
  if (tool.name.toLowerCase().includes(queryLower)) {
    reasons.push('Name match')
  }
  if (tool.category.toLowerCase().includes(queryLower)) {
    reasons.push(`Category: ${tool.category}`)
  }
  if (tool.description?.toLowerCase().includes(queryLower)) {
    reasons.push('Description match')
  }
  if (tool.skills?.some(s => s.toLowerCase().includes(queryLower))) {
    reasons.push('Skills match')
  }
  if (tool.key_features?.some(f => f.toLowerCase().includes(queryLower))) {
    reasons.push('Feature match')
  }
  if (tool.tags?.some(t => t.toLowerCase().includes(queryLower))) {
    reasons.push('Tag match')
  }
  
  if (reasons.length === 0) {
    reasons.push('Semantic similarity')
  }
  
  return reasons
}

/**
 * Apply filters to a tool
 */
function matchesFilters(tool: ToolWithEmbedding, filters: SearchFilters): boolean {
  if (filters.category && tool.category !== filters.category) {
    return false
  }
  if (filters.pricingModel && tool.pricing_model !== filters.pricingModel) {
    return false
  }
  if (filters.recommendationTier && tool.recommendation_tier !== filters.recommendationTier) {
    return false
  }
  if (filters.hasFreeTier !== undefined && tool.free_tier?.available !== filters.hasFreeTier) {
    return false
  }
  if (filters.hasApi !== undefined && tool.api_available !== filters.hasApi) {
    return false
  }
  if (filters.tags && filters.tags.length > 0) {
    const toolTags = new Set(tool.tags?.map(t => t.toLowerCase()) || [])
    if (!filters.tags.some(t => toolTags.has(t.toLowerCase()))) {
      return false
    }
  }
  
  return true
}

// =============================================================================
// Query Embedding Cache
// =============================================================================

interface CachedEmbedding {
  embedding: number[]
  timestamp: number
}

const embeddingCache = new Map<string, CachedEmbedding>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

/**
 * Generate embedding for a query string
 * Uses in-memory cache to avoid redundant API calls
 */
export async function generateQueryEmbedding(text: string): Promise<{ embedding: number[]; cached: boolean }> {
  const cacheKey = text.toLowerCase().trim()
  const cached = embeddingCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { embedding: cached.embedding, cached: true }
  }
  
  const openai = getOpenAIClient()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  })
  
  const embedding = response.data[0].embedding
  
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  })
  
  return { embedding, cached: false }
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Expand query with related terms for better semantic matching
 */
export function expandQuery(query: string): string {
  const expansions: Record<string, string[]> = {
    'sales': ['selling', 'CRM', 'leads', 'pipeline', 'conversion'],
    'voice': ['calling', 'phone', 'AI voice', 'speech', 'TTS'],
    'automation': ['workflow', 'integration', 'automate', 'n8n', 'zapier'],
    'image': ['graphics', 'visual', 'design', 'generation'],
    'llm': ['AI model', 'language model', 'GPT', 'Claude'],
    'free': ['open source', 'no cost', 'freemium'],
    'local': ['self-hosted', 'on-premise', 'offline'],
    'forklift': ['warehouse', 'material handling', 'industrial', 'equipment'],
  }
  
  let expandedQuery = query
  const queryLower = query.toLowerCase()
  
  for (const [key, values] of Object.entries(expansions)) {
    if (queryLower.includes(key)) {
      expandedQuery += ' ' + values.join(' ')
    }
  }
  
  return expandedQuery
}

/**
 * Perform semantic search on tools
 */
export async function semanticSearch(
  queryEmbedding: number[],
  filters: SearchFilters = {},
  limit: number = 20,
  threshold: number = 0.3,
  queryText: string = ''
): Promise<SearchResult[]> {
  const db = await loadToolsWithEmbeddings()
  const queryLower = queryText.toLowerCase()
  
  // Calculate similarity for all tools that match filters
  const scored = db.tools
    .filter(tool => matchesFilters(tool, filters))
    .map(tool => {
      const similarity = cosineSimilarity(queryEmbedding, tool.embedding)
      return {
        tool,
        similarity,
      }
    })
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
  
  // Convert to SearchResult format (strip embedding)
  return scored.map(({ tool, similarity }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding: _, ...toolWithoutEmbedding } = tool
    return {
      ...toolWithoutEmbedding,
      similarity,
      match_reasons: generateMatchReasons(tool, queryLower),
    }
  })
}

/**
 * Perform hybrid search (semantic + keyword boosting)
 */
export async function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  limit: number = 20,
  semanticWeight: number = 0.7
): Promise<SearchResult[]> {
  const db = await loadToolsWithEmbeddings()
  const queryLower = queryText.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
  
  // Calculate hybrid score for all tools
  const scored = db.tools.map(tool => {
    const semanticScore = cosineSimilarity(queryEmbedding, tool.embedding)
    
    // Keyword score: how many query words appear in the tool
    let keywordScore = 0
    const toolText = [
      tool.name,
      tool.category,
      tool.subcategory,
      tool.description,
      ...(tool.key_features || []),
      ...(tool.skills || []),
      ...(tool.tags || []),
    ].filter(Boolean).join(' ').toLowerCase()
    
    for (const word of queryWords) {
      if (toolText.includes(word)) {
        keywordScore += 1 / queryWords.length
      }
    }
    
    // Combined score
    const hybridScore = (semanticScore * semanticWeight) + (keywordScore * (1 - semanticWeight))
    
    return {
      tool,
      similarity: hybridScore,
      semanticScore,
      keywordScore,
    }
  })
    .filter(item => item.similarity >= 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
  
  // Convert to SearchResult format
  return scored.map(({ tool, similarity }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding: _, ...toolWithoutEmbedding } = tool
    return {
      ...toolWithoutEmbedding,
      similarity,
      match_reasons: generateMatchReasons(tool, queryLower),
    }
  })
}

/**
 * Fallback text search (no embeddings needed)
 */
export async function textSearch(
  queryText: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const db = await loadToolsWithEmbeddings()
  const queryLower = queryText.toLowerCase()
  
  // Simple keyword matching
  const scored = db.tools
    .map(tool => {
      const toolText = [
        tool.name,
        tool.category,
        tool.subcategory,
        tool.description,
        ...(tool.key_features || []),
        ...(tool.skills || []),
        ...(tool.tags || []),
      ].filter(Boolean).join(' ').toLowerCase()
      
      // Score based on keyword presence
      let score = 0
      if (tool.name.toLowerCase().includes(queryLower)) score += 0.5
      if (tool.category.toLowerCase().includes(queryLower)) score += 0.3
      if (toolText.includes(queryLower)) score += 0.2
      
      return { tool, similarity: score }
    })
    .filter(item => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
  
  return scored.map(({ tool, similarity }, index) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { embedding: _, ...toolWithoutEmbedding } = tool
    return {
      ...toolWithoutEmbedding,
      similarity: Math.max(0.5 - (index * 0.02), similarity), // Normalize scores
      match_reasons: ['Keyword match'],
    }
  })
}

/**
 * Get all categories from the loaded database
 */
export async function getCategories(): Promise<string[]> {
  const db = await loadToolsWithEmbeddings()
  return db.metadata.categories || []
}

/**
 * Get database metadata
 */
export async function getMetadata(): Promise<ToolsDatabase['metadata']> {
  const db = await loadToolsWithEmbeddings()
  return db.metadata
}
