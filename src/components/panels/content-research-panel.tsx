'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
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

  const getRelevanceTone = (tag?: string): 'teal' | 'amber' | 'dim' | 'neutral' => {
    switch (tag?.toLowerCase()) {
      case 'high': return 'teal'
      case 'medium': return 'amber'
      case 'low': return 'dim'
      default: return 'neutral'
    }
  }

  const filterButtonClass = (active: boolean) => `border px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
    active
      ? 'border-[color:var(--mc-teal)]/60 bg-[rgba(46,230,214,0.12)] text-[color:var(--mc-teal-soft)]'
      : 'border-[color:var(--mc-hairline)] bg-black/20 text-[color:var(--mc-ink-3)] hover:border-[color:var(--mc-hairline-2)] hover:text-[color:var(--mc-ink-1)]'
  }`

  if (loading) {
    return (
      <Page
        kicker="Blackwire Ops / Content Research"
        title="Content Research"
        subtitle="Loading the local content digest and draft-safe research queue."
        badges={<Chip tone="amber" pulse>loading</Chip>}
      >
        <HudPanel title="Loading content research" glow>
          <div className="h-40 animate-pulse border border-[color:var(--mc-hairline)] bg-black/20" />
        </HudPanel>
      </Page>
    )
  }

  const totalVideos = data?.videos?.length ?? 0
  const actionableCount = data?.aggregated.actionableItems.length ?? 0
  const toolsCount = data?.aggregated.toolsMentioned.length ?? 0
  const highRelevanceCount = data?.videos?.filter(video => video.relevanceTag === 'high').length ?? 0
  const lastUpdated = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No local digest'

  return (
    <Page
      kicker="Blackwire Ops / Content Research"
      title="Content Research"
      subtitle={`Local content digest with draft-safe outputs, citation/source context, and operator review before downstream use. Showing ${filteredVideos.length} of ${totalVideos} videos.`}
      badges={
        <>
          <Chip tone="teal">local digest</Chip>
          <Chip tone="amber">draft-safe</Chip>
          <Chip tone="purple">viewer-auth</Chip>
          {error && <Chip tone="amber">source caveat</Chip>}
        </>
      }
      actions={
        <>
          <button type="button" onClick={() => setShowInsightsPanel(!showInsightsPanel)} className={filterButtonClass(showInsightsPanel)}>
            insights {showInsightsPanel ? 'on' : 'off'}
          </button>
          <button type="button" onClick={fetchData} className={filterButtonClass(false)}>
            refresh
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Content research boundary">
          This route reads the local YouTube digest and surfaces draft-safe research only. It does not publish, send marketing, create customer messages, or write durable memory.
        </BoundaryBanner>

        {error && (
          <BoundaryBanner tone="amber" title="Local source caveat">
            {error}
          </BoundaryBanner>
        )}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat label="filtered videos" value={filteredVideos.length} sub={`${totalVideos} local total`} glow />
          <Stat label="high relevance" value={highRelevanceCount} sub="digest tags" accent={highRelevanceCount > 0 ? 'teal' : 'dim'} />
          <Stat label="actions" value={actionableCount} sub="draft only" accent={actionableCount > 0 ? 'amber' : 'dim'} />
          <Stat label="tools" value={toolsCount} sub="mentioned" accent={toolsCount > 0 ? 'purple' : 'dim'} />
          <Stat label="updated" value={<span className="text-base">{lastUpdated}</span>} sub="local file read" accent="neutral" />
        </section>

        <HudPanel kicker="filters" title="Digest Scope">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">Date</span>
              <div className="flex flex-wrap gap-1">
                {(['today', 'week', 'all'] as DateFilter[]).map(filter => (
                  <button key={filter} type="button" onClick={() => setDateFilter(filter)} className={filterButtonClass(dateFilter === filter)}>
                    {filter === 'today' ? 'today' : filter === 'week' ? 'week' : 'all'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">Relevance</span>
              <div className="flex flex-wrap gap-1">
                {(['all', 'high', 'medium', 'low'] as RelevanceFilter[]).map(filter => (
                  <button key={filter} type="button" onClick={() => setRelevanceFilter(filter)} className={filterButtonClass(relevanceFilter === filter)}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </HudPanel>

        <div className={`grid gap-4 ${showInsightsPanel ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <HudPanel
            kicker="source queue"
            title="Video Digest"
            right={<Chip tone={filteredVideos.length > 0 ? 'teal' : 'dim'}>{filteredVideos.length} visible</Chip>}
          >
            {error && !data?.videos?.length && (
              <div className="border border-dashed border-[color:var(--mc-hairline-2)] bg-black/20 p-4 text-sm text-[color:var(--mc-ink-2)]">
                {error}
              </div>
            )}

            {filteredVideos.length === 0 && !error && (
              <div className="border border-dashed border-[color:var(--mc-hairline-2)] bg-black/20 p-4">
                <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">No videos match your filters</p>
                <p className="mt-2 text-xs text-[color:var(--mc-ink-2)]">Try adjusting date or relevance scope.</p>
              </div>
            )}

            <div className="space-y-3">
              {filteredVideos.map(video => {
              const isExpanded = expandedVideos.has(video.id)
              const thumbnail = getYouTubeThumbnail(video.url)
              
              return (
                <div
                  key={video.id}
                  className="overflow-hidden border border-[color:var(--mc-hairline)] bg-black/20 transition-colors hover:border-[color:var(--mc-hairline-2)]"
                >
                  <button
                    type="button"
                    className="flex w-full gap-3 p-3 text-left"
                    onClick={() => toggleExpanded(video.id)}
                  >
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
                            <span className="font-mono text-xs font-black uppercase tracking-[0.14em] text-white">open</span>
                          </div>
                        </div>
                      </a>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--mc-ink-0)]">
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
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)]">{video.channel}</span>
                        {video.views && (
                          <>
                            <span className="text-[color:var(--mc-ink-3)]">/</span>
                            <span className="text-xs text-[color:var(--mc-ink-2)]">{video.views} views</span>
                          </>
                        )}
                        {video.date && (
                          <>
                            <span className="text-[color:var(--mc-ink-3)]">/</span>
                            <span className="text-xs text-[color:var(--mc-ink-2)]">{formatDate(video.date)}</span>
                          </>
                        )}
                        {video.relevanceTag && (
                          <Chip tone={getRelevanceTone(video.relevanceTag)}>{video.relevanceTag}</Chip>
                        )}
                      </div>
                      
                      {!isExpanded && (video.insights.length > 0 || video.actionableItems.length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {video.insights.length > 0 && (
                            <Chip tone="purple">{video.insights.length} insights</Chip>
                          )}
                          {video.actionableItems.length > 0 && (
                            <Chip tone="amber">{video.actionableItems.length} actions</Chip>
                          )}
                          {video.toolsMentioned.length > 0 && (
                            <Chip tone="neutral">{video.toolsMentioned.length} tools</Chip>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="space-y-3 border-t border-[color:var(--mc-hairline)] px-3 pb-3 pt-3">
                      {video.insights.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-purple-soft)]">
                            Key Insights
                          </h4>
                          <ul className="space-y-1">
                            {video.insights.map((insight, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                                <span className="mt-0.5 text-[color:var(--mc-teal)]">-</span>
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {video.actionableItems.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-amber)]">
                            Actionable Items
                          </h4>
                          <ul className="space-y-1">
                            {video.actionableItems.map((action, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs leading-5 text-[color:var(--mc-ink-2)]">
                                <span className="mt-0.5 text-[color:var(--mc-amber)]">-</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {video.toolsMentioned.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-1)]">
                            Tools Mentioned
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {video.toolsMentioned.map((tool, i) => (
                              <Chip key={i} tone="neutral">{tool}</Chip>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-teal-soft)] hover:underline"
                        >
                          Open Source
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </HudPanel>

          {showInsightsPanel && data?.aggregated && (
            <HudPanel kicker="aggregate" title="Digest Insights" right={<Chip tone="amber">draft-safe</Chip>}>
            
              {data.aggregated.actionableItems.length > 0 && (
                <div className="mb-6">
                  <h4 className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-amber)]">
                    Actionable Items ({data.aggregated.actionableItems.length})
                  </h4>
                  <ul className="space-y-2">
                    {data.aggregated.actionableItems.slice(0, 10).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs leading-5 text-[color:var(--mc-ink-1)]">
                        <span className="shrink-0 text-[color:var(--mc-amber)]">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {data.aggregated.actionableItems.length > 10 && (
                    <p className="mt-2 text-xs text-[color:var(--mc-ink-3)]">
                      +{data.aggregated.actionableItems.length - 10} more
                    </p>
                  )}
                </div>
              )}
            
              {data.aggregated.toolsMentioned.length > 0 && (
                <div>
                  <h4 className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-1)]">
                    Tools Mentioned ({data.aggregated.toolsMentioned.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {data.aggregated.toolsMentioned.map((tool, i) => (
                      <Chip key={i} tone="neutral">{tool}</Chip>
                    ))}
                  </div>
                </div>
              )}
            
              {data.aggregated.actionableItems.length === 0 && data.aggregated.toolsMentioned.length === 0 && (
                <p className="py-8 text-center text-xs leading-5 text-[color:var(--mc-ink-2)]">
                  No aggregated insights yet. Draft-safe insights appear as videos are processed.
                </p>
              )}
            </HudPanel>
          )}
        </div>
      </div>
    </Page>
  )
}
