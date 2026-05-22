'use client'

import { useState, useEffect, useMemo } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
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
type McTone = 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim'

function stageTone(stage: PipelineStage): McTone {
  if (stage === 'live') return 'teal'
  if (stage === 'ui-polish') return 'purple'
  if (stage === 'knox-audit' || stage === 'app-store-ready' || stage === 'in-review') return 'amber'
  if (stage === 'rejected') return 'rose'
  if (stage === 'draft') return 'dim'
  return 'neutral'
}

export function AppFactoryPanel() {
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

  const viewModeClass = (mode: ViewMode) =>
    `border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
      viewMode === mode
        ? 'border-[color:var(--mc-teal)]/70 bg-[rgba(46,230,214,0.14)] text-[color:var(--mc-teal-soft)]'
        : 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-2)] hover:border-[color:var(--mc-teal)]/45 hover:text-[color:var(--mc-ink-0)]'
    }`

  if (loading) {
    return (
      <Page
        kicker="Blackwire Ops / App Factory"
        title="App Factory"
        subtitle="Loading the local iOS factory manifest."
        badges={<Chip tone="dim">local manifest</Chip>}
      >
        <HudPanel kicker="boot" title="Loading">
          <Loader variant="panel" label="Loading App Factory..." />
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / App Factory"
      title="App Factory"
      subtitle={`${stats.total} iOS apps in the local factory pipeline. This surface stages readiness only; App Store submission, Xcode opens, analytics, and deploy actions stay operator-gated.`}
      badges={
        <>
          <Chip tone="teal" pulse>local pipeline</Chip>
          <Chip tone="amber">store actions gated</Chip>
          <Chip tone="purple">iOS factory</Chip>
        </>
      }
      actions={
        <div className="flex overflow-hidden border border-[color:var(--mc-hairline-2)]">
          <button type="button" onClick={() => setViewMode('pipeline')} className={viewModeClass('pipeline')}>
            Pipeline
          </button>
          <button type="button" onClick={() => setViewMode('grid')} className={viewModeClass('grid')}>
            Grid
          </button>
          <button type="button" onClick={() => setViewMode('list')} className={viewModeClass('list')}>
            List
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="App Factory Boundary">
          This route reads and organizes the local app pipeline. It does not submit to stores, launch Xcode,
          alter analytics, deploy builds, or mark work verified without an explicit operator action and receipt.
        </BoundaryBanner>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="total apps" value={stats.total} sub="factory manifest" glow />
          <Stat label="built" value={stats.byStage.built} sub="needs evidence gate" accent="teal" />
          <Stat label="ui polish" value={stats.byStage['ui-polish']} sub="design pass" accent="purple" />
          <Stat label="knox audit" value={stats.byStage['knox-audit']} sub="security review" accent="amber" />
          <Stat label="store ready" value={stats.byStage['app-store-ready']} sub="approval gated" accent="amber" />
          <Stat label="live" value={stats.byStage.live} sub="receipt required" accent="teal" />
        </div>

        <HudPanel
          kicker="filters"
          title="Pipeline Scope"
          right={<Chip tone="neutral">showing {filteredApps.length}/{apps.length}</Chip>}
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 min-w-[220px] flex-1 border border-[color:var(--mc-hairline-2)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none placeholder:text-[color:var(--mc-ink-3)] focus:border-[color:var(--mc-teal)]/70"
            />
            <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
              Stage
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value as FilterStage)}
                className="h-10 border border-[color:var(--mc-hairline-2)] bg-[color:var(--mc-bg-2)] px-3 text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]/70"
              >
                <option value="all">All Stages</option>
                {Object.entries(stageConfig).map(([stage, config]) => (
                  <option key={stage} value={stage}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
              Category
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-10 border border-[color:var(--mc-hairline-2)] bg-[color:var(--mc-bg-2)] px-3 text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]/70"
              >
                <option value="all">All Categories</option>
                {categories.filter(c => c !== 'all').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </HudPanel>

        <HudPanel
          kicker="pipeline"
          title="App Pipeline"
          right={<Chip tone="amber">done requires proof</Chip>}
          padded={false}
        >
      <div className="overflow-y-auto p-4">
        {filteredApps.length === 0 ? (
          <div className="py-12 text-center text-[color:var(--mc-ink-2)]">
            <p className="font-mono text-lg font-black uppercase tracking-[0.14em]">No apps match your filters</p>
            <p className="mt-2 text-sm">Try adjusting search, stage, or category scope.</p>
          </div>
        ) : viewMode === 'pipeline' ? (
          // Pipeline View - Kanban-style columns
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
            {pipelineStages.map(stage => {
              const stageApps = appsByStage[stage]
              const config = stageConfig[stage]
              return (
                <div key={stage} className="flex w-72 flex-shrink-0 flex-col">
                  {/* Column Header */}
                  <div className="border border-b-0 border-[color:var(--mc-hairline-2)] bg-white/[0.035] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Chip tone={stageTone(stage)}>{config.label}</Chip>
                      </div>
                      <Chip tone="dim">{stageApps.length}</Chip>
                    </div>
                  </div>
                  
                  {/* Column Content */}
                  <div className="max-h-[600px] flex-1 space-y-2 overflow-y-auto border border-[color:var(--mc-hairline-2)] bg-black/20 p-2">
                    {stageApps.length === 0 ? (
                      <div className="py-8 text-center font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-3)]">
                        No apps
                      </div>
                    ) : (
                      stageApps.map(app => (
                        <div
                          key={app.id}
                          onClick={() => setSelectedApp(app)}
                          className="border border-[color:var(--mc-hairline)] bg-white/[0.035] p-3 transition-colors hover:border-[color:var(--mc-teal)]/50"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="grid h-8 w-8 place-items-center border border-[color:var(--mc-hairline)] bg-black/20 text-lg">
                              {app.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="truncate font-mono text-sm font-black text-[color:var(--mc-ink-0)]">{app.name}</h4>
                              <p className="text-[10px] text-[color:var(--mc-ink-2)]">{app.category}</p>
                            </div>
                          </div>
                          <p className="mb-2 line-clamp-2 text-xs text-[color:var(--mc-ink-2)]">
                            {app.description}
                          </p>
                          <div className="flex items-center gap-2 text-[10px]">
                            {app.hasUIGuide && (
                              <Chip tone="purple">UI Guide</Chip>
                            )}
                            {app.hasReadme && (
                              <Chip tone="teal">README</Chip>
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
                  className="overflow-hidden border border-[color:var(--mc-hairline-2)] bg-white/[0.035] transition-colors hover:border-[color:var(--mc-teal)]/50"
                  onClick={() => setSelectedApp(app)}
                >
                  {/* App Header */}
                  <div className="border-b border-[color:var(--mc-hairline)] p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center border border-[color:var(--mc-hairline)] bg-black/20 text-2xl">
                          {app.icon}
                        </div>
                        <div>
                          <h3 className="font-mono font-black text-[color:var(--mc-ink-0)]">{app.name}</h3>
                          <p className="text-xs text-[color:var(--mc-ink-2)]">{app.category}</p>
                        </div>
                      </div>
                      <Chip tone={stageTone(app.stage)}>{config.label}</Chip>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-[color:var(--mc-ink-2)]">
                      {app.description}
                    </p>
                  </div>

                  {/* App Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[color:var(--mc-ink-2)]">Revenue Model</span>
                      <span className="font-medium text-[color:var(--mc-ink-0)]">
                        {revenueModelConfig[app.revenueModel].icon} {revenueModelConfig[app.revenueModel].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[color:var(--mc-ink-2)]">Platform</span>
                      <span className="font-medium text-[color:var(--mc-ink-0)]">
                        🍎 iOS
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      {app.hasUIGuide && (
                        <Chip tone="purple">UI Guide</Chip>
                      )}
                      {app.hasReadme && (
                        <Chip tone="teal">README</Chip>
                      )}
                    </div>
                    <div className="border-t border-[color:var(--mc-hairline)] pt-2 text-xs text-[color:var(--mc-ink-2)]">
                      Modified {app.lastModified}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // List View
          <div className="overflow-hidden border border-[color:var(--mc-hairline-2)] bg-black/15">
            <table className="w-full">
              <thead className="bg-white/[0.035]">
                <tr className="text-left font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                  <th className="px-4 py-3 font-medium">App</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Docs</th>
                  <th className="px-4 py-3 font-medium">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--mc-hairline)]">
                {filteredApps.map(app => {
                  const config = stageConfig[app.stage]
                  return (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className="cursor-pointer transition-colors hover:bg-[rgba(46,230,214,0.045)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center border border-[color:var(--mc-hairline)] bg-black/20 text-lg">
                            {app.icon}
                          </div>
                          <div>
                            <div className="font-mono font-black text-[color:var(--mc-ink-0)]">{app.name}</div>
                            <div className="max-w-[200px] truncate text-xs text-[color:var(--mc-ink-2)]">{app.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[color:var(--mc-ink-0)]">
                          {categoryIcons[app.category] || '📱'} {app.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Chip tone={stageTone(app.stage)}>{config.label}</Chip>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[color:var(--mc-ink-0)]">
                          {revenueModelConfig[app.revenueModel].icon} {revenueModelConfig[app.revenueModel].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {app.hasUIGuide && <Chip tone="purple">UI</Chip>}
                          {app.hasReadme && <Chip tone="teal">README</Chip>}
                          {!app.hasUIGuide && !app.hasReadme && <span className="text-[color:var(--mc-ink-3)]">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[color:var(--mc-ink-2)]">
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
        </HudPanel>

      {/* App Detail Modal */}
      {selectedApp && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedApp(null)}
        >
          <div 
            className="mc-bevel max-h-[90vh] w-full max-w-xl overflow-y-auto bg-[color:var(--mc-bg-2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center text-3xl">
                    {selectedApp.icon}
                  </div>
                  <div>
                    <h2 className="font-mono text-xl font-black text-[color:var(--mc-ink-0)]">{selectedApp.name}</h2>
                    <p className="text-sm text-[color:var(--mc-ink-2)]">{selectedApp.bundleId}</p>
                    <div className="mt-2">
                      <Chip tone={stageTone(selectedApp.stage)}>{stageConfig[selectedApp.stage].label}</Chip>
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

              <BoundaryBanner tone="amber" title="Action Boundary">
                Pipeline buttons in this modal are staging controls only in local Mission Control. Store submission,
                Xcode launch, analytics, and verification states require explicit approval plus a receipt.
              </BoundaryBanner>

              <p className="mb-6 mt-4 text-[color:var(--mc-ink-1)]">{selectedApp.description}</p>

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
                <h3 className="mb-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">Documentation Status</h3>
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
                <h3 className="mb-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">Pipeline Actions</h3>
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

              <div className="text-sm text-[color:var(--mc-ink-2)]">
                <span className="font-medium">Last modified:</span> {selectedApp.lastModified}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </Page>
  )
}
