import { NextRequest, NextResponse } from 'next/server'
import {
  semanticSearch,
  hybridSearch,
  textSearch,
  generateQueryEmbedding,
  expandQuery,
  type SearchFilters,
  type SearchResult,
} from '@/lib/vector-search'

// =============================================================================
// Types
// =============================================================================

interface SemanticSearchResponse {
  query: string
  results: SearchResult[]
  total: number
  searchType: 'semantic' | 'hybrid' | 'fallback'
  processingTime: number
  embedding_cached?: boolean
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
      
      // Generate embedding for the query
      const { embedding: queryEmbedding, cached } = await generateQueryEmbedding(expandedQuery)
      embeddingCached = cached
      
      // Determine search strategy
      if (searchType === 'hybrid' || (searchType === 'auto' && query.split(' ').length > 3)) {
        // Use hybrid search for longer queries
        actualSearchType = 'hybrid'
        results = await hybridSearch(queryEmbedding, query, limit)
      } else {
        // Use pure semantic search
        actualSearchType = 'semantic'
        results = await semanticSearch(queryEmbedding, filters, limit, threshold, query)
      }
      
    } catch (embeddingError) {
      console.error('Embedding/search error, falling back to text search:', embeddingError)
      
      // Fallback to basic text search
      actualSearchType = 'fallback'
      results = await textSearch(query, limit)
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
          const { embedding } = await generateQueryEmbedding(expandedQuery)
          const searchResults = await semanticSearch(embedding, filters, limit, threshold, query)
          
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
