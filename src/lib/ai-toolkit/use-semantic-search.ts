/**
 * useSemanticSearch - React hook for AI Toolkit semantic search
 * 
 * Features:
 * - Debounced search queries
 * - Loading/error states
 * - Caching of recent results
 * - Filter support
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface SearchResult {
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

export interface SearchFilters {
  category?: string
  pricingModel?: string
  recommendationTier?: string
  hasFreeTier?: boolean
  hasApi?: boolean
  tags?: string[]
}

export interface SemanticSearchState {
  query: string
  results: SearchResult[]
  isLoading: boolean
  error: string | null
  searchType: 'semantic' | 'hybrid' | 'fallback' | null
  processingTime: number | null
  total: number
}

export interface UseSemanticSearchOptions {
  debounceMs?: number
  minQueryLength?: number
  limit?: number
  threshold?: number
  autoSearch?: boolean
}

// =============================================================================
// Simple debounce utility
// =============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

// =============================================================================
// Main Hook
// =============================================================================

export function useSemanticSearch(
  options: UseSemanticSearchOptions = {}
): {
  state: SemanticSearchState
  setQuery: (query: string) => void
  setFilters: (filters: SearchFilters) => void
  search: (query?: string) => Promise<void>
  clearResults: () => void
  filters: SearchFilters
} {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    limit = 20,
    threshold = 0.3,
    autoSearch = true,
  } = options
  
  // State
  const [query, setQueryState] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({})
  const [state, setState] = useState<SemanticSearchState>({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    searchType: null,
    processingTime: null,
    total: 0,
  })
  
  // Cache for recent searches
  const cacheRef = useRef<Map<string, { results: SearchResult[]; timestamp: number }>>(new Map())
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  
  // Debounced query
  const debouncedQuery = useDebounce(query, debounceMs)
  
  // Build cache key
  const buildCacheKey = useCallback((q: string, f: SearchFilters): string => {
    return JSON.stringify({ q: q.toLowerCase().trim(), f })
  }, [])
  
  // Search function
  const search = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim()
    
    if (q.length < minQueryLength) {
      setState(prev => ({
        ...prev,
        results: [],
        isLoading: false,
        error: null,
        searchType: null,
        total: 0,
      }))
      return
    }
    
    // Check cache
    const cacheKey = buildCacheKey(q, filters)
    const cached = cacheRef.current.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(prev => ({
        ...prev,
        query: q,
        results: cached.results,
        isLoading: false,
        error: null,
        total: cached.results.length,
      }))
      return
    }
    
    // Start loading
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      // Build URL with params
      const params = new URLSearchParams({
        q,
        limit: limit.toString(),
        threshold: threshold.toString(),
      })
      
      if (filters.category) params.set('category', filters.category)
      if (filters.pricingModel) params.set('pricing', filters.pricingModel)
      if (filters.recommendationTier) params.set('tier', filters.recommendationTier)
      if (filters.hasFreeTier !== undefined) params.set('freeTier', filters.hasFreeTier.toString())
      if (filters.hasApi !== undefined) params.set('hasApi', filters.hasApi.toString())
      if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','))
      
      const response = await fetch(`/api/ai-toolkit/search?${params}`)
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Cache results
      cacheRef.current.set(cacheKey, {
        results: data.results,
        timestamp: Date.now(),
      })
      
      // Prune old cache entries
      if (cacheRef.current.size > 50) {
        const now = Date.now()
        for (const [key, value] of cacheRef.current.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            cacheRef.current.delete(key)
          }
        }
      }
      
      setState({
        query: q,
        results: data.results,
        isLoading: false,
        error: null,
        searchType: data.searchType,
        processingTime: data.processingTime,
        total: data.total,
      })
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }))
    }
  }, [query, filters, minQueryLength, limit, threshold, buildCacheKey])
  
  // Auto-search on debounced query change
  useEffect(() => {
    if (autoSearch && debouncedQuery.length >= minQueryLength) {
      search(debouncedQuery)
    } else if (debouncedQuery.length < minQueryLength) {
      setState(prev => ({
        ...prev,
        results: [],
        searchType: null,
        total: 0,
      }))
    }
  }, [debouncedQuery, autoSearch, minQueryLength, search])
  
  // Clear results
  const clearResults = useCallback(() => {
    setQueryState('')
    setState({
      query: '',
      results: [],
      isLoading: false,
      error: null,
      searchType: null,
      processingTime: null,
      total: 0,
    })
  }, [])
  
  return {
    state,
    setQuery: setQueryState,
    setFilters,
    search,
    clearResults,
    filters,
  }
}

// =============================================================================
// Utility: Format similarity score for display
// =============================================================================

export function formatSimilarity(score: number): string {
  const percentage = Math.round(score * 100)
  return `${percentage}%`
}

export function getSimilarityColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-blue-400'
  if (score >= 0.4) return 'text-yellow-400'
  return 'text-muted-foreground'
}

export function getSimilarityLabel(score: number): string {
  if (score >= 0.8) return 'Excellent match'
  if (score >= 0.6) return 'Good match'
  if (score >= 0.4) return 'Fair match'
  return 'Weak match'
}
