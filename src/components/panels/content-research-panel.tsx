'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ContentResearchPanel')

interface VideoEntry {
  id: string
  title: string
  url: string
  channel: string
  views?: string
  date?: string
  relevanceTag?: string
  insights: string[]
  actionableItems: string[]
  toolsMentioned: string[]
  rawContent: string
}

interface ContentResearchResponse {
  videos: VideoEntry[]
  aggregated: {
    actionableItems: string[]
    toolsMentioned: string[]
  }
  lastUpdated: number
  error?: string
}

type DateFilter = 'today' | 'week' | 'all'
type RelevanceFilter = 'all' | 'high' | 'medium' | 'low'

export function ContentResearchPanel() {
  const [data, setData] = useState<ContentResearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set())
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [relevanceFilter, setRelevanceFilter] = useState<RelevanceFilter>('all')
  const [showInsightsPanel, setShowInsightsPanel] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/content-research')
      if (!response.ok) throw new Error('Failed to fetch content research')
      const json: ContentResearchResponse = await response.json()
      setData(json)
      setError(json.error || null)
    } catch (err) {
      log.error('Failed to fetch content research:', err)
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleExpanded = (id: string) => {
    setExpandedVideos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter videos
  const filteredVideos = useMemo(() => {
    if (!data?.videos) return []
    
    return data.videos.filter(video => {
      // Date filter
      if (dateFilter !== 'all' && video.date) {
        const videoDate = new Date(video.date)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        
        if (dateFilter === 'today' && videoDate < today) return false
        if (dateFilter === 'week' && videoDate < weekAgo) return false
      }
      
      // Relevance filter
      if (relevanceFilter !== 'all') {
        if (video.relevanceTag !== relevanceFilter) return false
      }
      
      return true
    })
  }, [data?.videos, dateFilter, relevanceFilter])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const getYouTubeThumbnail = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
    return null
  }

  const getRelevanceColor = (tag?: string) => {
    switch (tag?.toLowerCase()) {
      case 'high': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading content research...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-xl">
            📺
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Content Research</h2>
            <p className="text-sm text-muted-foreground">
              YouTube Digest • {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInsightsPanel(!showInsightsPanel)}
            className={showInsightsPanel ? 'bg-primary/10' : ''}
          >
            💡 Insights
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Date:</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['today', 'week', 'all'] as DateFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  dateFilter === filter
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                } ${filter !== 'today' ? 'border-l border-border' : ''}`}
              >
                {filter === 'today' ? 'Today' : filter === 'week' ? 'This Week' : 'All'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Relevance:</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['all', 'high', 'medium', 'low'] as RelevanceFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setRelevanceFilter(filter)}
                className={`px-3 py-1 text-xs font-medium transition-colors capitalize ${
                  relevanceFilter === filter
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                } ${filter !== 'all' ? 'border-l border-border' : ''}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video List */}
        <div className={`flex-1 overflow-y-auto p-4 ${showInsightsPanel ? 'pr-2' : ''}`}>
          {error && !data?.videos?.length && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-3xl">
                📭
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {filteredVideos.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl">
                🔍
              </div>
              <div>
                <p className="text-sm text-foreground font-medium">No videos match your filters</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the date or relevance filter</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filteredVideos.map(video => {
              const isExpanded = expandedVideos.has(video.id)
              const thumbnail = getYouTubeThumbnail(video.url)
              
              return (
                <div
                  key={video.id}
                  className="bg-surface-1 rounded-lg border border-border hover:border-border/80 transition-colors overflow-hidden"
                >
                  <div
                    className="flex gap-3 p-3 cursor-pointer"
                    onClick={() => toggleExpanded(video.id)}
                  >
                    {/* Thumbnail */}
                    {thumbnail && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <div className="w-32 h-[72px] rounded overflow-hidden bg-black/20 relative group">
                          <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-2xl">▶</span>
                          </div>
                        </div>
                      </a>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                          {video.title}
                        </h3>
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          <polyline points="4,6 8,10 12,6" />
                        </svg>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{video.channel}</span>
                        {video.views && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="text-xs text-muted-foreground">{video.views} views</span>
                          </>
                        )}
                        {video.date && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(video.date)}</span>
                          </>
                        )}
                        {video.relevanceTag && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getRelevanceColor(video.relevanceTag)}`}>
                            {video.relevanceTag}
                          </span>
                        )}
                      </div>
                      
                      {/* Quick stats */}
                      {!isExpanded && (video.insights.length > 0 || video.actionableItems.length > 0) && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {video.insights.length > 0 && (
                            <span>💡 {video.insights.length} insight{video.insights.length !== 1 ? 's' : ''}</span>
                          )}
                          {video.actionableItems.length > 0 && (
                            <span>✅ {video.actionableItems.length} action{video.actionableItems.length !== 1 ? 's' : ''}</span>
                          )}
                          {video.toolsMentioned.length > 0 && (
                            <span>🔧 {video.toolsMentioned.length} tool{video.toolsMentioned.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0 space-y-3">
                      {video.insights.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            💡 Key Insights
                          </h4>
                          <ul className="space-y-1">
                            {video.insights.map((insight, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {video.actionableItems.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            ✅ Actionable Items
                          </h4>
                          <ul className="space-y-1">
                            {video.actionableItems.map((action, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-green-400 mt-0.5">→</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {video.toolsMentioned.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            🔧 Tools Mentioned
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {video.toolsMentioned.map((tool, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded bg-secondary text-foreground"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-2 flex gap-2">
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Watch on YouTube →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Insights Sidebar */}
        {showInsightsPanel && data?.aggregated && (
          <div className="w-72 border-l border-border p-4 overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold text-foreground mb-4">📊 Aggregated Insights</h3>
            
            {data.aggregated.actionableItems.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Actionable Items ({data.aggregated.actionableItems.length})
                </h4>
                <ul className="space-y-2">
                  {data.aggregated.actionableItems.slice(0, 10).map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <span className="text-green-400 shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {data.aggregated.actionableItems.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{data.aggregated.actionableItems.length - 10} more
                  </p>
                )}
              </div>
            )}
            
            {data.aggregated.toolsMentioned.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Tools Mentioned ({data.aggregated.toolsMentioned.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.aggregated.toolsMentioned.map((tool, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {data.aggregated.actionableItems.length === 0 && data.aggregated.toolsMentioned.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No aggregated insights yet. Insights will appear as videos are processed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
