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

type TabId = 'dashboard' | 'tools' | 'templates' | 'stack-builder' | 'compare'

// =============================================================================
// Free Tier Alternatives Mapping
// =============================================================================

const FREE_TIER_ALTERNATIVES: Record<string, { name: string; cost: number; notes: string }> = {
  'make': { name: 'n8n (self-hosted)', cost: 0, notes: 'Self-hosted automation' },
  'zapier': { name: 'n8n (self-hosted)', cost: 0, notes: 'Self-hosted automation' },
  'midjourney': { name: 'Leonardo AI (free tier)', cost: 0, notes: '150 images/day free' },
  'calendly': { name: 'Cal.com (free)', cost: 0, notes: 'Open-source scheduling' },
  'notion': { name: 'Obsidian (free)', cost: 0, notes: 'Local-first notes' },
  'airtable': { name: 'NocoDB (self-hosted)', cost: 0, notes: 'Open-source Airtable alternative' },
  'typeform': { name: 'Tally (free)', cost: 0, notes: 'Free form builder' },
  'intercom': { name: 'Chatwoot (self-hosted)', cost: 0, notes: 'Open-source support chat' },
  'mailchimp': { name: 'Listmonk (self-hosted)', cost: 0, notes: 'Self-hosted email' },
  'hotjar': { name: 'Plausible (self-hosted)', cost: 0, notes: 'Privacy-focused analytics' },
}

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
// YouTube Thumbnail Helper
// =============================================================================

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
  }
  return null
}

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

// =============================================================================
// Cost Parsing Helpers
// =============================================================================

function parseCostFromString(costStr: string): { min: number; max: number } {
  // Handle ranges like "$22-99" or "$22-$99"
  const rangeMatch = costStr.match(/\$?(\d+(?:\.\d+)?)\s*[-–]\s*\$?(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) }
  }
  
  // Handle single values like "$22" or "$22/mo"
  const singleMatch = costStr.match(/\$?(\d+(?:\.\d+)?)/)
  if (singleMatch) {
    const val = parseFloat(singleMatch[1])
    return { min: val, max: val }
  }
  
  // Free or unknown
  if (costStr.toLowerCase().includes('free') || costStr === '$0') {
    return { min: 0, max: 0 }
  }
  
  return { min: 0, max: 0 }
}

function extractToolCost(tool: Tool | StackTemplateTool): { min: number; max: number } {
  // For StackTemplateTool (has cost string)
  if ('cost' in tool && typeof tool.cost === 'string') {
    return parseCostFromString(tool.cost)
  }
  
  // For full Tool objects
  const fullTool = tool as Tool
  if (fullTool.pricing_tiers) {
    let totalMin = 0
    let totalMax = 0
    const tiers = Object.values(fullTool.pricing_tiers)
    if (tiers.length > 0) {
      // Use first tier as estimate
      const { min, max } = parseCostFromString(tiers[0].price)
      return { min, max }
    }
  }
  
  if (fullTool.pricing_model === 'free' || fullTool.pricing_model === 'open-source') {
    return { min: 0, max: 0 }
  }
  
  return { min: 0, max: 0 }
}

// =============================================================================
// Unified Cost Calculator
// =============================================================================

interface UnifiedCostResult {
  totalMin: number
  totalMax: number
  deduplicatedTools: Map<string, { tool: StackTemplateTool; sharedAcross: string[]; cost: { min: number; max: number } }>
  savings: number
  naiveTotalMin: number
  naiveTotalMax: number
  freeTierSavings: number
  withFreeTiersMin: number
  withFreeTiersMax: number
  freeTierSubstitutions: Array<{ original: string; replacement: string; savings: number }>
}

function calculateUnifiedCost(
  selectedTemplates: StackTemplate[],
  useFreeTiers: boolean = false
): UnifiedCostResult {
  const toolMap = new Map<string, { tool: StackTemplateTool; sharedAcross: string[]; cost: { min: number; max: number } }>()
  
  // Naive calculation (sum of all template costs without deduplication)
  let naiveTotalMin = 0
  let naiveTotalMax = 0
  
  selectedTemplates.forEach(template => {
    naiveTotalMin += template.total_cost.min
    naiveTotalMax += template.total_cost.max
  })
  
  // Deduplicate tools across templates
  selectedTemplates.forEach(template => {
    template.tools.forEach(tool => {
      const toolKey = tool.id.toLowerCase()
      const existingEntry = toolMap.get(toolKey)
      
      if (existingEntry) {
        // Tool already exists, add this template to sharedAcross
        existingEntry.sharedAcross.push(template.name)
      } else {
        // New tool
        toolMap.set(toolKey, {
          tool,
          sharedAcross: [template.name],
          cost: extractToolCost(tool)
        })
      }
    })
  })
  
  // Calculate actual deduplicated total
  let totalMin = 0
  let totalMax = 0
  
  toolMap.forEach(entry => {
    totalMin += entry.cost.min
    totalMax += entry.cost.max
  })
  
  // Calculate savings from deduplication
  const savings = naiveTotalMax - totalMax
  
  // Calculate free tier substitutions
  let freeTierSavings = 0
  let withFreeTiersMin = totalMin
  let withFreeTiersMax = totalMax
  const freeTierSubstitutions: Array<{ original: string; replacement: string; savings: number }> = []
  
  if (useFreeTiers) {
    toolMap.forEach((entry, toolKey) => {
      const alternative = FREE_TIER_ALTERNATIVES[toolKey]
      if (alternative) {
        const originalCost = entry.cost.max
        const savingsAmount = originalCost - alternative.cost
        if (savingsAmount > 0) {
          freeTierSavings += savingsAmount
          freeTierSubstitutions.push({
            original: entry.tool.name,
            replacement: alternative.name,
            savings: savingsAmount
          })
        }
      }
    })
    withFreeTiersMin = Math.max(0, totalMin - freeTierSavings)
    withFreeTiersMax = Math.max(0, totalMax - freeTierSavings)
  }
  
  return {
    totalMin,
    totalMax,
    deduplicatedTools: toolMap,
    savings,
    naiveTotalMin,
    naiveTotalMax,
    freeTierSavings,
    withFreeTiersMin,
    withFreeTiersMax,
    freeTierSubstitutions
  }
}

// =============================================================================
// Tool Overlap Calculator for Templates
// =============================================================================

function calculateToolOverlaps(templates: StackTemplate[]): Map<string, Map<string, string[]>> {
  // Map: templateId -> Map<otherTemplateId, [shared tool names]>
  const overlaps = new Map<string, Map<string, string[]>>()
  
  templates.forEach(templateA => {
    const templateAOverlaps = new Map<string, string[]>()
    const toolsA = new Set(templateA.tools.map(t => t.id.toLowerCase()))
    
    templates.forEach(templateB => {
      if (templateA.id === templateB.id) return
      
      const sharedTools: string[] = []
      templateB.tools.forEach(toolB => {
        if (toolsA.has(toolB.id.toLowerCase())) {
          sharedTools.push(toolB.name)
        }
      })
      
      if (sharedTools.length > 0) {
        templateAOverlaps.set(templateB.id, sharedTools)
      }
    })
    
    overlaps.set(templateA.id, templateAOverlaps)
  })
  
  return overlaps
}

// =============================================================================
// Main Panel Component
// =============================================================================

export function AIToolkitPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [database, setDatabase] = useState<ToolsDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stackBuilderTools, setStackBuilderTools] = useState<Set<string>>(new Set())
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())

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

  // Handler to populate stack builder from template
  const handleUseTemplate = useCallback((template: StackTemplate) => {
    const toolIds = new Set(template.tools.map(t => t.id))
    setStackBuilderTools(toolIds)
    setActiveTab('stack-builder')
  }, [])

  // Handler to populate stack builder from multiple templates (unified)
  const handleUseMultipleTemplates = useCallback((templates: StackTemplate[]) => {
    const toolIds = new Set<string>()
    templates.forEach(t => {
      t.tools.forEach(tool => toolIds.add(tool.id))
    })
    setStackBuilderTools(toolIds)
    setActiveTab('stack-builder')
  }, [])

  // Toggle template selection for unified cost view
  const toggleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev)
      if (next.has(templateId)) {
        next.delete(templateId)
      } else {
        next.add(templateId)
      }
      return next
    })
  }, [])

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
    { id: 'templates', label: 'Templates', icon: '📋' },
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
            <h2 className="text-lg font-semibold text-foreground">AI Toolkit V2</h2>
            <p className="text-sm text-muted-foreground">
              {database.metadata.total_tools} tools • {database.stack_templates?.length || 0} templates
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
            {tab.id === 'templates' && database.stack_templates && database.stack_templates.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-400">
                {database.stack_templates.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardView database={database} onNavigate={setActiveTab} />}
        {activeTab === 'tools' && <ToolsBrowserView database={database} />}
        {activeTab === 'templates' && (
          <TemplatesView 
            database={database} 
            onUseTemplate={handleUseTemplate}
            selectedTemplateIds={selectedTemplateIds}
            onToggleTemplate={toggleTemplateSelection}
            onUseMultipleTemplates={handleUseMultipleTemplates}
          />
        )}
        {activeTab === 'stack-builder' && <StackBuilderView database={database} initialTools={stackBuilderTools} />}
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
    const withVideos = tools.filter(t => t.video_links && t.video_links.length > 0).length
    const withIntegrations = tools.filter(t => t.integrations && t.integrations.length > 0).length

    // Group by category
    const byCategory = tools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { tier1, freeTierCount, withApi, withVideos, withIntegrations, byCategory }
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
                <div className="flex items-center gap-2">
                  {tool.integrations && tool.integrations.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                      🔗 {tool.integrations.length}
                    </span>
                  )}
                  {tool.recommendation_tier && (
                    <span className={`px-2 py-0.5 text-xs rounded border ${TIER_COLORS[tool.recommendation_tier]}`}>
                      {TIER_LABELS[tool.recommendation_tier]}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon="🛠️" label="Total Tools" value={database.metadata.total_tools} color="violet" />
        <StatCard icon="⭐" label="Tier-1 Essential" value={stats.tier1} color="green" />
        <StatCard icon="🆓" label="Free Tier" value={stats.freeTierCount} color="blue" />
        <StatCard icon="📹" label="With Videos" value={stats.withVideos} color="red" />
        <StatCard icon="🔗" label="Integrations" value={stats.withIntegrations} color="purple" />
      </div>

      {/* Templates Quick Access */}
      {database.stack_templates && database.stack_templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Stack Templates</h3>
            <button onClick={() => onNavigate('templates')} className="text-xs text-primary hover:underline">
              View all →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {database.stack_templates.map(template => (
              <button
                key={template.id}
                onClick={() => onNavigate('templates')}
                className="p-4 bg-surface-1 hover:bg-surface-2 rounded-lg border border-border transition-colors text-left group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{template.icon}</span>
                  <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {template.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.use_case}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{template.tools.length} tools</span>
                  <span className="text-xs font-semibold text-green-400">
                    ${template.total_cost.min}-${template.total_cost.max}/mo
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
          <button onClick={() => onNavigate('tools')} className="text-xs text-primary hover:underline">
            View all →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {database.tools
            .filter(t => t.recommendation_tier === 'tier_1_essential')
            .slice(0, 6)
            .map(tool => (
              <div key={tool.id} className="p-4 bg-surface-1 rounded-lg border border-green-500/30">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{tool.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                        {tool.pricing_model}
                      </span>
                      {tool.integrations && tool.integrations.length > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                          🔗 {tool.integrations.length}
                        </span>
                      )}
                      {tool.video_links && tool.video_links.length > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                          📹 {tool.video_links.length}
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
    red: 'from-red-500/20 to-orange-500/20',
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
// Templates View (ENHANCED with Unified Cost Calculator)
// =============================================================================

function TemplatesView({ 
  database, 
  onUseTemplate,
  selectedTemplateIds,
  onToggleTemplate,
  onUseMultipleTemplates
}: { 
  database: ToolsDatabase
  onUseTemplate: (template: StackTemplate) => void
  selectedTemplateIds: Set<string>
  onToggleTemplate: (templateId: string) => void
  onUseMultipleTemplates: (templates: StackTemplate[]) => void
}) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [useFreeTiers, setUseFreeTiers] = useState(false)

  const templates = useMemo(() => database.stack_templates || [], [database.stack_templates])

  // Calculate tool overlaps between templates
  const toolOverlaps = useMemo(() => calculateToolOverlaps(templates), [templates])

  // Get selected templates
  const selectedTemplates = useMemo(() => {
    return templates.filter(t => selectedTemplateIds.has(t.id))
  }, [templates, selectedTemplateIds])

  // Calculate unified cost for selected templates
  const unifiedCost = useMemo(() => {
    if (selectedTemplates.length === 0) return null
    return calculateUnifiedCost(selectedTemplates, useFreeTiers)
  }, [selectedTemplates, useFreeTiers])

  if (templates.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="text-4xl mb-4">📋</div>
        <p>No stack templates available yet.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Pre-Built Stack Templates</h3>
        <p className="text-sm text-muted-foreground">
          Production-ready tool combinations for common business use cases. Select multiple to see unified costs.
        </p>
      </div>

      {/* Unified Cost Calculator Panel */}
      {selectedTemplates.length > 0 && unifiedCost && (
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/30 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧮</span>
              <h4 className="font-semibold text-foreground">Unified Cost Calculator</h4>
              <span className="px-2 py-0.5 text-xs rounded bg-violet-500/20 text-violet-400">
                {selectedTemplates.length} templates selected
              </span>
            </div>
            <Button
              onClick={() => onUseMultipleTemplates(selectedTemplates)}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              Build Combined Stack →
            </Button>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Naive Total */}
            <div className="p-3 bg-surface-1/50 rounded-lg">
              <div className="text-xs text-muted-foreground uppercase mb-1">If Purchased Separately</div>
              <div className="text-lg font-bold text-muted-foreground line-through">
                ${unifiedCost.naiveTotalMin}-${unifiedCost.naiveTotalMax}/mo
              </div>
            </div>

            {/* Actual Total (Deduplicated) */}
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="text-xs text-green-400 uppercase mb-1">Actual Combined Cost</div>
              <div className="text-lg font-bold text-green-400">
                ${unifiedCost.totalMin}-${unifiedCost.totalMax}/mo
              </div>
              {unifiedCost.savings > 0 && (
                <div className="text-xs text-green-400 mt-1">
                  ✨ You save ${unifiedCost.savings}/mo by sharing tools!
                </div>
              )}
            </div>

            {/* Free Tier Option */}
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-blue-400 uppercase">With Free Alternatives</div>
                <button
                  onClick={() => setUseFreeTiers(!useFreeTiers)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    useFreeTiers ? 'bg-blue-500' : 'bg-surface-2'
                  }`}
                >
                  <span className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${
                    useFreeTiers ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              {useFreeTiers ? (
                <>
                  <div className="text-lg font-bold text-blue-400">
                    ${unifiedCost.withFreeTiersMin}-${unifiedCost.withFreeTiersMax}/mo
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    💰 Saves ${unifiedCost.freeTierSavings}/mo with free tiers
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Toggle to see potential savings
                </div>
              )}
            </div>
          </div>

          {/* Free Tier Substitutions List */}
          {useFreeTiers && unifiedCost.freeTierSubstitutions.length > 0 && (
            <div className="mt-3 p-3 bg-surface-1/50 rounded-lg">
              <div className="text-xs text-muted-foreground uppercase mb-2">Free Tier Substitutions</div>
              <div className="space-y-2">
                {unifiedCost.freeTierSubstitutions.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-red-400 line-through">{sub.original}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-green-400">{sub.replacement}</span>
                    <span className="text-xs text-green-400 ml-auto">(saves ${sub.savings}/mo)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deduplicated Tools List */}
          <div>
            <div className="text-xs text-muted-foreground uppercase mb-2">Deduplicated Tool Stack ({unifiedCost.deduplicatedTools.size} tools)</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(unifiedCost.deduplicatedTools.entries()).map(([id, entry]) => (
                <div
                  key={id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    entry.sharedAcross.length > 1
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-surface-1 text-foreground border border-border'
                  }`}
                >
                  {entry.tool.name}
                  {entry.sharedAcross.length > 1 && (
                    <span className="ml-1 opacity-75">
                      (shared across {entry.sharedAcross.length})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template Cards */}
      {templates.map(template => {
        const overlapsForTemplate = toolOverlaps.get(template.id)
        const isSelected = selectedTemplateIds.has(template.id)

        return (
          <div
            key={template.id}
            className={`bg-surface-1 rounded-lg border overflow-hidden transition-colors ${
              isSelected ? 'border-primary' : 'border-border'
            }`}
          >
            {/* Template Header */}
            <div className="flex items-start gap-3 p-4">
              {/* Selection Checkbox */}
              <button
                onClick={() => onToggleTemplate(template.id)}
                className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {isSelected && '✓'}
              </button>

              {/* Main Content Button */}
              <button
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                className="flex-1 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-semibold text-foreground">{template.name}</span>
                      <span className="px-2 py-0.5 text-xs rounded bg-violet-500/20 text-violet-400">
                        {template.tools.length} tools
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400 font-semibold">
                        ${template.total_cost.min}-${template.total_cost.max}/mo
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                        ROI: {template.roi_timeline}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{template.description}</p>

                    {/* Tool Overlap Badges */}
                    {overlapsForTemplate && overlapsForTemplate.size > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Array.from(overlapsForTemplate.entries()).map(([otherTemplateId, sharedTools]) => {
                          const otherTemplate = templates.find(t => t.id === otherTemplateId)
                          if (!otherTemplate) return null
                          return (
                            <span
                              key={otherTemplateId}
                              className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                            >
                              🔄 {sharedTools.length} tool{sharedTools.length > 1 ? 's' : ''} shared with {otherTemplate.name}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <span className={`text-muted-foreground transition-transform ${expandedTemplate === template.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>
            </div>

            {/* Expanded Details */}
            {expandedTemplate === template.id && (
              <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border ml-8">
                {/* Tools in Stack */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Tools in Stack</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {template.tools.map((tool, i) => {
                      // Check if this tool is shared with other templates
                      let sharedWith: string[] = []
                      templates.forEach(otherTemplate => {
                        if (otherTemplate.id !== template.id) {
                          const hasShared = otherTemplate.tools.some(t => t.id.toLowerCase() === tool.id.toLowerCase())
                          if (hasShared) sharedWith.push(otherTemplate.name)
                        }
                      })

                      return (
                        <div key={i} className={`p-3 rounded-lg flex items-center gap-3 ${
                          sharedWith.length > 0 
                            ? 'bg-yellow-500/10 border border-yellow-500/20' 
                            : 'bg-surface-2'
                        }`}>
                          <span className="text-lg">{CATEGORY_ICONS[tool.name] || '🔧'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground text-sm">{tool.name}</div>
                            <div className="text-xs text-muted-foreground">{tool.role}</div>
                            {sharedWith.length > 0 && (
                              <div className="text-xs text-yellow-400 mt-0.5">
                                ♻️ Also in: {sharedWith.join(', ')}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-green-400">{tool.cost}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Flow Diagram */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Workflow</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    {template.flow.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-center min-w-[120px]">
                          <div className="text-xs font-semibold text-primary">Step {step.step}</div>
                          <div className="text-sm font-medium text-foreground">{step.label}</div>
                          <div className="text-xs text-muted-foreground">{step.description}</div>
                        </div>
                        {i < template.flow.length - 1 && (
                          <span className="text-muted-foreground text-lg">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Integrations Required */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Integrations</h4>
                  <div className="flex flex-wrap gap-2">
                    {template.integrations_required.map((integration, i) => (
                      <span key={i} className="px-2 py-1 text-xs bg-surface-2 rounded text-foreground">
                        {integration}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Revenue Model (for OSHA template) */}
                {template.revenue_model && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Revenue Model</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {template.revenue_model.map((item, i) => (
                        <div key={i} className="p-3 bg-surface-2 rounded-lg">
                          <div className="font-medium text-foreground text-sm">{item.course}</div>
                          <div className="text-xs text-muted-foreground">Price: {item.price}</div>
                          <div className="text-xs text-muted-foreground">Cost: {item.cost_per_student}</div>
                          <div className="text-xs font-semibold text-green-400">Margin: {item.margin}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Use Template Button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => onUseTemplate(template)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Use This Stack →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
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
              {/* Integration Badge (NEW) */}
              {tool.integrations && tool.integrations.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                  🔗 {tool.integrations.length} integrations
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

          {/* Integrations List (NEW) */}
          {tool.integrations && tool.integrations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-400 uppercase mb-2">🔗 Integrations</h4>
              <div className="flex flex-wrap gap-2">
                {tool.integrations.map((integration, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                    {integration}
                  </span>
                ))}
              </div>
            </div>
          )}

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

          {/* Video Links with Thumbnails (ENHANCED) */}
          {tool.video_links && tool.video_links.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">📹 Video Tutorials</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tool.video_links.map((video, i) => {
                  const thumbnail = getYouTubeThumbnail(video.url)
                  return (
                    <a
                      key={i}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block bg-surface-2 rounded-lg overflow-hidden hover:ring-2 hover:ring-red-500/50 transition-all"
                    >
                      {thumbnail ? (
                        <div className="relative">
                          <img
                            src={thumbnail}
                            alt={video.title}
                            className="w-full h-24 object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                            <span className="text-3xl">▶️</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 bg-red-500/10 flex items-center justify-center">
                          <span className="text-3xl">🎬</span>
                        </div>
                      )}
                      <div className="p-2">
                        <div className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-red-400 transition-colors">
                          {video.title}
                        </div>
                        {video.type && (
                          <span className="text-xs text-muted-foreground capitalize">{video.type}</span>
                        )}
                      </div>
                    </a>
                  )
                })}
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
// Stack Builder View (ENHANCED with Free Tier Toggle)
// =============================================================================

function StackBuilderView({ database, initialTools }: { database: ToolsDatabase; initialTools?: Set<string> }) {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(initialTools || new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [useFreeTiers, setUseFreeTiers] = useState(false)

  // Sync with initialTools when it changes (from template)
  useEffect(() => {
    if (initialTools && initialTools.size > 0) {
      setSelectedTools(initialTools)
    }
  }, [initialTools])

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

  // Calculate costs with free tier support
  const costSummary = useMemo(() => {
    let estimatedMonthlyMin = 0
    let estimatedMonthlyMax = 0
    let hasFreeTier = 0
    let unknownPricing = 0
    let freeTierSavings = 0
    const freeTierSubstitutions: Array<{ original: string; replacement: string; savings: number }> = []

    selectedToolsData.forEach(tool => {
      if (tool.free_tier?.available) hasFreeTier++
      
      // Try to extract numeric price from pricing_tiers
      if (tool.pricing_tiers) {
        const firstTier = Object.values(tool.pricing_tiers)[0]
        const price = firstTier?.price
        if (price) {
          const { min, max } = parseCostFromString(price)
          estimatedMonthlyMin += min
          estimatedMonthlyMax += max

          // Check for free tier alternative
          if (useFreeTiers) {
            const toolKey = tool.id.toLowerCase()
            const alternative = FREE_TIER_ALTERNATIVES[toolKey]
            if (alternative && max > 0) {
              freeTierSavings += max
              freeTierSubstitutions.push({
                original: tool.name,
                replacement: alternative.name,
                savings: max
              })
            }
          }
        } else {
          unknownPricing++
        }
      } else if (tool.pricing_model === 'free' || tool.pricing_model === 'open-source') {
        // Free tools - no cost
      } else {
        unknownPricing++
      }
    })

    const withFreeTiersMin = Math.max(0, estimatedMonthlyMin - freeTierSavings)
    const withFreeTiersMax = Math.max(0, estimatedMonthlyMax - freeTierSavings)

    return { 
      estimatedMonthlyMin, 
      estimatedMonthlyMax, 
      hasFreeTier, 
      unknownPricing,
      freeTierSavings,
      withFreeTiersMin,
      withFreeTiersMax,
      freeTierSubstitutions
    }
  }, [selectedToolsData, useFreeTiers])

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
                  <div className="flex items-center gap-1">
                    {FREE_TIER_ALTERNATIVES[tool.id.toLowerCase()] && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400" title="Free alternative available">
                        🆓
                      </span>
                    )}
                    {tool.integrations && tool.integrations.length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                        🔗{tool.integrations.length}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded ${PRICING_COLORS[tool.pricing_model]}`}>
                      {tool.pricing_model}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Stack Summary */}
      <div className="w-96 flex flex-col bg-surface-1/50">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Your Stack</h3>
          <p className="text-sm text-muted-foreground">{selectedTools.size} tools selected</p>
        </div>

        {/* Free Tier Toggle */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Use Free Tiers</div>
              <div className="text-xs text-muted-foreground">Swap paid tools for free alternatives</div>
            </div>
            <button
              onClick={() => setUseFreeTiers(!useFreeTiers)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                useFreeTiers ? 'bg-green-500' : 'bg-surface-2'
              }`}
            >
              <span className={`absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all shadow ${
                useFreeTiers ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Monthly</span>
            <span className={`text-lg font-bold ${useFreeTiers && costSummary.freeTierSavings > 0 ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              ${costSummary.estimatedMonthlyMin.toFixed(0)}-${costSummary.estimatedMonthlyMax.toFixed(0)}
              {costSummary.unknownPricing > 0 && <span className="text-xs text-muted-foreground">+</span>}
            </span>
          </div>
          
          {useFreeTiers && costSummary.freeTierSavings > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-400">With Free Tiers</span>
              <span className="text-lg font-bold text-green-400">
                ${costSummary.withFreeTiersMin.toFixed(0)}-${costSummary.withFreeTiersMax.toFixed(0)}/mo
              </span>
            </div>
          )}

          {useFreeTiers && costSummary.freeTierSavings > 0 && (
            <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="text-xs text-green-400 font-medium">
                💰 You save ${costSummary.freeTierSavings.toFixed(0)}/mo with free alternatives!
              </div>
            </div>
          )}

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

        {/* Free Tier Substitutions */}
        {useFreeTiers && costSummary.freeTierSubstitutions.length > 0 && (
          <div className="p-4 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Free Substitutions</div>
            <div className="space-y-2">
              {costSummary.freeTierSubstitutions.map((sub, i) => (
                <div key={i} className="text-xs">
                  <span className="text-red-400 line-through">{sub.original}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-green-400">{sub.replacement}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Tools List */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedToolsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No tools selected</p>
              <p className="mt-1 text-xs">Click tools on the left to add them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedToolsData.map(tool => {
                const hasFreeAlt = FREE_TIER_ALTERNATIVES[tool.id.toLowerCase()]
                return (
                  <div
                    key={tool.id}
                    className={`p-2 rounded-lg border flex items-center gap-2 ${
                      useFreeTiers && hasFreeAlt
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-surface-1 border-border'
                    }`}
                  >
                    <span>{CATEGORY_ICONS[tool.category] || '🔧'}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium truncate ${useFreeTiers && hasFreeAlt ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {tool.name}
                      </span>
                      {useFreeTiers && hasFreeAlt && (
                        <div className="text-xs text-green-400">{hasFreeAlt.name}</div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleTool(tool.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
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
              <CompareRow label="Integrations" values={toolsToCompare.map(t => t.integrations?.length ? `${t.integrations.length} tools` : '—')} />
              <CompareRow label="Recommendation" values={toolsToCompare.map(t => TIER_LABELS[t.recommendation_tier || ''] || '—')} />
              <CompareRow label="Forklift Score" values={toolsToCompare.map(t => t.forklift_relevance?.score ? `${t.forklift_relevance.score}/10` : '—')} />
              <CompareRow label="Videos" values={toolsToCompare.map(t => t.video_links?.length ? `${t.video_links.length} tutorials` : '—')} />
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
