'use client'

/**
 * AI Toolkit Panel V3
 * 
 * Enhanced with:
 * - Semantic search using Supabase pgvector
 * - Relevance scoring
 * - Match reason highlighting
 * - Falls back to basic text search if semantic unavailable
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { SemanticSearch } from './ai-toolkit-semantic-search'
import type { SearchResult } from '@/lib/ai-toolkit/use-semantic-search'

// Re-export original types and components from v2
export * from './ai-toolkit-panel'

// =============================================================================
// Types
// =============================================================================

interface FreeTier {
  available: boolean
  details?: string
  limits?: string
}

interface PricingTier {
  price: string
  billing?: string
  features?: string[]
}

interface ForkliftRelevance {
  score: number
  notes?: string
  use_cases?: string[]
}

interface LocalDeployment {
  available: boolean
  requirements?: string
  notes?: string
}

interface VideoLink {
  title: string
  url: string
  type?: string
}

interface Tool {
  id: string
  name: string
  category: string
  subcategory?: string
  description?: string
  url?: string
  pricing_model: string
  pricing_tiers?: Record<string, PricingTier>
  free_tier?: FreeTier
  key_features?: string[]
  pros?: string[]
  cons?: string[]
  video_links?: VideoLink[]
  skills?: string[]
  forklift_relevance?: ForkliftRelevance
  api_available?: boolean
  local_deployment?: LocalDeployment
  integrations?: string[]
  status?: string
  recommendation_tier?: string
  tags?: string[]
  last_updated?: string
  source_file?: string
}

interface StackTemplateTool {
  id: string
  name: string
  role: string
  cost: string
}

interface StackTemplateFlow {
  step: number
  label: string
  description: string
}

interface StackTemplate {
  id: string
  name: string
  description: string
  use_case: string
  icon: string
  tools: StackTemplateTool[]
  total_cost: {
    min: number
    max: number
    currency: string
    period: string
  }
  flow: StackTemplateFlow[]
  integrations_required: string[]
  roi_timeline: string
  revenue_model?: Array<{
    course: string
    price: string
    cost_per_student: string
    margin: string
  }>
}

interface ToolsDatabase {
  metadata: {
    total_tools: number
    last_updated: string
    version: string
    categories: string[]
  }
  tools: Tool[]
  stack_templates?: StackTemplate[]
}

type TabId = 'dashboard' | 'semantic-search' | 'tools' | 'templates' | 'stack-builder' | 'compare'

// =============================================================================
// Constants
// =============================================================================

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
  'Content & Social': '📱',
  'SEO & Marketing': '📈',
  'Research & Search': '🔍',
  'AI Infrastructure': '🏗️',
  'Finance & Business': '💰',
  'Mobile Apps': '📲',
  'Development & Deployment': '🚀',
  'AI Personas & Avatars': '👤',
  'Miscellaneous': '🔧',
}

const TIER_COLORS: Record<string, string> = {
  'tier_1_essential': 'bg-green-500/20 text-green-400 border-green-500/30',
  'tier_2_recommended': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'tier_3_optional': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'tier_4_niche': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'not_recommended': 'bg-red-500/20 text-red-400 border-red-500/30',
}

const TIER_LABELS: Record<string, string> = {
  'tier_1_essential': 'Essential',
  'tier_2_recommended': 'Recommended',
  'tier_3_optional': 'Optional',
  'tier_4_niche': 'Niche',
  'not_recommended': 'Not Recommended',
}

const PRICING_COLORS: Record<string, string> = {
  'free': 'bg-green-500/20 text-green-400',
  'freemium': 'bg-blue-500/20 text-blue-400',
  'open-source': 'bg-purple-500/20 text-purple-400',
  'paid': 'bg-yellow-500/20 text-yellow-400',
  'enterprise': 'bg-orange-500/20 text-orange-400',
}

// =============================================================================
// Main Panel Component (V3)
// =============================================================================

export function AIToolkitPanelV3() {
  const [activeTab, setActiveTab] = useState<TabId>('semantic-search')
  const [database, setDatabase] = useState<ToolsDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [semanticEnabled, setSemanticEnabled] = useState(true)

  // Load tools database
  useEffect(() => {
    loadDatabase()
    checkSemanticStatus()
  }, [])

  const loadDatabase = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/ai-toolkit')
      if (!res.ok) throw new Error('Failed to load AI toolkit database')
      const data = await res.json()
      setDatabase(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database')
    } finally {
      setLoading(false)
    }
  }

  // Check if semantic search is available
  const checkSemanticStatus = async () => {
    try {
      const res = await fetch('/api/ai-toolkit/search?q=test&limit=1')
      setSemanticEnabled(res.ok)
    } catch {
      setSemanticEnabled(false)
    }
  }

  // Handle semantic search result selection
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    // Convert SearchResult to Tool format and show details
    const tool: Tool = {
      id: result.id,
      name: result.name,
      category: result.category,
      subcategory: result.subcategory,
      description: result.description,
      pricing_model: result.pricing_model,
      pricing_tiers: result.pricing_tiers,
      free_tier: result.free_tier,
      key_features: result.key_features,
      pros: result.pros,
      cons: result.cons,
      skills: result.skills,
      tags: result.tags,
      forklift_relevance: result.forklift_relevance,
      api_available: result.api_available,
      local_deployment: result.local_deployment,
      video_links: result.video_links,
      integrations: result.integrations,
      status: result.status,
      recommendation_tier: result.recommendation_tier,
      source_file: result.source_file,
      last_updated: result.last_updated,
    }
    setSelectedTool(tool)
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading AI Toolkit V3...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-red-400">{error}</p>
          <Button onClick={loadDatabase} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!database) return null

  const tabs: { id: TabId; label: string; icon: string; badge?: string }[] = [
    { id: 'semantic-search', label: 'AI Search', icon: '🔮', badge: semanticEnabled ? 'NEW' : undefined },
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'tools', label: 'Browse', icon: '🔧' },
    { id: 'templates', label: 'Templates', icon: '📋' },
    { id: 'stack-builder', label: 'Builder', icon: '🏗️' },
    { id: 'compare', label: 'Compare', icon: '⚖️' },
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-xl">
            🛠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">AI Toolkit</h2>
              <span className="px-2 py-0.5 text-xs rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
                V3
              </span>
              {semanticEnabled && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                  🔮 Semantic
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {database.metadata.total_tools} tools • AI-powered search
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-1'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.badge && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-400 animate-pulse">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'semantic-search' && (
          <SemanticSearchView 
            onSelectTool={handleSelectSearchResult}
            semanticEnabled={semanticEnabled}
          />
        )}
        {activeTab === 'dashboard' && <QuickStatsView database={database} onNavigate={setActiveTab} />}
        {activeTab === 'tools' && <BrowseToolsView database={database} />}
        {activeTab === 'templates' && <div className="p-4 text-muted-foreground">Templates (use V2 panel)</div>}
        {activeTab === 'stack-builder' && <div className="p-4 text-muted-foreground">Stack Builder (use V2 panel)</div>}
        {activeTab === 'compare' && <div className="p-4 text-muted-foreground">Compare (use V2 panel)</div>}
      </div>

      {/* Tool Detail Modal */}
      {selectedTool && (
        <ToolDetailModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  )
}

// =============================================================================
// Semantic Search View
// =============================================================================

function SemanticSearchView({ 
  onSelectTool, 
  semanticEnabled 
}: { 
  onSelectTool: (result: SearchResult) => void
  semanticEnabled: boolean 
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Status Banner */}
      {!semanticEnabled && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <span className="font-medium">Semantic search unavailable</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supabase connection not configured. Using fallback text search.
          </p>
        </div>
      )}
      
      {/* Main Search Component */}
      <SemanticSearch onSelectTool={onSelectTool} />
    </div>
  )
}

// =============================================================================
// Quick Stats View
// =============================================================================

function QuickStatsView({ database, onNavigate }: { database: ToolsDatabase; onNavigate: (tab: TabId) => void }) {
  const stats = useMemo(() => {
    const tools = database.tools
    const tier1 = tools.filter(t => t.recommendation_tier === 'tier_1_essential').length
    const freeTierCount = tools.filter(t => t.free_tier?.available).length
    const withApi = tools.filter(t => t.api_available).length

    const byCategory = tools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { tier1, freeTierCount, withApi, byCategory }
  }, [database.tools])

  return (
    <div className="p-4 space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="🛠️" label="Total Tools" value={database.metadata.total_tools} color="violet" />
        <StatCard icon="⭐" label="Essential" value={stats.tier1} color="green" />
        <StatCard icon="🆓" label="Free Tier" value={stats.freeTierCount} color="blue" />
        <StatCard icon="🔌" label="Has API" value={stats.withApi} color="purple" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('semantic-search')}
          className="p-6 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/30 text-left hover:border-violet-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔮</span>
            <span className="text-lg font-semibold text-foreground group-hover:text-violet-400 transition-colors">
              Semantic Search
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Find tools using natural language. Describe what you need and AI will find the best matches.
          </p>
        </button>

        <button
          onClick={() => onNavigate('tools')}
          className="p-6 bg-surface-1 rounded-lg border border-border text-left hover:border-primary/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔧</span>
            <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              Browse All Tools
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Filter and explore the complete toolkit by category, pricing, and tier.
          </p>
        </button>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Categories</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([category, count]) => (
              <div
                key={category}
                className="p-3 bg-surface-1 rounded-lg border border-border text-sm"
              >
                <span className="mr-2">{CATEGORY_ICONS[category] || '🔧'}</span>
                <span className="text-foreground">{category}</span>
                <span className="text-muted-foreground ml-1">({count})</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    violet: 'from-violet-500/20 to-purple-500/20',
    green: 'from-green-500/20 to-emerald-500/20',
    blue: 'from-blue-500/20 to-cyan-500/20',
    purple: 'from-purple-500/20 to-pink-500/20',
  }

  return (
    <div className={`p-4 rounded-lg bg-gradient-to-br ${colorClasses[color]} border border-border`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  )
}

// =============================================================================
// Browse Tools View (Basic version)
// =============================================================================

function BrowseToolsView({ database }: { database: ToolsDatabase }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const categories = useMemo(() => {
    const cats = [...new Set(database.tools.map(t => t.category))]
    return cats.sort()
  }, [database.tools])

  const filteredTools = useMemo(() => {
    return database.tools.filter(tool => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches = 
          tool.name.toLowerCase().includes(q) ||
          tool.description?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false
      return true
    })
  }, [database.tools, searchQuery, categoryFilter])

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-4 border-b border-border flex gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Quick search..."
          className="flex-1 max-w-md bg-surface-1 text-foreground border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-surface-1 text-foreground border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <span className="self-center text-sm text-muted-foreground">
          {filteredTools.length} tools
        </span>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTools.map(tool => (
            <div
              key={tool.id}
              className="p-4 bg-surface-1 rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{tool.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                      {tool.pricing_model}
                    </span>
                    {tool.recommendation_tier && TIER_LABELS[tool.recommendation_tier] && (
                      <span className={`px-2 py-0.5 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                        {TIER_LABELS[tool.recommendation_tier]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Tool Detail Modal
// =============================================================================

function ToolDetailModal({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-card rounded-lg border border-border shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
            <div>
              <h3 className="font-semibold text-foreground">{tool.name}</h3>
              <p className="text-xs text-muted-foreground">{tool.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-foreground">{tool.description}</p>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
              {tool.pricing_model}
            </span>
            {tool.recommendation_tier && TIER_LABELS[tool.recommendation_tier] && (
              <span className={`px-2 py-1 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                {TIER_LABELS[tool.recommendation_tier]}
              </span>
            )}
            {tool.free_tier?.available && (
              <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">Free Tier</span>
            )}
            {tool.api_available && (
              <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">API</span>
            )}
          </div>
          
          {/* Features */}
          {tool.key_features && tool.key_features.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Features</h4>
              <ul className="space-y-1">
                {tool.key_features.map((f, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Forklift Relevance */}
          {tool.forklift_relevance && tool.forklift_relevance.score > 0 && (
            <div className="p-3 bg-surface-1 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span>🏭</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Business Relevance</span>
                <span className="ml-auto px-2 py-0.5 text-xs rounded bg-primary/20 text-primary font-semibold">
                  {tool.forklift_relevance.score}/10
                </span>
              </div>
              {tool.forklift_relevance.notes && (
                <p className="text-sm text-foreground">{tool.forklift_relevance.notes}</p>
              )}
            </div>
          )}
          
          {/* URL */}
          {tool.url && (
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm text-center hover:bg-primary/90 transition-colors"
            >
              Visit Website →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIToolkitPanelV3
