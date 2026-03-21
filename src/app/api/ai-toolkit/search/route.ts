import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// Types
// =============================================================================

interface SearchFilters {
  category?: string
  pricingModel?: string
  recommendationTier?: string
  hasFreeTier?: boolean
  hasApi?: boolean
  tags?: string[]
}

interface SearchResult {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  pricing_model: string
  pricing_tiers?: Record<string, any>
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

interface SemanticSearchResponse {
  query: string
  results: SearchResult[]
  total: number
  searchType: 'semantic' | 'hybrid' | 'fallback'
  processingTime: number
  embedding_cached?: boolean
}

// =============================================================================
// Clients
// =============================================================================

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for RLS bypass on search
  {
    auth: { persistSession: false }
  }
)

// Simple in-memory cache for embeddings (production: use Redis)
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate embedding for a query string using OpenAI
 * Uses text-embedding-3-small for cost efficiency (1536 dimensions)
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cacheKey = text.toLowerCase().trim()
  const cached = embeddingCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.embedding
  }
  
  // Generate new embedding
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  })
  
  const embedding = response.data[0].embedding
  
  // Cache it
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  })
  
  return embedding
}

/**
 * Perform semantic search using Supabase pgvector
 */
async function semanticSearch(
  queryEmbedding: number[],
  filters: SearchFilters,
  limit: number = 20,
  threshold: number = 0.3
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_ai_tools', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_category: filters.category || null,
    filter_pricing_model: filters.pricingModel || null,
    filter_recommendation_tier: filters.recommendationTier || null,
    filter_has_free_tier: filters.hasFreeTier ?? null,
    filter_has_api: filters.hasApi ?? null,
    filter_tags: filters.tags || null,
  })
  
  if (error) {
    console.error('Semantic search error:', error)
    throw new Error(`Semantic search failed: ${error.message}`)
  }
  
  return data || []
}

/**
 * Perform hybrid search (semantic + keyword) using Supabase
 */
async function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  limit: number = 20,
  semanticWeight: number = 0.7
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('hybrid_search_ai_tools', {
    query_embedding: queryEmbedding,
    query_text: queryText,
    semantic_weight: semanticWeight,
    keyword_weight: 1 - semanticWeight,
    match_threshold: 0.2,
    match_count: limit,
  })
  
  if (error) {
    console.error('Hybrid search error:', error)
    throw new Error(`Hybrid search failed: ${error.message}`)
  }
  
  return data || []
}

/**
 * Fallback to basic text search if Supabase/embeddings fail
 */
async function fallbackTextSearch(
  queryText: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('ai_tools')
    .select('*')
    .or(`name.ilike.%${queryText}%,description.ilike.%${queryText}%,category.ilike.%${queryText}%`)
    .limit(limit)
  
  if (error) {
    console.error('Fallback search error:', error)
    return []
  }
  
  // Add placeholder similarity scores
  return (data || []).map((tool, index) => ({
    ...tool,
    similarity: 1 - (index * 0.05), // Decreasing "relevance"
    match_reasons: ['Keyword match'],
  }))
}

/**
 * Expand query with related terms for better semantic matching
 */
function expandQuery(query: string): string {
  // Common expansions for forklift business context
  const expansions: Record<string, string[]> = {
    'sales': ['selling', 'CRM', 'leads', 'pipeline', 'conversion'],
    'voice': ['calling', 'phone', 'AI voice', 'speech', 'TTS'],
    'automation': ['workflow', 'integration', 'automate', 'n8n', 'zapier'],
    'image': ['graphics', 'visual', 'design', 'generation'],
    'llm': ['AI model', 'language model', 'GPT', 'Claude'],
    'free': ['open source', 'no cost', 'freemium'],
    'local': ['self-hosted', 'on-premise', 'offline'],
  }
  
  let expandedQuery = query
  
  for (const [key, values] of Object.entries(expansions)) {
    if (query.toLowerCase().includes(key)) {
      expandedQuery += ' ' + values.join(' ')
    }
  }
  
  return expandedQuery
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parse query parameters
    const query = searchParams.get('q') || searchParams.get('query') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const searchType = searchParams.get('type') as 'semantic' | 'hybrid' | 'auto' || 'auto'
    const threshold = parseFloat(searchParams.get('threshold') || '0.3')
    
    // Parse filters
    const filters: SearchFilters = {
      category: searchParams.get('category') || undefined,
      pricingModel: searchParams.get('pricing') || undefined,
      recommendationTier: searchParams.get('tier') || undefined,
      hasFreeTier: searchParams.get('freeTier') === 'true' ? true : 
                   searchParams.get('freeTier') === 'false' ? false : undefined,
      hasApi: searchParams.get('hasApi') === 'true' ? true :
              searchParams.get('hasApi') === 'false' ? false : undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
    }
    
    // Validate query
    if (!query.trim()) {
      return NextResponse.json({
        error: 'Query parameter is required',
        usage: {
          endpoint: '/api/ai-toolkit/search',
          params: {
            'q or query': 'Search query (required)',
            limit: 'Max results (default: 20, max: 50)',
            type: 'Search type: semantic, hybrid, auto (default: auto)',
            threshold: 'Similarity threshold 0-1 (default: 0.3)',
            category: 'Filter by category',
            pricing: 'Filter by pricing model',
            tier: 'Filter by recommendation tier',
            freeTier: 'Filter by free tier availability (true/false)',
            hasApi: 'Filter by API availability (true/false)',
            tags: 'Filter by tags (comma-separated)',
          },
          examples: [
            '/api/ai-toolkit/search?q=voice+ai+for+sales',
            '/api/ai-toolkit/search?q=free+image+generation&freeTier=true',
            '/api/ai-toolkit/search?q=automation&category=Automation+%26+Scraping',
          ],
        },
      }, { status: 400 })
    }
    
    let results: SearchResult[] = []
    let actualSearchType: 'semantic' | 'hybrid' | 'fallback' = 'semantic'
    let embeddingCached = false
    
    try {
      // Expand query for better semantic matching
      const expandedQuery = expandQuery(query)
      
      // Check if embedding was cached
      const cacheKey = expandedQuery.toLowerCase().trim()
      embeddingCached = embeddingCache.has(cacheKey)
      
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(expandedQuery)
      
      // Determine search strategy
      if (searchType === 'hybrid' || (searchType === 'auto' && query.split(' ').length > 3)) {
        // Use hybrid search for longer queries
        actualSearchType = 'hybrid'
        results = await hybridSearch(queryEmbedding, query, limit)
      } else {
        // Use pure semantic search
        actualSearchType = 'semantic'
        results = await semanticSearch(queryEmbedding, filters, limit, threshold)
      }
      
    } catch (embeddingError) {
      console.error('Embedding/search error, falling back to text search:', embeddingError)
      
      // Fallback to basic text search
      actualSearchType = 'fallback'
      results = await fallbackTextSearch(query, limit)
    }
    
    // Build response
    const response: SemanticSearchResponse = {
      query,
      results,
      total: results.length,
      searchType: actualSearchType,
      processingTime: Date.now() - startTime,
      embedding_cached: embeddingCached,
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Search-Type': actualSearchType,
        'X-Processing-Time': `${response.processingTime}ms`,
      },
    })
    
  } catch (error) {
    console.error('Search API error:', error)
    
    return NextResponse.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // POST endpoint for batch search or complex queries
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    
    const {
      queries = [],
      filters = {},
      limit = 10,
      threshold = 0.3,
    } = body
    
    if (!Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({
        error: 'Queries array is required',
        usage: {
          body: {
            queries: ['query1', 'query2'],
            filters: { category: 'LLMs' },
            limit: 10,
            threshold: 0.3,
          },
        },
      }, { status: 400 })
    }
    
    if (queries.length > 10) {
      return NextResponse.json({
        error: 'Maximum 10 queries per batch',
      }, { status: 400 })
    }
    
    // Process queries in parallel
    const results = await Promise.all(
      queries.map(async (query: string) => {
        try {
          const expandedQuery = expandQuery(query)
          const embedding = await generateEmbedding(expandedQuery)
          const searchResults = await semanticSearch(embedding, filters, limit, threshold)
          
          return {
            query,
            results: searchResults,
            success: true,
          }
        } catch (error) {
          return {
            query,
            results: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )
    
    return NextResponse.json({
      results,
      total_queries: queries.length,
      processingTime: Date.now() - startTime,
    })
    
  } catch (error) {
    console.error('Batch search API error:', error)
    
    return NextResponse.json({
      error: 'Batch search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
