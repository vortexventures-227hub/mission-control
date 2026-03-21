'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'

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

interface ToolsDatabase {
  metadata: {
    total_tools: number
    last_updated: string
    version: string
    categories: string[]
  }
  tools: Tool[]
}

type TabId = 'dashboard' | 'tools' | 'stack-builder' | 'compare'

// =============================================================================
// Category Icons
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
// Main Panel Component
// =============================================================================

export function AIToolkitPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [database, setDatabase] = useState<ToolsDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load tools database
  useEffect(() => {
    loadDatabase()
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading AI Toolkit...</p>
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

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'tools', label: 'Browse Tools', icon: '🔧' },
    { id: 'stack-builder', label: 'Stack Builder', icon: '🏗️' },
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
            <h2 className="text-lg font-semibold text-foreground">AI Toolkit</h2>
            <p className="text-sm text-muted-foreground">
              {database.metadata.total_tools} tools across {database.metadata.categories.length} categories
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
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardView database={database} onNavigate={setActiveTab} />}
        {activeTab === 'tools' && <ToolsBrowserView database={database} />}
        {activeTab === 'stack-builder' && <StackBuilderView database={database} />}
        {activeTab === 'compare' && <CompareView database={database} />}
      </div>
    </div>
  )
}

// =============================================================================
// Dashboard View
// =============================================================================

function DashboardView({ database, onNavigate }: { database: ToolsDatabase; onNavigate: (tab: TabId) => void }) {
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate stats
  const stats = useMemo(() => {
    const tools = database.tools
    const tier1 = tools.filter(t => t.recommendation_tier === 'tier_1_essential').length
    const freeTierCount = tools.filter(t => t.free_tier?.available).length
    const withApi = tools.filter(t => t.api_available).length

    // Group by category
    const byCategory = tools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { tier1, freeTierCount, withApi, byCategory }
  }, [database.tools])

  // Filter tools by search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return database.tools
      .filter(t => 
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
      .slice(0, 5)
  }, [searchQuery, database.tools])

  return (
    <div className="p-4 space-y-6">
      {/* Search Bar */}
      <div className="relative max-w-xl">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tools by name, description, or tags..."
          className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {searchResults.map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  setSearchQuery('')
                  onNavigate('tools')
                }}
                className="w-full px-4 py-3 text-left hover:bg-surface-1 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{tool.category}</div>
                </div>
                {tool.recommendation_tier && (
                  <span className={`px-2 py-0.5 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                    {TIER_LABELS[tool.recommendation_tier]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="🛠️"
          label="Total Tools"
          value={database.metadata.total_tools}
          color="violet"
        />
        <StatCard
          icon="⭐"
          label="Tier-1 Essential"
          value={stats.tier1}
          color="green"
        />
        <StatCard
          icon="🆓"
          label="Free Tier Available"
          value={stats.freeTierCount}
          color="blue"
        />
        <StatCard
          icon="🔌"
          label="API Available"
          value={stats.withApi}
          color="purple"
        />
      </div>

      {/* Category Cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Categories</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(stats.byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => (
              <button
                key={category}
                onClick={() => onNavigate('tools')}
                className="p-4 bg-surface-1 hover:bg-surface-2 rounded-lg border border-border transition-colors text-left group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{CATEGORY_ICONS[category] || '🔧'}</span>
                  <span className="text-lg font-semibold text-foreground">{count}</span>
                </div>
                <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {category}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Tier-1 Essentials Quick Look */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Tier-1 Essentials</h3>
          <button
            onClick={() => onNavigate('tools')}
            className="text-xs text-primary hover:underline"
          >
            View all →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {database.tools
            .filter(t => t.recommendation_tier === 'tier_1_essential')
            .slice(0, 6)
            .map(tool => (
              <div
                key={tool.id}
                className="p-4 bg-surface-1 rounded-lg border border-green-500/30"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{tool.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                        {tool.pricing_model}
                      </span>
                      {tool.free_tier?.available && (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                          Free tier
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
// Tools Browser View
// =============================================================================

function ToolsBrowserView({ database }: { database: ToolsDatabase }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [pricingFilter, setPricingFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

  // Get unique values for filters
  const categories = useMemo(() => {
    const cats = [...new Set(database.tools.map(t => t.category))]
    return cats.sort()
  }, [database.tools])

  const pricingModels = ['free', 'freemium', 'open-source', 'paid', 'enterprise']
  const tiers = ['tier_1_essential', 'tier_2_recommended', 'tier_3_optional', 'tier_4_niche', 'not_recommended']

  // Filter tools
  const filteredTools = useMemo(() => {
    return database.tools.filter(tool => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches = 
          tool.name.toLowerCase().includes(q) ||
          tool.description?.toLowerCase().includes(q) ||
          tool.tags?.some(tag => tag.toLowerCase().includes(q))
        if (!matches) return false
      }

      // Category filter
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false

      // Pricing filter
      if (pricingFilter !== 'all' && tool.pricing_model !== pricingFilter) return false

      // Tier filter
      if (tierFilter !== 'all' && tool.recommendation_tier !== tierFilter) return false

      return true
    })
  }, [database.tools, searchQuery, categoryFilter, pricingFilter, tierFilter])

  return (
    <div className="flex flex-col h-full">
      {/* Filters Bar */}
      <div className="p-4 border-b border-border space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-surface-1 text-foreground border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Pricing */}
          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value)}
            className="bg-surface-1 text-foreground border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Pricing</option>
            {pricingModels.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' ')}</option>
            ))}
          </select>

          {/* Tier */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-surface-1 text-foreground border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Tiers</option>
            {tiers.map(t => (
              <option key={t} value={t}>{TIER_LABELS[t]}</option>
            ))}
          </select>

          {/* Results Count */}
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filteredTools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              expanded={expandedTool === tool.id}
              onToggle={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
            />
          ))}

          {filteredTools.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <p>No tools match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ tool, expanded, onToggle }: { tool: Tool; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="bg-surface-1 rounded-lg border border-border overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-surface-2/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{tool.name}</span>
              {tool.recommendation_tier && (
                <span className={`px-2 py-0.5 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                  {TIER_LABELS[tool.recommendation_tier]}
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                {tool.pricing_model}
              </span>
              {tool.free_tier?.available && (
                <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                  Free tier
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{tool.description}</div>
            <div className="text-xs text-muted-foreground mt-1">{tool.category}{tool.subcategory ? ` › ${tool.subcategory}` : ''}</div>
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
              <ul className="space-y-1">
                {tool.key_features.map((feature, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pros & Cons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tool.pros && tool.pros.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-400 uppercase mb-2">Pros</h4>
                <ul className="space-y-1">
                  {tool.pros.map((pro, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-green-400">+</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tool.cons && tool.cons.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">Cons</h4>
                <ul className="space-y-1">
                  {tool.cons.map((con, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-red-400">−</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Pricing Tiers */}
          {tool.pricing_tiers && Object.keys(tool.pricing_tiers).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pricing</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(tool.pricing_tiers).map(([name, tier]) => (
                  <div key={name} className="px-3 py-2 bg-surface-2 rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground capitalize">{name}</div>
                    <div className="text-sm font-semibold text-foreground">{tier.price}</div>
                    {tier.billing && <div className="text-xs text-muted-foreground">{tier.billing}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Links */}
          {tool.video_links && tool.video_links.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Videos & Tutorials</h4>
              <div className="flex flex-wrap gap-2">
                {tool.video_links.map((video, i) => (
                  <a
                    key={i}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors flex items-center gap-1"
                  >
                    ▶ {video.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Forklift Relevance */}
          {tool.forklift_relevance && (
            <div className="p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏭</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase">Forklift Sales Relevance</span>
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

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            {tool.url && (
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                🔗 Website
              </a>
            )}
            {tool.api_available && <span>🔌 API Available</span>}
            {tool.local_deployment?.available && <span>💻 Self-hostable</span>}
            {tool.last_updated && <span>Updated: {tool.last_updated}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Stack Builder View
// =============================================================================

function StackBuilderView({ database }: { database: ToolsDatabase }) {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Filter tools by search
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return database.tools
    const q = searchQuery.toLowerCase()
    return database.tools.filter(t => 
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    )
  }, [database.tools, searchQuery])

  // Get selected tools data
  const selectedToolsData = useMemo(() => {
    return database.tools.filter(t => selectedTools.has(t.id))
  }, [database.tools, selectedTools])

  // Calculate costs
  const costSummary = useMemo(() => {
    let estimatedMonthly = 0
    let hasFreeTier = 0
    let unknownPricing = 0

    selectedToolsData.forEach(tool => {
      if (tool.free_tier?.available) hasFreeTier++
      
      // Try to extract numeric price from pricing_tiers
      if (tool.pricing_tiers) {
        const firstTier = Object.values(tool.pricing_tiers)[0]
        const price = firstTier?.price
        if (price) {
          const match = price.match(/\$?(\d+(?:\.\d+)?)/);
          if (match) {
            estimatedMonthly += parseFloat(match[1])
          } else {
            unknownPricing++
          }
        }
      } else if (tool.pricing_model === 'free' || tool.pricing_model === 'open-source') {
        // Free tools
      } else {
        unknownPricing++
      }
    })

    return { estimatedMonthly, hasFreeTier, unknownPricing }
  }, [selectedToolsData])

  const toggleTool = (id: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="flex h-full">
      {/* Left: Tool Selection */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools to add..."
            className="w-full bg-surface-1 text-foreground border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Tool List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  selectedTools.has(tool.id)
                    ? 'bg-primary/10 border-primary/50'
                    : 'bg-surface-1 border-border hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                    selectedTools.has(tool.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border'
                  }`}>
                    {selectedTools.has(tool.id) && '✓'}
                  </span>
                  <span className="text-lg">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">{tool.name}</div>
                    <div className="text-xs text-muted-foreground">{tool.category}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                    {tool.pricing_model}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Stack Summary */}
      <div className="w-80 flex flex-col bg-surface-1/50">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Your Stack</h3>
          <p className="text-sm text-muted-foreground">{selectedTools.size} tools selected</p>
        </div>

        {/* Cost Summary */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Monthly</span>
            <span className="text-lg font-bold text-foreground">
              ${costSummary.estimatedMonthly.toFixed(2)}
              {costSummary.unknownPricing > 0 && <span className="text-xs text-muted-foreground">+</span>}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Free Tiers Available</span>
            <span className="text-sm font-medium text-green-400">{costSummary.hasFreeTier}</span>
          </div>
          {costSummary.unknownPricing > 0 && (
            <p className="text-xs text-muted-foreground">
              * {costSummary.unknownPricing} tools have usage-based or custom pricing
            </p>
          )}
        </div>

        {/* Selected Tools List */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedToolsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No tools selected</p>
              <p className="mt-1 text-xs">Click tools on the left to add them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedToolsData.map(tool => (
                <div
                  key={tool.id}
                  className="p-2 bg-surface-1 rounded-lg border border-border flex items-center gap-2"
                >
                  <span>{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{tool.name}</span>
                  <button
                    onClick={() => toggleTool(tool.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={() => setSelectedTools(new Set())}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={selectedTools.size === 0}
          >
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Compare View
// =============================================================================

function CompareView({ database }: { database: ToolsDatabase }) {
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Get tools data
  const toolsToCompare = useMemo(() => {
    return selectedTools
      .map(id => database.tools.find(t => t.id === id))
      .filter((t): t is Tool => t !== undefined)
  }, [selectedTools, database.tools])

  // Filter for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return database.tools
      .filter(t => 
        !selectedTools.includes(t.id) &&
        (t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [searchQuery, database.tools, selectedTools])

  const addTool = (id: string) => {
    if (selectedTools.length < 3 && !selectedTools.includes(id)) {
      setSelectedTools([...selectedTools, id])
    }
    setSearchQuery('')
  }

  const removeTool = (id: string) => {
    setSelectedTools(selectedTools.filter(t => t !== id))
  }

  return (
    <div className="p-4 space-y-6">
      {/* Tool Selection */}
      <div className="flex flex-wrap gap-2 items-center">
        {selectedTools.map(id => {
          const tool = database.tools.find(t => t.id === id)
          if (!tool) return null
          return (
            <div
              key={id}
              className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2"
            >
              <span>{CATEGORY_ICONS[tool.category] || '🔧'}</span>
              <span className="font-medium text-foreground">{tool.name}</span>
              <button
                onClick={() => removeTool(id)}
                className="text-muted-foreground hover:text-red-400"
              >
                ✕
              </button>
            </div>
          )
        })}

        {selectedTools.length < 3 && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Add tool ${selectedTools.length + 1} of 3...`}
              className="bg-surface-1 text-foreground border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-64"
            />
            
            {searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                {searchResults.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => addTool(tool.id)}
                    className="w-full px-4 py-2 text-left hover:bg-surface-1 flex items-center gap-2"
                  >
                    <span>{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                    <span className="text-sm font-medium text-foreground">{tool.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{tool.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {toolsToCompare.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium w-40">Attribute</th>
                {toolsToCompare.map(tool => (
                  <th key={tool.id} className="text-left py-3 px-4 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span>{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                      {tool.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Category" values={toolsToCompare.map(t => t.category)} />
              <CompareRow label="Pricing" values={toolsToCompare.map(t => t.pricing_model)} />
              <CompareRow label="Free Tier" values={toolsToCompare.map(t => t.free_tier?.available ? '✓ Yes' : '✗ No')} />
              <CompareRow label="API Available" values={toolsToCompare.map(t => t.api_available ? '✓ Yes' : '✗ No')} />
              <CompareRow label="Self-hostable" values={toolsToCompare.map(t => t.local_deployment?.available ? '✓ Yes' : '✗ No')} />
              <CompareRow label="Recommendation" values={toolsToCompare.map(t => TIER_LABELS[t.recommendation_tier || ''] || '—')} />
              <CompareRow label="Forklift Score" values={toolsToCompare.map(t => t.forklift_relevance?.score ? `${t.forklift_relevance.score}/10` : '—')} />
              <CompareRow label="Key Features" values={toolsToCompare.map(t => t.key_features?.slice(0, 3).join(', ') || '—')} multiline />
              <CompareRow label="Pros" values={toolsToCompare.map(t => t.pros?.slice(0, 3).join(', ') || '—')} multiline />
              <CompareRow label="Cons" values={toolsToCompare.map(t => t.cons?.slice(0, 3).join(', ') || '—')} multiline />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-4">⚖️</div>
          <p>Select at least 2 tools to compare</p>
          <p className="text-sm mt-1">Search and add tools above (max 3)</p>
        </div>
      )}
    </div>
  )
}

function CompareRow({ label, values, multiline }: { label: string; values: (string | undefined)[]; multiline?: boolean }) {
  return (
    <tr className="border-b border-border">
      <td className="py-3 px-4 text-muted-foreground font-medium align-top">{label}</td>
      {values.map((value, i) => (
        <td key={i} className={`py-3 px-4 text-foreground ${multiline ? 'align-top text-xs' : ''}`}>
          {value || '—'}
        </td>
      ))}
    </tr>
  )
}
