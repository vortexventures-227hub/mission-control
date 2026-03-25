'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'

// App status types matching the pipeline
type PipelineStage = 'building' | 'built' | 'ui-polish' | 'knox-audit' | 'app-store-ready' | 'in-review' | 'live' | 'rejected' | 'draft'

// Revenue model types
type RevenueModel = 'free' | 'freemium' | 'paid' | 'subscription' | 'ads' | 'in-app-purchase'

interface AppInfo {
  id: string
  name: string
  bundleId: string
  description: string
  stage: PipelineStage
  revenueModel: RevenueModel
  version: string
  platform: 'ios' | 'android' | 'both'
  icon: string
  category: string
  hasUIGuide: boolean
  hasReadme: boolean
  lastModified: string
  appStoreUrl?: string
  playStoreUrl?: string
}

// Status display configs
const stageConfig: Record<PipelineStage, { label: string; color: string; bgColor: string; icon: string; order: number }> = {
  draft: { label: 'Draft', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: '📝', order: 0 },
  building: { label: 'Building', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: '🔨', order: 1 },
  built: { label: 'Built', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: '✅', order: 2 },
  'ui-polish': { label: 'UI Polish', color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: '✨', order: 3 },
  'knox-audit': { label: 'Knox Audit', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: '🛡️', order: 4 },
  'app-store-ready': { label: 'Store Ready', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: '📦', order: 5 },
  'in-review': { label: 'In Review', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: '⏳', order: 6 },
  live: { label: 'Live', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: '🚀', order: 7 },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: '❌', order: 8 },
}

const revenueModelConfig: Record<RevenueModel, { label: string; icon: string }> = {
  free: { label: 'Free', icon: '🆓' },
  freemium: { label: 'Freemium', icon: '💎' },
  paid: { label: 'Paid', icon: '💰' },
  subscription: { label: 'Subscription', icon: '🔄' },
  ads: { label: 'Ad-Supported', icon: '📺' },
  'in-app-purchase': { label: 'IAP', icon: '🛒' },
}

const categoryIcons: Record<string, string> = {
  'Productivity': '📊',
  'Health & Fitness': '💪',
  'Food & Drink': '🍕',
  'Finance': '💰',
  'Lifestyle': '🌿',
  'Education': '📚',
  'Utilities': '🔧',
  'Survival': '🏕️',
  'Communication': '📻',
}

// Real app data from the factory
const appFactoryApps: AppInfo[] = [
  {
    id: 'ai-trade-quote',
    name: 'AITradeQuote',
    bundleId: 'com.valphaops.aitradequote',
    description: 'AI-powered trade and job quote generator',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '💼',
    category: 'Finance',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 20:22',
  },
  {
    id: 'brain-dump',
    name: 'BrainDump',
    bundleId: 'com.valphaops.braindump',
    description: 'Quick thought capture and idea organization',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '🧠',
    category: 'Productivity',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 21:22',
  },
  {
    id: 'budget-tracker',
    name: 'BudgetTracker',
    bundleId: 'com.valphaops.budgettracker',
    description: 'Simple expense and budget management',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '💵',
    category: 'Finance',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 00:42',
  },
  {
    id: 'chore-manager',
    name: 'ChoreManager',
    bundleId: 'com.valphaops.choremanager',
    description: 'Household chore scheduling and tracking',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '🧹',
    category: 'Lifestyle',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 00:03',
  },
  {
    id: 'doc-scanner',
    name: 'DocScanner',
    bundleId: 'com.valphaops.docscanner',
    description: 'Document scanning and PDF creation',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '📄',
    category: 'Productivity',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 24 23:45',
  },
  {
    id: 'fast-track',
    name: 'FastTrack',
    bundleId: 'com.valphaops.fasttrack',
    description: 'Intermittent fasting timer and tracker',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '⏱️',
    category: 'Health & Fitness',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 20:34',
  },
  {
    id: 'flash-study',
    name: 'FlashStudy',
    bundleId: 'com.valphaops.flashstudy',
    description: 'Flashcard creation and spaced repetition',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '📚',
    category: 'Education',
    hasUIGuide: false,
    hasReadme: true,
    lastModified: 'Mar 25 00:16',
  },
  {
    id: 'forager-guide',
    name: 'ForagerGuide',
    bundleId: 'com.valphaops.foragerguide',
    description: 'Wild plant identification and foraging guide',
    stage: 'built',
    revenueModel: 'paid',
    version: '1.0.0',
    platform: 'ios',
    icon: '🌿',
    category: 'Survival',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 22:02',
  },
  {
    id: 'goal-of-the-day',
    name: 'GoalOfTheDay',
    bundleId: 'com.valphaops.goaloftheday',
    description: 'Daily goal setting and motivation',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '🎯',
    category: 'Productivity',
    hasUIGuide: false,
    hasReadme: true,
    lastModified: 'Mar 25 01:08',
  },
  {
    id: 'grid-down',
    name: 'GridDown',
    bundleId: 'com.valphaops.griddown',
    description: 'Emergency preparedness and offline survival toolkit',
    stage: 'built',
    revenueModel: 'paid',
    version: '1.0.0',
    platform: 'ios',
    icon: '⚡',
    category: 'Survival',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 22:02',
  },
  {
    id: 'grub-radar',
    name: 'GrubRadar',
    bundleId: 'com.valphaops.grubradar',
    description: 'Local food deals and restaurant finder',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🍔',
    category: 'Food & Drink',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 01:35',
  },
  {
    id: 'ham-radio-survival',
    name: 'HamRadioSurvival',
    bundleId: 'com.valphaops.hamradiosurvival',
    description: 'Ham radio frequencies and emergency comms guide',
    stage: 'built',
    revenueModel: 'paid',
    version: '1.0.0',
    platform: 'ios',
    icon: '📻',
    category: 'Communication',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 22:48',
  },
  {
    id: 'hydrate-me',
    name: 'HydrateMe',
    bundleId: 'com.valphaops.hydrateme',
    description: 'Water intake tracking and hydration reminders',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '💧',
    category: 'Health & Fitness',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 21:28',
  },
  {
    id: 'invoice-app',
    name: 'InvoiceApp',
    bundleId: 'com.valphaops.invoiceapp',
    description: 'Simple invoice creation and client billing',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🧾',
    category: 'Finance',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 24 23:47',
  },
  {
    id: 'last-did',
    name: 'LastDid',
    bundleId: 'com.valphaops.lastdid',
    description: 'Track when you last did recurring tasks',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '📅',
    category: 'Productivity',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 20:30',
  },
  {
    id: 'log-book-pro',
    name: 'LogBookPro',
    bundleId: 'com.valphaops.logbookpro',
    description: 'Professional activity and time logging',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '📓',
    category: 'Productivity',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 24 22:02',
  },
  {
    id: 'meal-planner',
    name: 'MealPlanner',
    bundleId: 'com.valphaops.mealplanner',
    description: 'Weekly meal planning and shopping lists',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🍽️',
    category: 'Food & Drink',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 00:20',
  },
  {
    id: 'multi-timer',
    name: 'MultiTimer',
    bundleId: 'com.valphaops.multitimer',
    description: 'Multiple simultaneous countdown timers',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '⏲️',
    category: 'Utilities',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 24 23:59',
  },
  {
    id: 'period-tracker',
    name: 'PeriodTracker',
    bundleId: 'com.valphaops.periodtracker',
    description: 'Menstrual cycle tracking and predictions',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🌸',
    category: 'Health & Fitness',
    hasUIGuide: false,
    hasReadme: true,
    lastModified: 'Mar 25 00:59',
  },
  {
    id: 'pizza-ranker',
    name: 'PizzaRanker',
    bundleId: 'com.valphaops.pizzaranker',
    description: 'Rate and rank local pizza places',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '🍕',
    category: 'Food & Drink',
    hasUIGuide: false,
    hasReadme: true,
    lastModified: 'Mar 25 01:11',
  },
  {
    id: 'plant-care',
    name: 'PlantCare',
    bundleId: 'com.valphaops.plantcare',
    description: 'Houseplant watering schedule and care tips',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🪴',
    category: 'Lifestyle',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 01:31',
  },
  {
    id: 'provisions-tracker',
    name: 'ProvisionsTracker',
    bundleId: 'com.valphaops.provisionstracker',
    description: 'Pantry inventory and expiration tracking',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🥫',
    category: 'Food & Drink',
    hasUIGuide: true,
    hasReadme: false,
    lastModified: 'Mar 24 23:28',
  },
  {
    id: 'tattoo-ideas',
    name: 'TattooIdeas',
    bundleId: 'com.valphaops.tattooideas',
    description: 'Tattoo design inspiration and gallery',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🎨',
    category: 'Lifestyle',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 02:04',
  },
  {
    id: 'thought-recorder',
    name: 'ThoughtRecorder',
    bundleId: 'com.valphaops.thoughtrecorder',
    description: 'Voice memo and thought capture',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🎙️',
    category: 'Productivity',
    hasUIGuide: false,
    hasReadme: true,
    lastModified: 'Mar 25 01:57',
  },
  {
    id: 'unit-converter',
    name: 'UnitConverter',
    bundleId: 'com.valphaops.unitconverter',
    description: 'Quick unit and measurement conversions',
    stage: 'built',
    revenueModel: 'free',
    version: '1.0.0',
    platform: 'ios',
    icon: '📐',
    category: 'Utilities',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 00:54',
  },
  {
    id: 'workout-logger',
    name: 'WorkoutLogger',
    bundleId: 'com.valphaops.workoutlogger',
    description: 'Gym workout tracking and progress',
    stage: 'built',
    revenueModel: 'freemium',
    version: '1.0.0',
    platform: 'ios',
    icon: '🏋️',
    category: 'Health & Fitness',
    hasUIGuide: true,
    hasReadme: true,
    lastModified: 'Mar 25 00:43',
  },
]

type ViewMode = 'grid' | 'pipeline' | 'list'
type FilterStage = PipelineStage | 'all'

export function AppFactoryPanel() {
  const t = useTranslations('appFactory')
  const [apps, setApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null)
  const [filterStage, setFilterStage] = useState<FilterStage>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const [searchQuery, setSearchQuery] = useState('')

  // Load apps
  useEffect(() => {
    const loadApps = async () => {
      setLoading(true)
      // In production, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 300))
      setApps(appFactoryApps)
      setLoading(false)
    }
    loadApps()
  }, [])

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(apps.map(app => app.category))
    return ['all', ...Array.from(cats).sort()]
  }, [apps])

  // Filter and search apps
  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      if (filterStage !== 'all' && app.stage !== filterStage) return false
      if (filterCategory !== 'all' && app.category !== filterCategory) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return app.name.toLowerCase().includes(query) || 
               app.description.toLowerCase().includes(query) ||
               app.category.toLowerCase().includes(query)
      }
      return true
    })
  }, [apps, filterStage, filterCategory, searchQuery])

  // Group apps by stage for pipeline view
  const appsByStage = useMemo(() => {
    const stages: Record<PipelineStage, AppInfo[]> = {
      draft: [],
      building: [],
      built: [],
      'ui-polish': [],
      'knox-audit': [],
      'app-store-ready': [],
      'in-review': [],
      live: [],
      rejected: [],
    }
    filteredApps.forEach(app => {
      stages[app.stage].push(app)
    })
    return stages
  }, [filteredApps])

  // Calculate stats
  const stats = useMemo(() => {
    const byStage: Record<PipelineStage, number> = {
      draft: 0,
      building: 0,
      built: 0,
      'ui-polish': 0,
      'knox-audit': 0,
      'app-store-ready': 0,
      'in-review': 0,
      live: 0,
      rejected: 0,
    }
    apps.forEach(app => byStage[app.stage]++)
    
    return {
      total: apps.length,
      byStage,
      withUIGuide: apps.filter(a => a.hasUIGuide).length,
      withReadme: apps.filter(a => a.hasReadme).length,
      complete: apps.filter(a => a.hasUIGuide && a.hasReadme).length,
    }
  }, [apps])

  // Pipeline stages to show (in order)
  const pipelineStages: PipelineStage[] = ['built', 'ui-polish', 'knox-audit', 'app-store-ready', 'in-review', 'live']

  if (loading) {
    return <Loader variant="panel" label="Loading App Factory..." />
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              🏭 App Factory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total} iOS apps in pipeline • {stats.byStage.built} built • {stats.byStage.live} live
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md overflow-hidden border border-border">
              <Button
                variant={viewMode === 'pipeline' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('pipeline')}
                className="rounded-none border-0"
              >
                Pipeline
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-none border-0"
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-none border-0"
              >
                List
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-3 p-4 border-b border-border bg-card/50">
        <div className="rounded-lg p-3 border border-border bg-card">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Apps</div>
        </div>
        <div className="rounded-lg p-3 border border-cyan-500/30 bg-cyan-500/10">
          <div className="text-2xl font-bold text-cyan-400">{stats.byStage.built}</div>
          <div className="text-xs text-muted-foreground">Built</div>
        </div>
        <div className="rounded-lg p-3 border border-purple-500/30 bg-purple-500/10">
          <div className="text-2xl font-bold text-purple-400">{stats.byStage['ui-polish']}</div>
          <div className="text-xs text-muted-foreground">UI Polish</div>
        </div>
        <div className="rounded-lg p-3 border border-amber-500/30 bg-amber-500/10">
          <div className="text-2xl font-bold text-amber-400">{stats.byStage['knox-audit']}</div>
          <div className="text-xs text-muted-foreground">Knox Audit</div>
        </div>
        <div className="rounded-lg p-3 border border-green-500/30 bg-green-500/10">
          <div className="text-2xl font-bold text-green-400">{stats.byStage['app-store-ready']}</div>
          <div className="text-xs text-muted-foreground">Store Ready</div>
        </div>
        <div className="rounded-lg p-3 border border-emerald-500/30 bg-emerald-500/10">
          <div className="text-2xl font-bold text-emerald-400">{stats.byStage.live}</div>
          <div className="text-xs text-muted-foreground">Live</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border-b border-border">
        <input
          type="text"
          placeholder="Search apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-xs h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Stage:</span>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as FilterStage)}
            className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Stages</option>
            {Object.entries(stageConfig).map(([stage, config]) => (
              <option key={stage} value={stage}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Categories</option>
            {categories.filter(c => c !== 'all').map((cat) => (
              <option key={cat} value={cat}>
                {categoryIcons[cat] || '📱'} {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          Showing {filteredApps.length} of {apps.length} apps
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredApps.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-lg">No apps match your filters</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'pipeline' ? (
          // Pipeline View - Kanban-style columns
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
            {pipelineStages.map(stage => {
              const stageApps = appsByStage[stage]
              const config = stageConfig[stage]
              return (
                <div key={stage} className="flex-shrink-0 w-72 flex flex-col">
                  {/* Column Header */}
                  <div className={`rounded-t-lg px-3 py-2 border border-b-0 ${config.bgColor} border-border`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span className={`font-medium ${config.color}`}>{config.label}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                        {stageApps.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Column Content */}
                  <div className="flex-1 bg-card/50 border border-border rounded-b-lg p-2 space-y-2 overflow-y-auto max-h-[600px]">
                    {stageApps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground/50 text-sm">
                        No apps
                      </div>
                    ) : (
                      stageApps.map(app => (
                        <div
                          key={app.id}
                          onClick={() => setSelectedApp(app)}
                          className="bg-card rounded-lg p-3 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-lg">
                              {app.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-foreground text-sm truncate">{app.name}</h4>
                              <p className="text-[10px] text-muted-foreground">{app.category}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {app.description}
                          </p>
                          <div className="flex items-center gap-2 text-[10px]">
                            {app.hasUIGuide && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">UI Guide</span>
                            )}
                            {app.hasReadme && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">README</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredApps.map(app => {
              const config = stageConfig[app.stage]
              return (
                <div
                  key={app.id}
                  className="bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
                  onClick={() => setSelectedApp(app)}
                >
                  {/* App Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl">
                          {app.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{app.name}</h3>
                          <p className="text-xs text-muted-foreground">{app.category}</p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                        {config.icon} {config.label}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {app.description}
                    </p>
                  </div>

                  {/* App Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Revenue Model</span>
                      <span className="font-medium text-foreground">
                        {revenueModelConfig[app.revenueModel].icon} {revenueModelConfig[app.revenueModel].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Platform</span>
                      <span className="font-medium text-foreground">
                        🍎 iOS
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      {app.hasUIGuide && (
                        <span className="px-2 py-1 rounded text-[10px] bg-purple-500/20 text-purple-400">✓ UI Guide</span>
                      )}
                      {app.hasReadme && (
                        <span className="px-2 py-1 rounded text-[10px] bg-blue-500/20 text-blue-400">✓ README</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                      Modified {app.lastModified}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // List View
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Docs</th>
                  <th className="px-4 py-3 font-medium">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredApps.map(app => {
                  const config = stageConfig[app.stage]
                  return (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className="hover:bg-secondary/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-lg">
                            {app.icon}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{app.name}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{app.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">
                          {categoryIcons[app.category] || '📱'} {app.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">
                          {revenueModelConfig[app.revenueModel].icon} {revenueModelConfig[app.revenueModel].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {app.hasUIGuide && <span className="text-purple-400" title="Has UI Guide">📐</span>}
                          {app.hasReadme && <span className="text-blue-400" title="Has README">📄</span>}
                          {!app.hasUIGuide && !app.hasReadme && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {app.lastModified}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* App Detail Modal */}
      {selectedApp && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedApp(null)}
        >
          <div 
            className="bg-card rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-3xl">
                    {selectedApp.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selectedApp.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedApp.bundleId}</p>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mt-2 ${stageConfig[selectedApp.stage].bgColor} ${stageConfig[selectedApp.stage].color}`}>
                      {stageConfig[selectedApp.stage].icon} {stageConfig[selectedApp.stage].label}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedApp(null)}
                  className="text-muted-foreground"
                >
                  ✕
                </Button>
              </div>

              <p className="text-muted-foreground mb-6">{selectedApp.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Category</div>
                  <div className="font-semibold text-foreground">
                    {categoryIcons[selectedApp.category]} {selectedApp.category}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Revenue Model</div>
                  <div className="font-semibold text-foreground">
                    {revenueModelConfig[selectedApp.revenueModel].icon} {revenueModelConfig[selectedApp.revenueModel].label}
                  </div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Platform</div>
                  <div className="font-semibold text-foreground">🍎 iOS</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Version</div>
                  <div className="font-semibold text-foreground">v{selectedApp.version}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">📋 Documentation Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 border ${selectedApp.hasUIGuide ? 'border-purple-500/30 bg-purple-500/10' : 'border-border bg-secondary/30'}`}>
                    <div className="flex items-center gap-2">
                      <span className={selectedApp.hasUIGuide ? 'text-purple-400' : 'text-muted-foreground'}>
                        {selectedApp.hasUIGuide ? '✅' : '⬜'}
                      </span>
                      <span className={selectedApp.hasUIGuide ? 'text-purple-400' : 'text-muted-foreground'}>
                        UI Guide
                      </span>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 border ${selectedApp.hasReadme ? 'border-blue-500/30 bg-blue-500/10' : 'border-border bg-secondary/30'}`}>
                    <div className="flex items-center gap-2">
                      <span className={selectedApp.hasReadme ? 'text-blue-400' : 'text-muted-foreground'}>
                        {selectedApp.hasReadme ? '✅' : '⬜'}
                      </span>
                      <span className={selectedApp.hasReadme ? 'text-blue-400' : 'text-muted-foreground'}>
                        README
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">🔄 Pipeline Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedApp.stage === 'built' && (
                    <>
                      <Button variant="outline" size="sm">
                        ✨ Start UI Polish
                      </Button>
                      <Button variant="outline" size="sm">
                        📂 Open in Xcode
                      </Button>
                    </>
                  )}
                  {selectedApp.stage === 'ui-polish' && (
                    <Button variant="outline" size="sm">
                      🛡️ Submit for Knox Audit
                    </Button>
                  )}
                  {selectedApp.stage === 'knox-audit' && (
                    <Button variant="outline" size="sm">
                      📦 Mark Store Ready
                    </Button>
                  )}
                  {selectedApp.stage === 'app-store-ready' && (
                    <Button variant="outline" size="sm">
                      🚀 Submit to App Store
                    </Button>
                  )}
                  <Button variant="secondary" size="sm">
                    📊 View Analytics
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Last modified:</span> {selectedApp.lastModified}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
