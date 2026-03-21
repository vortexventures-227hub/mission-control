'use client'

import { useState, useMemo } from 'react'
import { 
  useSemanticSearch, 
  formatSimilarity, 
  getSimilarityColor,
  getSimilarityLabel,
  SearchResult,
  SearchFilters 
} from '@/lib/ai-toolkit/use-semantic-search'

// =============================================================================
// Semantic Search Component
// =============================================================================

interface SemanticSearchProps {
  onSelectTool?: (tool: SearchResult) => void
  className?: string
}

export function SemanticSearch({ onSelectTool, className = '' }: SemanticSearchProps) {
  const [showFilters, setShowFilters] = useState(false)
  
  const {
    state,
    setQuery,
    setFilters,
    search,
    clearResults,
    filters,
  } = useSemanticSearch({
    debounceMs: 400,
    minQueryLength: 2,
    limit: 20,
    threshold: 0.25,
    autoSearch: true,
  })
  
  // Category options (hardcoded for now, could fetch from API)
  const categories = [
    'LLMs',
    'Voice & Sales',
    'Image Generation',
    'Video Generation',
    'Coding Agents',
    'Agent Platforms',
    'Automation & Scraping',
    'Sales & CRM',
    'Communication',
    'Databases & Memory',
    'Frameworks & Libraries',
    'Design & Creative',
    'Mobile Apps',
    'Development & Deployment',
    'AI Personas & Avatars',
  ]
  
  const pricingModels = ['free', 'freemium', 'open-source', 'paid', 'enterprise']
  const tiers = [
    { value: 'tier_1_essential', label: 'Essential' },
    { value: 'tier_2_recommended', label: 'Recommended' },
    { value: 'tier_3_optional', label: 'Optional' },
  ]
  
  // Handle filter changes
  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={state.query || ''}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search with natural language... e.g. 'AI for 24/7 phone sales' or 'free local LLM'"
          className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-3 pl-10 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔮</span>
        
        {/* Search Type Badge */}
        {state.searchType && (
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs rounded ${
            state.searchType === 'semantic' ? 'bg-violet-500/20 text-violet-400' :
            state.searchType === 'hybrid' ? 'bg-blue-500/20 text-blue-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
            {state.searchType}
          </span>
        )}
        
        {/* Loading Spinner */}
        {state.isLoading && (
          <div className="absolute right-16 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Filter Toggle & Clear */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
            showFilters 
              ? 'bg-primary/10 border-primary/50 text-primary' 
              : 'bg-surface-1 border-border text-muted-foreground hover:border-primary/30'
          }`}
        >
          {showFilters ? '🔽 Hide Filters' : '🔧 Filters'}
        </button>
        
        {(state.results.length > 0 || state.query) && (
          <button
            onClick={clearResults}
            className="px-3 py-1.5 text-xs rounded-lg border bg-surface-1 border-border text-muted-foreground hover:border-red-500/30 hover:text-red-400 transition-colors"
          >
            ✕ Clear
          </button>
        )}
        
        {state.processingTime && (
          <span className="ml-auto text-xs text-muted-foreground">
            {state.total} results in {state.processingTime}ms
          </span>
        )}
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-surface-1 rounded-lg border border-border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => updateFilter('category', e.target.value || undefined)}
                className="w-full bg-surface-2 text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {/* Pricing Model */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Pricing</label>
              <select
                value={filters.pricingModel || ''}
                onChange={(e) => updateFilter('pricingModel', e.target.value || undefined)}
                className="w-full bg-surface-2 text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Pricing</option>
                {pricingModels.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            
            {/* Tier */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tier</label>
              <select
                value={filters.recommendationTier || ''}
                onChange={(e) => updateFilter('recommendationTier', e.target.value || undefined)}
                className="w-full bg-surface-2 text-foreground border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Tiers</option>
                {tiers.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Toggle Filters */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasFreeTier || false}
                onChange={(e) => updateFilter('hasFreeTier', e.target.checked || undefined)}
                className="w-4 h-4 rounded border-border bg-surface-2 text-primary focus:ring-primary/50"
              />
              <span className="text-sm text-foreground">Has Free Tier</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasApi || false}
                onChange={(e) => updateFilter('hasApi', e.target.checked || undefined)}
                className="w-4 h-4 rounded border-border bg-surface-2 text-primary focus:ring-primary/50"
              />
              <span className="text-sm text-foreground">API Available</span>
            </label>
          </div>
        </div>
      )}
      
      {/* Error */}
      {state.error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {state.error}
        </div>
      )}
      
      {/* Results */}
      {state.results.length > 0 && (
        <div className="space-y-2">
          {state.results.map(tool => (
            <SearchResultCard 
              key={tool.id} 
              tool={tool} 
              onSelect={onSelectTool}
            />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!state.isLoading && state.query && state.query.length >= 2 && state.results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-3xl mb-2">🔍</div>
          <p>No tools match your search</p>
          <p className="text-xs mt-1">Try different keywords or adjust filters</p>
        </div>
      )}
      
      {/* Tips when empty */}
      {!state.query && (
        <div className="p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/20">
          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
            <span>🔮</span> Semantic Search Tips
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Describe what you need: <span className="text-foreground">"AI that answers phone calls 24/7"</span></li>
            <li>• Specify constraints: <span className="text-foreground">"free image generator with API"</span></li>
            <li>• Ask questions: <span className="text-foreground">"what tool can automate lead follow-ups?"</span></li>
            <li>• Use business context: <span className="text-foreground">"forklift sales automation"</span></li>
          </ul>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Search Result Card
// =============================================================================

interface SearchResultCardProps {
  tool: SearchResult
  onSelect?: (tool: SearchResult) => void
}

const CATEGORY_ICONS: Record<string, string> = {
  'LLMs': '🧠',
  'Voice & Sales': '🎙️',
  'Image Generation': '🎨',
  'Video Generation': '🎬',
  'Coding Agents': '💻',
  'Agent Platforms': '🤖',
  'Automation & Scraping': '⚡',
  'Sales & CRM': '📊',
  'Communication': '💬',
  'Databases & Memory': '🗄️',
  'Frameworks & Libraries': '📚',
  'Design & Creative': '✨',
  'Mobile Apps': '📲',
  'Development & Deployment': '🚀',
  'AI Personas & Avatars': '👤',
}

const TIER_COLORS: Record<string, string> = {
  'tier_1_essential': 'bg-green-500/20 text-green-400 border-green-500/30',
  'tier_2_recommended': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'tier_3_optional': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

const TIER_LABELS: Record<string, string> = {
  'tier_1_essential': 'Essential',
  'tier_2_recommended': 'Recommended',
  'tier_3_optional': 'Optional',
}

const PRICING_COLORS: Record<string, string> = {
  'free': 'bg-green-500/20 text-green-400',
  'freemium': 'bg-blue-500/20 text-blue-400',
  'open-source': 'bg-purple-500/20 text-purple-400',
  'paid': 'bg-yellow-500/20 text-yellow-400',
  'enterprise': 'bg-orange-500/20 text-orange-400',
}

function SearchResultCard({ tool, onSelect }: SearchResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div 
      className="bg-surface-1 rounded-lg border border-border overflow-hidden hover:border-primary/30 transition-colors"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{tool.name}</span>
              
              {/* Similarity Score */}
              <span className={`px-2 py-0.5 text-xs rounded-full bg-violet-500/20 ${getSimilarityColor(tool.similarity)}`}>
                {formatSimilarity(tool.similarity)} match
              </span>
              
              {/* Tier Badge */}
              {tool.recommendation_tier && TIER_LABELS[tool.recommendation_tier] && (
                <span className={`px-2 py-0.5 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                  {TIER_LABELS[tool.recommendation_tier]}
                </span>
              )}
              
              {/* Pricing Badge */}
              <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model] || 'bg-gray-500/20 text-gray-400'}`}>
                {tool.pricing_model}
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {tool.description}
            </p>
            
            {/* Match Reasons */}
            {tool.match_reasons && tool.match_reasons.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tool.match_reasons.slice(0, 3).map((reason, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <span className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border">
          {/* Key Features */}
          {tool.key_features && tool.key_features.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Features</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {tool.key_features.slice(0, 6).map((feature, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Integrations */}
          {tool.integrations && tool.integrations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-400 uppercase mb-2">🔗 Integrations</h4>
              <div className="flex flex-wrap gap-1">
                {tool.integrations.slice(0, 10).map((integration, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                    {integration}
                  </span>
                ))}
                {tool.integrations.length > 10 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{tool.integrations.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Forklift Relevance */}
          {tool.forklift_relevance && tool.forklift_relevance.score > 0 && (
            <div className="p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏭</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Business Relevance</span>
                <span className="ml-auto px-2 py-0.5 text-xs rounded bg-primary/20 text-primary font-semibold">
                  {tool.forklift_relevance.score}/10
                </span>
              </div>
              {tool.forklift_relevance.notes && (
                <p className="text-sm text-foreground">{tool.forklift_relevance.notes}</p>
              )}
              {tool.forklift_relevance.use_cases && tool.forklift_relevance.use_cases.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tool.forklift_relevance.use_cases.map((uc, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {uc}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Actions */}
          {onSelect && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => onSelect(tool)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
              >
                View Details →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SemanticSearch
